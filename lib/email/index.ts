import "server-only";
import { env } from "@/lib/env";
import { withSystem } from "@/lib/database/db";
import { log } from "@/lib/logger";

export type EmailMessage = { to: string; subject: string; text: string; orgId?: string | null };

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

const resendProvider: EmailProvider = {
  name: "resend",
  async send(msg) {
    const e = env();
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${e.EMAIL_PROVIDER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: e.EMAIL_FROM, to: msg.to, subject: msg.subject, text: msg.text }),
    });
    if (!res.ok) throw new Error(`Email provider returned ${res.status}`);
  },
};

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
  await withSystem((tx) => tx`
    insert into email_outbox (organization_id, to_email, subject, body_text, provider, status, error)
    values (${msg.orgId ?? null}, ${msg.to}, ${msg.subject}, ${msg.text}, ${p.name}, ${status}, ${error})`);
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

This link is personal to you — please don't share it.

${input.companyName} hiring team`,
    };
  },
  applicationReceived(input: { candidateName: string; jobTitle: string; companyName: string }) {
    return {
      subject: `We received your application — ${input.jobTitle}`,
      text: `Hi ${input.candidateName},

Thank you for applying for the ${input.jobTitle} role at ${input.companyName}. We've received your application and resume.

Our hiring team reviews every application. If your background is a match, we'll email you an invitation to the next step.

${input.companyName} hiring team`,
    };
  },
  reminder(input: { candidateName: string; jobTitle: string; companyName: string; link: string; roundName?: string | null }) {
    return {
      subject: `Reminder: your ${input.roundName ? `${input.roundName} ` : ""}interview for ${input.jobTitle}`,
      text: `Hi ${input.candidateName},

This is a friendly reminder that your ${input.roundName ? `${input.roundName} ` : ""}AI interview for the ${input.jobTitle} role at ${input.companyName} is still waiting for you.

Start when you're ready: ${input.link}

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
    const tail = input.team && input.link ? `\n\nInterview guide and scorecard: ${input.link}` : input.kind === "cancelled" ? "" : "\n\nIf this time doesn't work for you, please reply to let us know.";
    return { subject, text: `Hi ${input.name},\n\n${lead}${details}${tail}\n\n${input.companyName}` };
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
