import "server-only";
import { env } from "@/lib/env";
import { withSystem } from "@/lib/database/db";
import { log } from "@/lib/logger";

export type EmailAttachment = { filename: string; content: string; contentType: string };
export type EmailMessage = {
  to: string; subject: string; text: string; orgId?: string | null;
  /** Where replies go (e.g. the recruiter), since the From address has no mailbox. */
  replyTo?: string | null;
  attachments?: EmailAttachment[];
};

interface EmailProvider {
  name: string;
  send(msg: EmailMessage): Promise<void>;
}

/** Development provider: records the message in email_outbox (visible under Settings → Notifications). */
const logProvider: EmailProvider = {
  name: "log",
  async send(msg) {
    log.info("email.logged", { to_domain: msg.to.split("@")[1], subject: msg.subject });
  },
};

/** The Resend API request body (attachments are sent base64-encoded). */
export function resendPayload(msg: EmailMessage, from: string | undefined) {
  return {
    from, to: msg.to, subject: msg.subject, text: msg.text,
    ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
    ...(msg.attachments?.length ? {
      attachments: msg.attachments.map((a) => ({ filename: a.filename, content: Buffer.from(a.content).toString("base64"), content_type: a.contentType })),
    } : {}),
  };
}

const resendProvider: EmailProvider = {
  name: "resend",
  async send(msg) {
    const e = env();
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${e.EMAIL_PROVIDER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(resendPayload(msg, e.EMAIL_FROM)),
    });
    if (!res.ok) throw new Error(`Email provider returned ${res.status}`);
  },
};

/** "Name <email>" for a team member, used as the reply-to on emails sent on their behalf. */
export async function replyToUser(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  try {
    const [u] = await withSystem((tx) => tx<{ name: string; email: string }[]>`select name, email from users where id = ${userId} and disabled_at is null`);
    return u ? `${u.name.replace(/[<>"\\,;]/g, "").trim() || u.email} <${u.email}>` : null;
  } catch {
    return null;
  }
}

function provider(): EmailProvider {
  return env().EMAIL_PROVIDER === "resend" ? resendProvider : logProvider;
}

export async function sendEmail(msg: EmailMessage): Promise<{ ok: boolean }> {
  const p = provider();
  let status = "sent";
  let error: string | null = null;
  try {
    await p.send(msg);
  } catch (err) {
    status = "failed";
    error = err instanceof Error ? err.message : "send failed";
    log.warn("email.send_failed", { provider: p.name, error });
  }
  // The outbox notes the reply-to and attachments too, so they're visible under Settings → Notifications.
  const extras = [msg.replyTo && `Reply-to: ${msg.replyTo}`, ...(msg.attachments ?? []).map((a) => `Attached: ${a.filename}`)].filter(Boolean);
  const logged = extras.length ? `${msg.text}\n\n---\n${extras.join("\n")}` : msg.text;
  await withSystem((tx) => tx`
    insert into email_outbox (organization_id, to_email, subject, body_text, provider, status, error)
    values (${msg.orgId ?? null}, ${msg.to}, ${msg.subject}, ${logged}, ${p.name}, ${status}, ${error})`);
  return { ok: status === "sent" };
}

export const emailTemplates = {
  invitation(input: { candidateName: string; jobTitle: string; companyName: string; minutes: number; link: string; expiresAt: Date | null; roundName?: string | null }) {
    return {
      subject: input.roundName ? `Your ${input.roundName} interview for ${input.jobTitle}` : "Your AI interview invitation",
      text: `Hi ${input.candidateName},

${input.companyName} has invited you to ${input.roundName ? `the ${input.roundName} round, an AI-assisted interview,` : "an AI-assisted interview"} for the ${input.jobTitle} role.

• Approximate duration: ${input.minutes} minutes
• You'll need a computer with a camera and microphone, and a quiet place.
• The interview is recorded and transcribed. You'll be asked for consent before it starts.
${input.expiresAt ? `• This link expires on ${input.expiresAt.toUTCString()}.\n` : ""}
Start your interview: ${input.link}

This link is personal to you — please don't share it. Questions? Just reply to this email.

${input.companyName} hiring team`,
    };
  },
  applicationReceived(input: { candidateName: string; jobTitle: string; companyName: string }) {
    return {
      subject: `We received your application — ${input.jobTitle}`,
      text: `Hi ${input.candidateName},

Thank you for applying for the ${input.jobTitle} role at ${input.companyName}. We've received your application and resume.

Our hiring team reviews every application. If your background is a match, we'll email you an invitation to the next step. Questions? Just reply to this email.

${input.companyName} hiring team`,
    };
  },
  reminder(input: { candidateName: string; jobTitle: string; companyName: string; link: string; roundName?: string | null }) {
    return {
      subject: `Reminder: your ${input.roundName ? `${input.roundName} ` : ""}interview for ${input.jobTitle}`,
      text: `Hi ${input.candidateName},

This is a friendly reminder that your ${input.roundName ? `${input.roundName} ` : ""}AI interview for the ${input.jobTitle} role at ${input.companyName} is still waiting for you.

Start when you're ready: ${input.link}

Questions? Just reply to this email.

${input.companyName} hiring team`,
    };
  },
  completed(input: { candidateName: string; jobTitle: string; link: string }) {
    return {
      subject: `${input.candidateName} completed their interview`,
      text: `${input.candidateName} has completed the AI interview for ${input.jobTitle}.\n\nThe report will be ready shortly: ${input.link}`,
    };
  },
  teamInvite(input: { orgName: string; inviter: string; role: string; link: string }) {
    return {
      subject: `You've been invited to ${input.orgName}`,
      text: `${input.inviter} invited you to join ${input.orgName} as ${input.role}.\n\nAccept the invitation: ${input.link}\n\nThis link expires in 7 days.`,
    };
  },
  humanInterview(input: {
    kind: "invite" | "rescheduled" | "cancelled"; name: string; jobTitle: string; companyName: string; roundName: string;
    when: string; where: string; with: string; message: string | null; reason: string | null; link?: string; team?: boolean;
  }) {
    const what = input.team ? `${input.roundName} interview with ${input.with} (${input.jobTitle})` : `${input.roundName} interview for ${input.jobTitle} at ${input.companyName}`;
    const subject = input.kind === "cancelled" ? `Cancelled: ${what}` : input.kind === "rescheduled" ? `New time: ${what}` : input.team ? `You're interviewing: ${what}` : `Interview invitation: ${what}`;
    const lead = input.kind === "cancelled" ? `The ${what} has been cancelled.${input.reason ? `\nReason: ${input.reason}` : ""}`
      : input.kind === "rescheduled" ? `The ${what} has moved to a new time.${input.reason ? `\nReason: ${input.reason}` : ""}`
      : input.team ? `You're on the panel for the ${what}.` : `${input.companyName} would like to invite you to the ${input.roundName} interview for the ${input.jobTitle} role.`;
    const details = input.kind === "cancelled" ? "" : `\n\nWhen: ${input.when}\nWhere: ${input.where}\nWith: ${input.with}${input.message ? `\n\n${input.message}` : ""}`;
    const calendar = input.kind === "cancelled" ? "\n\nThe attached calendar update removes it from your calendar." : "\n\nOpen the attached invite (invite.ics) to add it to your calendar.";
    const tail = input.team && input.link ? `\n\nInterview guide and scorecard: ${input.link}` : input.kind === "cancelled" ? "" : "\n\nIf this time doesn't work for you, please reply to let us know.";
    return { subject, text: `Hi ${input.name},\n\n${lead}${details}${calendar}${tail}\n\n${input.companyName}` };
  },
  supportToAdmin(input: { kind: "new" | "reply"; company: string; name: string; email: string; category?: string; subject: string; message: string; link: string }) {
    return {
      subject: input.kind === "new" ? `Support: ${input.subject} (${input.company})` : `Re: ${input.subject} (${input.company})`,
      text: `${input.kind === "new" ? `New support request${input.category ? ` (${input.category})` : ""}` : "New reply on a support request"} from ${input.name} <${input.email}>, ${input.company}.

${input.message}

Open in admin: ${input.link}`,
    };
  },
  supportReply(input: { name: string; subject: string; message: string; link: string }) {
    return {
      subject: `Re: ${input.subject}`,
      text: `Hi ${input.name},

PickMyHire.ai support replied to your request "${input.subject}":

${input.message}

View the conversation or reply: ${input.link}

PickMyHire.ai support`,
    };
  },
  verifyEmail(input: { name: string; link: string }) {
    return {
      subject: "Confirm your email to start your PickMyHire.ai trial",
      text: `Hi ${input.name},\n\nConfirm your email to start inviting candidates to AI interviews (link valid for 3 days):\n${input.link}\n\nIf you didn't sign up for PickMyHire.ai, you can ignore this email.`,
    };
  },
  passwordReset(input: { link: string }) {
    return {
      subject: "Reset your password",
      text: `We received a request to reset your password.\n\nReset it here (valid for 1 hour): ${input.link}\n\nIf you didn't request this, you can ignore this email.`,
    };
  },
};
