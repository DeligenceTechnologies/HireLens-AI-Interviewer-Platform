import "server-only";
import { z } from "zod";
import { ApiError } from "@/lib/api";
import { audit, notify } from "@/lib/audit";
import type { AuthContext } from "@/lib/auth/session";
import { withOrg, withSystem, type Tx } from "@/lib/database/db";
import { emailTemplates, sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";
import { platformAudit } from "./platform";

// Help and support: signed-in customers write to the platform team, and the
// conversation continues on both sides. Owners and admins see every request
// from their company; everyone else sees their own.

export const SUPPORT_CATEGORIES = ["problem", "question", "feature", "billing"] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];
export const SUPPORT_CATEGORY_LABEL: Record<SupportCategory, string> = {
  problem: "Problem", question: "Question", feature: "Feature request", billing: "Billing and plan",
};
export const SUPPORT_STATUSES = ["open", "in_progress", "resolved"] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];
export const SUPPORT_STATUS_LABEL: Record<SupportStatus, string> = { open: "Open", in_progress: "In progress", resolved: "Resolved" };

const Message = z.string().trim().min(1, "Please write a message").max(5000);
export const CreateTicketSchema = z.object({
  category: z.enum(SUPPORT_CATEGORIES),
  subject: z.string().trim().min(3, "Please add a short subject").max(160),
  message: Message,
  pageUrl: z.string().trim().max(500).optional().transform((v) => v || null),
});
export const ReplySchema = z.object({ message: Message });
export const AdminReplySchema = z.object({ message: Message.optional(), status: z.enum(SUPPORT_STATUSES).optional() })
  .refine((v) => v.message || v.status, "Write a reply or change the status");
export const CustomerStatusSchema = z.object({ status: z.enum(["open", "resolved"]) });

export type SupportTicket = {
  id: string; category: SupportCategory; subject: string; page_url: string | null; status: SupportStatus;
  created_at: Date; last_message_at: Date; last_message_from_admin: boolean; author: string | null; messages: number;
};
export type SupportMessage = { id: string; from_admin: boolean; body: string; created_at: Date; author: string | null };

const seesAll = (auth: Pick<AuthContext, "role">) => auth.role === "owner" || auth.role === "admin";
const visible = (tx: Tx, auth: Pick<AuthContext, "userId" | "role">) => (seesAll(auth) ? tx`true` : tx`t.user_id = ${auth.userId}`);
const ticketLink = (id: string) => `${env().APP_URL}/help/${id}`;
const adminLink = (id: string) => `${env().APP_URL}/admin/support/${id}`;

/** Email every platform admin (best effort; the request itself is already saved). */
async function emailAdmins(tpl: { subject: string; text: string }) {
  try {
    const admins = await withSystem((tx) => tx<{ email: string }[]>`select email from users where is_platform_admin and disabled_at is null`);
    for (const a of admins) await sendEmail({ to: a.email, ...tpl });
  } catch (err) {
    log.warn("support.email_admins_failed", { err });
  }
}

export async function createTicket(auth: AuthContext, input: z.infer<typeof CreateTicketSchema>) {
  const id = await withOrg(auth.orgId, async (tx) => {
    const [t] = await tx<{ id: string }[]>`
      insert into support_tickets (organization_id, user_id, category, subject, page_url)
      values (${auth.orgId}, ${auth.userId}, ${input.category}, ${input.subject}, ${input.pageUrl}) returning id`;
    await tx`insert into support_messages (organization_id, ticket_id, user_id, body) values (${auth.orgId}, ${t.id}, ${auth.userId}, ${input.message})`;
    await audit(tx, { orgId: auth.orgId, userId: auth.userId, action: "support.ticket_created", entityType: "support_ticket", entityId: t.id, metadata: { category: input.category } });
    return t.id;
  });
  await emailAdmins(emailTemplates.supportToAdmin({
    kind: "new", company: auth.orgName, name: auth.name, email: auth.email, category: SUPPORT_CATEGORY_LABEL[input.category],
    subject: input.subject, message: input.message, link: adminLink(id),
  }));
  return { id };
}

export async function listMyTickets(auth: AuthContext) {
  return withOrg(auth.orgId, (tx) => tx<SupportTicket[]>`
    select t.id, t.category, t.subject, t.page_url, t.status, t.created_at, t.last_message_at, t.last_message_from_admin, u.name as author,
      (select count(*)::int from support_messages m where m.ticket_id = t.id) as messages
    from support_tickets t left join users u on u.id = t.user_id
    where t.organization_id = ${auth.orgId} and ${visible(tx, auth)}
    order by (t.status = 'resolved'), t.last_message_at desc limit 200`);
}

export async function getMyTicket(auth: AuthContext, id: string) {
  return withOrg(auth.orgId, async (tx) => {
    const [ticket] = await tx<SupportTicket[]>`
      select t.id, t.category, t.subject, t.page_url, t.status, t.created_at, t.last_message_at, t.last_message_from_admin, u.name as author, 0 as messages
      from support_tickets t left join users u on u.id = t.user_id
      where t.id = ${id} and t.organization_id = ${auth.orgId} and ${visible(tx, auth)}`;
    if (!ticket) return null;
    // Customers see "PickMyHire.ai support", not which admin replied.
    const messages = await tx<SupportMessage[]>`
      select m.id, m.from_admin, m.body, m.created_at, case when m.from_admin then null else u.name end as author
      from support_messages m left join users u on u.id = m.user_id
      where m.ticket_id = ${id} order by m.created_at`;
    return { ticket, messages };
  });
}

/** A customer replies; a resolved request opens again. */
export async function replyAsCustomer(auth: AuthContext, id: string, message: string) {
  const t = await withOrg(auth.orgId, async (tx) => {
    const [t] = await tx<{ id: string; subject: string }[]>`
      update support_tickets t set status = case when status = 'resolved' then 'open' else status end, last_message_at = now(), last_message_from_admin = false
      where t.id = ${id} and t.organization_id = ${auth.orgId} and ${visible(tx, auth)} returning id, subject`;
    if (!t) throw new ApiError(404, "Request not found");
    await tx`insert into support_messages (organization_id, ticket_id, user_id, body) values (${auth.orgId}, ${id}, ${auth.userId}, ${message})`;
    await audit(tx, { orgId: auth.orgId, userId: auth.userId, action: "support.replied", entityType: "support_ticket", entityId: id });
    return t;
  });
  await emailAdmins(emailTemplates.supportToAdmin({
    kind: "reply", company: auth.orgName, name: auth.name, email: auth.email, subject: t.subject, message, link: adminLink(id),
  }));
}

/** A customer marks their request resolved, or opens it again. */
export async function setMyTicketStatus(auth: AuthContext, id: string, status: "open" | "resolved") {
  await withOrg(auth.orgId, async (tx) => {
    const [t] = await tx`update support_tickets t set status = ${status} where t.id = ${id} and t.organization_id = ${auth.orgId} and ${visible(tx, auth)} returning id`;
    if (!t) throw new ApiError(404, "Request not found");
    await audit(tx, { orgId: auth.orgId, userId: auth.userId, action: "support.status_changed", entityType: "support_ticket", entityId: id, metadata: { status } });
  });
}

// ---------------------------------------------------------------------------
// Platform admin
// ---------------------------------------------------------------------------

export type AdminSupportTicket = SupportTicket & { org_id: string; org_name: string; author_email: string | null };

export async function listSupportTickets(filter: { status?: SupportStatus; category?: SupportCategory }) {
  return withSystem((tx) => tx<AdminSupportTicket[]>`
    select t.id, t.category, t.subject, t.page_url, t.status, t.created_at, t.last_message_at, t.last_message_from_admin,
      u.name as author, u.email as author_email, o.id as org_id, o.name as org_name,
      (select count(*)::int from support_messages m where m.ticket_id = t.id) as messages
    from support_tickets t join organizations o on o.id = t.organization_id left join users u on u.id = t.user_id
    where true ${filter.status ? tx`and t.status = ${filter.status}` : tx``} ${filter.category ? tx`and t.category = ${filter.category}` : tx``}
    order by (t.status = 'resolved'), t.last_message_from_admin, t.last_message_at desc limit 300`);
}

export async function getSupportTicket(id: string) {
  return withSystem(async (tx) => {
    const [ticket] = await tx<(AdminSupportTicket & { author_role: string | null })[]>`
      select t.id, t.category, t.subject, t.page_url, t.status, t.created_at, t.last_message_at, t.last_message_from_admin,
        u.name as author, u.email as author_email, o.id as org_id, o.name as org_name, 0 as messages,
        (select m.role::text from organization_members m where m.organization_id = t.organization_id and m.user_id = t.user_id) as author_role
      from support_tickets t join organizations o on o.id = t.organization_id left join users u on u.id = t.user_id
      where t.id = ${id}`;
    if (!ticket) return null;
    const messages = await tx<SupportMessage[]>`
      select m.id, m.from_admin, m.body, m.created_at, u.name as author
      from support_messages m left join users u on u.id = m.user_id where m.ticket_id = ${id} order by m.created_at`;
    return { ticket, messages };
  });
}

/** Reply to a customer and/or change the status. A reply moves an open request to In progress. */
export async function adminUpdateTicket(adminId: string, id: string, input: z.infer<typeof AdminReplySchema>) {
  const t = await withSystem(async (tx) => {
    const [t] = await tx<{ id: string; organization_id: string; user_id: string | null; subject: string; status: SupportStatus }[]>`
      select id, organization_id, user_id, subject, status from support_tickets where id = ${id} for update`;
    if (!t) throw new ApiError(404, "Request not found");
    const status = input.status ?? (input.message && t.status === "open" ? "in_progress" : t.status);
    if (input.message) {
      await tx`insert into support_messages (organization_id, ticket_id, user_id, from_admin, body) values (${t.organization_id}, ${id}, ${adminId}, true, ${input.message})`;
      await tx`update support_tickets set status = ${status}, last_message_at = now(), last_message_from_admin = true where id = ${id}`;
      if (t.user_id) await notify(tx, { orgId: t.organization_id, userId: t.user_id, type: "support.reply", payload: { ticket_id: id, subject: t.subject } });
    } else {
      await tx`update support_tickets set status = ${status} where id = ${id}`;
    }
    await platformAudit(tx, { adminId, action: input.message ? "support.replied" : "support.status_changed", targetType: "support_ticket", targetId: id, details: { status } });
    return t;
  });
  if (input.message && t.user_id) {
    const [u] = await withSystem((tx) => tx<{ email: string; name: string }[]>`select email, name from users where id = ${t.user_id} and disabled_at is null`);
    if (u) await sendEmail({ to: u.email, orgId: t.organization_id, ...emailTemplates.supportReply({ name: u.name.split(" ")[0], subject: t.subject, message: input.message, link: ticketLink(id) }) });
  }
}

export async function countOpenSupport() {
  const [{ n }] = await withSystem((tx) => tx<{ n: number }[]>`select count(*)::int as n from support_tickets where status <> 'resolved' and not last_message_from_admin`);
  return n;
}
