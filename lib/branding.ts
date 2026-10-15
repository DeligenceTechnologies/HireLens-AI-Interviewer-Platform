// Company branding for candidate-facing pages (shared by server and client).

export type Brand = {
  /** Company name, shown when there's no logo. */
  name: string;
  logoUrl: string | null;
  /** Lowercase #rrggbb, or null for the default colour. */
  color: string | null;
};

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;

export function isHexColor(v: string): boolean {
  return /^#[0-9a-f]{6}$/.test(v);
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** White or near-black text, whichever reads better on the brand colour. */
export function readableTextColor(hex: string): "#ffffff" | "#0b0f19" {
  const l = luminance(hex);
  const onWhite = 1.05 / (l + 0.05);
  const onDark = (l + 0.05) / (luminance("#0b0f19") + 0.05);
  return onWhite >= onDark ? "#ffffff" : "#0b0f19";
}

/** CSS variables that recolour primary buttons and accents on candidate pages. */
export function brandStyle(color: string | null): React.CSSProperties | undefined {
  if (!color) return undefined;
  return { "--primary": color, "--primary-foreground": readableTextColor(color), "--ring": color } as React.CSSProperties;
}

export function logoUrl(orgId: string, updatedAt: Date | string | null, path: string | null): string | null {
  if (!path || !updatedAt) return null;
  return `/api/public/logo/${orgId}?v=${new Date(updatedAt).getTime()}`;
}
