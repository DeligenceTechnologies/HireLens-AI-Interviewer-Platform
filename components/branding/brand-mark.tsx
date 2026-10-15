import type { Brand } from "@/lib/branding";
import { cn } from "@/lib/utils";

/**
 * The hiring company's logo on candidate pages, or its name when there's no logo.
 * `onDark` puts the logo on a white badge so dark logos stay visible.
 */
export function BrandMark({ brand, height = 32, onDark, className, nameClassName }: {
  brand: Brand; height?: number; onDark?: boolean; className?: string; nameClassName?: string;
}) {
  if (!brand.logoUrl) return <span className={cn("font-semibold", nameClassName)}>{brand.name}</span>;
  const img = (
    // A plain <img>: logos come from our own versioned route and vary in shape.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={brand.logoUrl} alt={brand.name} style={{ height, width: "auto", maxWidth: height * 5 }} className="object-contain" />
  );
  return onDark
    ? <span className={cn("inline-flex items-center rounded-lg bg-white px-2.5 py-1.5", className)}>{img}</span>
    : <span className={cn("inline-flex items-center", className)}>{img}</span>;
}
