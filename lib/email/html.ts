// Branded HTML version of an email, built from its plain-text body so the two
// always say the same thing. Table layout and inline styles only: that's what
// Gmail, Outlook and Apple Mail render reliably. One small logo, no other images.

import { readableTextColor } from "@/lib/branding";

export type EmailBrand = {
  /** Company or product name, shown as text when there's no logo and in the footer. */
  name: string;
  /** Absolute https URL of a raster logo (PNG/JPG/WebP), or null. */
  logoUrl: string | null;
  /** #rrggbb accent for the top bar and button, or null for the default blue. */
  color: string | null;
  /** True for a hiring company (adds "via PickMyHire.ai" to the footer). */
  company?: boolean;
};
export type EmailCta = { label: string; url: string };

const DEFAULT_COLOR = "#0b5bd3";
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Escape a line of text, turn bare links into links, and bold a short "Label:" prefix. */
function inline(line: string, color: string) {
  const parts = line.split(/(https?:\/\/[^\s<>"]+)/g);
  let html = parts.map((p, i) => (i % 2
    ? `<a href="${esc(p)}" style="color:${color};text-decoration:underline;word-break:break-all;">${esc(p)}</a>`
    : esc(p))).join("");
  const label = /^([A-Z][A-Za-z ]{1,20}):\s/.exec(line);
  if (label) html = `<strong style="color:#0f1f3a;">${esc(label[1])}:</strong>${html.slice(esc(label[1]).length + 1)}`;
  return html;
}

function button(cta: EmailCta, color: string) {
  const fg = readableTextColor(color);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 6px;"><tr>
<td style="border-radius:10px;background:${color};">
<a href="${esc(cta.url)}" style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:15px;font-weight:600;color:${fg};text-decoration:none;border-radius:10px;">${esc(cta.label)}</a>
</td></tr></table>
<p style="margin:0 0 18px;font-family:${FONT};font-size:12px;line-height:18px;color:#7a8aa6;">Or copy this link: <a href="${esc(cta.url)}" style="color:#7a8aa6;word-break:break-all;">${esc(cta.url)}</a></p>`;
}

export function renderEmailHtml(input: { subject: string; text: string; brand: EmailBrand; cta?: EmailCta | null }) {
  const color = input.brand.color ?? DEFAULT_COLOR;
  const blocks = input.text.replace(/\r\n/g, "\n").trim().split(/\n{2,}/);
  let ctaShown = false;
  const body = blocks.map((block) => {
    const lines = block.split("\n");
    // The line that carries the main link becomes the button (a "Where:" detail line stays, so the place is still listed).
    if (input.cta && !ctaShown && lines.some((l) => l.includes(input.cta!.url))) {
      ctaShown = true;
      const rest = lines.filter((l) => !l.includes(input.cta!.url) || l.startsWith("Where:"));
      return (rest.length ? para(rest, color) : "") + button(input.cta, color);
    }
    if (lines.every((l) => l.startsWith("• "))) {
      return `<ul style="margin:0 0 18px;padding-left:20px;font-family:${FONT};font-size:15px;line-height:24px;color:#3d4d6a;">${lines.map((l) => `<li style="margin:0 0 4px;">${inline(l.slice(2), color)}</li>`).join("")}</ul>`;
    }
    return para(lines, color);
  }).join("\n") + (input.cta && !ctaShown ? button(input.cta, color) : "");

  const header = input.brand.logoUrl
    ? `<img src="${esc(input.brand.logoUrl)}" alt="${esc(input.brand.name)}" height="36" style="display:block;height:36px;width:auto;max-width:220px;border:0;outline:none;font-family:${FONT};font-size:18px;font-weight:700;color:#0f1f3a;">`
    : `<span style="font-family:${FONT};font-size:20px;font-weight:700;color:#0f1f3a;">${esc(input.brand.name)}</span>`;
  const footer = input.brand.company
    ? `Sent by ${esc(input.brand.name)} via PickMyHire.ai`
    : "PickMyHire.ai · AI video interviews with evidence you can verify";
  const preheader = blocks.find((b) => !/^(Hi|Hello)\b/.test(b))?.replace(/\s+/g, " ").slice(0, 140) ?? "";

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${esc(input.subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f6fa;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f4f6fa;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f6fa;"><tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid #e3eaf5;border-radius:14px;overflow:hidden;">
<tr><td style="height:4px;line-height:4px;font-size:0;background:${color};">&nbsp;</td></tr>
<tr><td style="padding:26px 32px 6px;">${header}</td></tr>
<tr><td style="padding:18px 32px 14px;">${body}</td></tr>
</table>
<p style="margin:16px 0 0;font-family:${FONT};font-size:12px;line-height:18px;color:#8a98b2;">${footer}</p>
</td></tr></table>
</body></html>`;
}

function para(lines: string[], color: string) {
  return `<p style="margin:0 0 18px;font-family:${FONT};font-size:15px;line-height:24px;color:#3d4d6a;">${lines.map((l) => inline(l, color)).join("<br>")}</p>`;
}
