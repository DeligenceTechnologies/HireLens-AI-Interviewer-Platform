import Link from "next/link";
import { cn } from "@/lib/utils";

/** Server-rendered filter tabs driven by a query param. */
export function FilterTabs({ base, param, current, tabs }: { base: string; param: string; current: string; tabs: { value: string; label: string; count?: number }[] }) {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto border-b">
      {tabs.map((t) => {
        const active = current === t.value;
        const href = t.value === tabs[0].value ? base : `${base}?${param}=${t.value}`;
        return (
          <Link key={t.value} href={href} aria-current={active ? "page" : undefined}
            className={cn("-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap", active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}{t.count != null && <span className="ml-1.5 text-xs text-muted-foreground tabular">{t.count}</span>}
          </Link>
        );
      })}
    </div>
  );
}
