import { z } from "zod";
import { body, route } from "@/lib/api";
import { withSystem } from "@/lib/database/db";
import { log } from "@/lib/logger";
import { runInBackground } from "@/lib/background";
import { emailPlatformAdmins, emailTemplates, mailbox } from "@/lib/email";
import { env } from "@/lib/env";
import { INQUIRY_TOPIC_LABEL, INQUIRY_TOPICS } from "@/lib/marketing";

const Schema = z.object({
  topic: z.enum(INQUIRY_TOPICS).default("access"),
  topic_other: z.string().trim().max(120).optional().transform((v) => v || null),
  name: z.string().trim().min(1, "Please enter your name").max(120),
  email: z.string().trim().toLowerCase().email("Please enter a valid work email"),
  company: z.string().trim().max(160).optional().transform((v) => v || null),
  team_size: z.enum(["1-10", "11-50", "51-200", "201-1000", "1000+"]).nullable().optional(),
  phone: z.string().trim().max(40).optional().transform((v) => v || null),
  message: z.string().trim().max(2000).optional().transform((v) => v || null),
  website: z.string().max(200).optional(), // honeypot
}).superRefine((v, ctx) => {
  if (v.topic === "access" && !v.company) ctx.addIssue({ code: "custom", path: ["company"], message: "Please enter your company" });
  if (v.topic === "other" && !v.topic_other) ctx.addIssue({ code: "custom", path: ["topic_other"], message: "Please tell us what it's about" });
  if (v.topic !== "access" && !v.message) ctx.addIssue({ code: "custom", path: ["message"], message: "Please write a message" });
});

/** Public "Request access" and "Contact us" forms. Stored only; reviewed under Admin → Inquiries. */
export const POST = route(async (req) => {
  const input = await body(req, Schema);
  if (input.website) return { ok: true }; // bot filled the hidden field: pretend success
  await withSystem((tx) => tx`
    insert into access_requests (topic, topic_other, name, email, company, team_size, phone, message, source)
    values (${input.topic}, ${input.topic === "other" ? input.topic_other : null}, ${input.name}, ${input.email}, ${input.company},
            ${input.team_size ?? null}, ${input.phone}, ${input.message}, ${input.topic === "access" ? "home_page" : "contact_form"})`);
  log.info("access_request.received", { topic: input.topic, email_domain: input.email.split("@")[1] });
  runInBackground("access_request.email_admins", () => emailPlatformAdmins(emailTemplates.inquiryToAdmin({
    topic: input.topic === "other" && input.topic_other ? `Other: ${input.topic_other}` : INQUIRY_TOPIC_LABEL[input.topic],
    name: input.name, email: input.email, company: input.company, phone: input.phone, teamSize: input.team_size ?? null, message: input.message,
    link: `${env().APP_URL}/admin/requests?topic=${input.topic}`,
  }), mailbox(input.name, input.email)));
  return { ok: true };
}, { rateLimit: { key: "access-request", limit: 5, windowMs: 60 * 60_000 } });
