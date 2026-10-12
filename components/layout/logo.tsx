import Image from "next/image";
import logoCompact from "@/public/brand/deliberatehire-logo-compact.png";
import logoLight from "@/public/brand/deliberatehire-logo-compact-light.png";

export const PRODUCT_NAME = "DeliberateHire AI";

/**
 * `compact` is the single-line mark + wordmark used across the product.
 * `light` is the same logo in white, for dark backgrounds.
 */
export function Logo({
  className = "",
  height = 28,
  variant = "compact",
}: {
  className?: string;
  height?: number;
  variant?: "compact" | "light";
}) {
  return (
    <Image
      src={variant === "light" ? logoLight : logoCompact}
      alt={PRODUCT_NAME}
      priority
      style={{ height, width: "auto" }}
      className={className}
    />
  );
}

const COPYRIGHT = `© ${new Date().getFullYear()} Deligence Technologies. All rights reserved.`;

export function Copyright({ className = "" }: { className?: string }) {
  return <p className={`text-xs text-muted-foreground ${className}`}>{COPYRIGHT}</p>;
}
