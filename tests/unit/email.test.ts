import { describe, expect, it } from "vitest";
import { resendPayload } from "@/lib/email";
import { renderEmailHtml } from "@/lib/email/html";

const brand = { name: "Acme <Robotics>", logoUrl: "https://pickmyhire.ai/api/public/logo/abc?v=1", color: "#e11d48", company: true };

describe("resend payload", () => {
  it("sends text and branded HTML, and adds reply-to and base64 attachments only when given", () => {
    const plain = resendPayload({ to: "a@x.test", subject: "Hi", text: "Body", brand }, "PickMyHire.ai <noreply@pickmyhire.ai>");
    expect(plain).toMatchObject({ from: "PickMyHire.ai <noreply@pickmyhire.ai>", to: "a@x.test", subject: "Hi", text: "Body" });
    expect(plain.html).toContain("Body");
    expect(plain).not.toHaveProperty("reply_to");
    expect(plain).not.toHaveProperty("attachments");

    const ics = "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n";
    const p = resendPayload({
      to: "a@x.test", subject: "Hi", text: "Body", brand, replyTo: "Rita Recruiter <rita@acme.test>",
      attachments: [{ filename: "invite.ics", content: ics, contentType: "text/calendar; charset=utf-8; method=REQUEST" }],
    }, "PickMyHire.ai <noreply@pickmyhire.ai>");
    expect(p.reply_to).toBe("Rita Recruiter <rita@acme.test>");
    expect(p.attachments).toEqual([{ filename: "invite.ics", content: Buffer.from(ics).toString("base64"), content_type: "text/calendar; charset=utf-8; method=REQUEST" }]);
  });
});

describe("branded HTML email", () => {
  const link = "https://pickmyhire.ai/interview/tok123";
  const text = `Hi Priya,\n\nAcme invited you.\n\n• Approximate duration: 30 minutes\n• Bring <headphones> & a quiet room\n\nStart your interview: ${link}\n\nAcme hiring team`;

  it("turns the main link into a button, keeps every line, and escapes text", () => {
    const html = renderEmailHtml({ subject: "Your interview", text, brand, cta: { label: "Start your interview", url: link } });
    expect(html).toContain(`href="${link}"`);
    expect(html).toContain(">Start your interview</a>");
    expect(html).not.toContain("Start your interview: "); // the link line became the button
    expect(html).toContain("<li");
    expect(html).toContain("Bring &lt;headphones&gt; &amp; a quiet room");
    expect(html).toContain('alt="Acme &lt;Robotics&gt;"');
    expect(html).toContain("background:#e11d48");
    expect(html).toContain("Sent by Acme &lt;Robotics&gt; via PickMyHire.ai");
    expect(Buffer.byteLength(html)).toBeLessThan(20_000); // far below Gmail's ~100 KB clipping
  });

  it("shows the company name when there's no logo, and keeps a Where: line next to the meeting button", () => {
    const meet = "https://meet.google.com/abc-defg-hij";
    const html = renderEmailHtml({
      subject: "Interview", text: `Hi Priya,\n\nWhen: Tue 11:00\nWhere: Video call: ${meet}\nWith: Daniel`,
      brand: { name: "Northwind Talent", logoUrl: null, color: null, company: true }, cta: { label: "Join the meeting", url: meet },
    });
    expect(html).not.toContain("<img");
    expect(html).toContain(">Northwind Talent</span>");
    expect(html).toContain("<strong style=\"color:#0f1f3a;\">Where:</strong>");
    expect(html).toContain(">Join the meeting</a>");
  });
});
