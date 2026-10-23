// Minimal iCalendar (RFC 5545) event for interview invites. Opening the file
// adds the event to Google Calendar, Outlook or Apple Calendar; a newer
// SEQUENCE with the same UID updates it, METHOD:CANCEL removes it.

const pad = (n: number) => String(n).padStart(2, "0");
const stamp = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Lines longer than 75 octets are folded with CRLF + space. */
function fold(line: string) {
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest) > 75) {
    let cut = 75;
    while (Buffer.byteLength(rest.slice(0, cut)) > 75) cut--;
    out.push(rest.slice(0, cut));
    rest = " " + rest.slice(cut);
  }
  out.push(rest);
  return out.join("\r\n");
}

export function buildIcs(e: { uid: string; sequence: number; method: "REQUEST" | "CANCEL"; start: Date; minutes: number; title: string; description: string; location: string; now?: Date }) {
  const end = new Date(e.start.getTime() + e.minutes * 60_000);
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//PickMyHire.ai//Interviews//EN", "CALSCALE:GREGORIAN", `METHOD:${e.method}`,
    "BEGIN:VEVENT",
    `UID:${e.uid}`, `SEQUENCE:${e.sequence}`, `DTSTAMP:${stamp(e.now ?? new Date())}`,
    `DTSTART:${stamp(e.start)}`, `DTEND:${stamp(end)}`,
    `SUMMARY:${escape(e.title)}`, `DESCRIPTION:${escape(e.description)}`, `LOCATION:${escape(e.location)}`,
    `STATUS:${e.method === "CANCEL" ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT", "END:VCALENDAR",
  ].map(fold).join("\r\n") + "\r\n";
}
