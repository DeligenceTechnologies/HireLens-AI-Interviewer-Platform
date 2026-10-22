import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Role } from "@/lib/auth/permissions";
import type { AuthContext } from "@/lib/auth/session";
import { withSystem } from "@/lib/database/db";
import {
  adminUpdateTicket, createTicket, getMyTicket, getSupportTicket, listMyTickets, listSupportTickets, replyAsCustomer, setMyTicketStatus,
} from "@/lib/services/support";

// Help and support against the local database: who sees which request, and the reply flow.
const id = Date.now().toString(36);
const orgs: string[] = [];
const users: string[] = [];
let owner: AuthContext, recruiter: AuthContext, recruiter2: AuthContext, otherOwner: AuthContext;
let adminId = "";

async function member(orgId: string, orgName: string, name: string, role: Role): Promise<AuthContext> {
  return withSystem(async (tx) => {
    const email = `${role}-${users.length}-${id}@support.test`;
    const [u] = await tx<{ id: string }[]>`insert into users (email, name, password_hash) values (${email}, ${name}, 'x') returning id`;
    users.push(u.id);
    await tx`insert into organization_members (organization_id, user_id, role) values (${orgId}, ${u.id}, ${role})`;
    return { userId: u.id, email, name, orgId, orgName, orgSlug: orgName, role, sessionId: "test", isPlatformAdmin: false };
  });
}

beforeAll(async () => {
  for (const name of [`Support Co ${id}`, `Other Co ${id}`]) {
    const [o] = await withSystem((tx) => tx<{ id: string }[]>`insert into organizations (name, slug) values (${name}, ${name.toLowerCase().replaceAll(" ", "-")}) returning id`);
    orgs.push(o.id);
  }
  owner = await member(orgs[0], `Support Co ${id}`, "Olivia Owner", "owner");
  recruiter = await member(orgs[0], `Support Co ${id}`, "Rita Recruiter", "recruiter");
  recruiter2 = await member(orgs[0], `Support Co ${id}`, "Rob Recruiter", "recruiter");
  otherOwner = await member(orgs[1], `Other Co ${id}`, "Oscar Other", "owner");
  const [a] = await withSystem((tx) => tx<{ id: string }[]>`insert into users (email, name, password_hash) values (${`admin-${id}@support.test`}, 'Ada Admin', 'x') returning id`);
  adminId = a.id;
  users.push(adminId);
});

afterAll(async () => {
  await withSystem(async (tx) => {
    await tx`delete from organizations where id = any(${orgs})`;
    await tx`delete from platform_audit_logs where admin_user_id = ${adminId}`;
    await tx`delete from users where id = any(${users})`;
  });
});

describe("help and support", () => {
  let ticketId = "";

  it("lets a member write in, and shows the request to them and their company's owner only", async () => {
    ({ id: ticketId } = await createTicket(recruiter, { category: "problem", subject: "Candidate can't start", message: "The link shows an error.", pageUrl: null }));
    expect((await listMyTickets(recruiter)).map((t) => t.id)).toEqual([ticketId]);
    expect((await listMyTickets(owner)).map((t) => t.id)).toEqual([ticketId]);
    expect(await listMyTickets(recruiter2)).toEqual([]);
    expect(await getMyTicket(recruiter2, ticketId)).toBeNull();
    expect(await getMyTicket(otherOwner, ticketId)).toBeNull();
    await expect(replyAsCustomer(otherOwner, ticketId, "sneaky")).rejects.toMatchObject({ status: 404 });
  });

  it("lets the platform team reply, which notifies and emails the customer", async () => {
    expect((await listSupportTickets({ status: "open" })).some((t) => t.id === ticketId && t.org_name === `Support Co ${id}`)).toBe(true);
    await adminUpdateTicket(adminId, ticketId, { message: "Thanks, we're looking into it." });

    const mine = await getMyTicket(recruiter, ticketId);
    expect(mine!.ticket).toMatchObject({ status: "in_progress", last_message_from_admin: true });
    expect(mine!.messages.map((m) => [m.from_admin, m.author])).toEqual([[false, "Rita Recruiter"], [true, null]]); // admin's name stays hidden
    expect((await getSupportTicket(ticketId))!.messages[1].author).toBe("Ada Admin");

    const [n] = await withSystem((tx) => tx<{ type: string; user_id: string }[]>`select type, user_id from notifications where organization_id = ${orgs[0]} and payload->>'ticket_id' = ${ticketId}`);
    expect(n).toEqual({ type: "support.reply", user_id: recruiter.userId });
    const [mail] = await withSystem((tx) => tx<{ subject: string; body_text: string }[]>`select subject, body_text from email_outbox where to_email = ${recruiter.email} order by created_at desc limit 1`);
    expect(mail.subject).toBe("Re: Candidate can't start");
    expect(mail.body_text).toContain(`/help/${ticketId}`);
  });

  it("opens a resolved request again when the customer replies", async () => {
    await setMyTicketStatus(recruiter, ticketId, "resolved");
    expect((await getMyTicket(recruiter, ticketId))!.ticket.status).toBe("resolved");
    await replyAsCustomer(owner, ticketId, "It happened again today.");
    const t = (await getMyTicket(recruiter, ticketId))!;
    expect(t.ticket).toMatchObject({ status: "open", last_message_from_admin: false });
    expect(t.messages).toHaveLength(3);
  });
});
