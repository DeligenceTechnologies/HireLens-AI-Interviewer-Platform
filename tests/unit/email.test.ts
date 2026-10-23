import { describe, expect, it } from "vitest";
import { resendPayload } from "@/lib/email";

describe("resend payload", () => {
  it("adds reply-to and base64 attachments only when given", () => {
    expect(resendPayload({ to: "a@x.test", subject: "Hi", text: "Body" }, "PickMyHire.ai <noreply@pickmyhire.ai>"))
      .toEqual({ from: "PickMyHire.ai <noreply@pickmyhire.ai>", to: "a@x.test", subject: "Hi", text: "Body" });

    const ics = "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n";
    const p = resendPayload({
      to: "a@x.test", subject: "Hi", text: "Body", replyTo: "Rita Recruiter <rita@acme.test>",
      attachments: [{ filename: "invite.ics", content: ics, contentType: "text/calendar; charset=utf-8; method=REQUEST" }],
    }, "PickMyHire.ai <noreply@pickmyhire.ai>");
    expect(p.reply_to).toBe("Rita Recruiter <rita@acme.test>");
    expect(p.attachments).toEqual([{ filename: "invite.ics", content: Buffer.from(ics).toString("base64"), content_type: "text/calendar; charset=utf-8; method=REQUEST" }]);
  });
});
