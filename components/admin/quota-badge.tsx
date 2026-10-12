import { cn } from "@/lib/utils";

/** "2 / 3 used" with state colour: unlimited, ok, 1 left, none left. */
export function QuotaBadge({ quota, used, inProgress }: { quota: number | null; used: number; inProgress: number }) {
  if (quota === null) return <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">Unlimited · {used} used</span>;
  const left = Math.max(0, quota - used - inProgress);
  return (
    <span className={cn(
      "rounded-full px-2 py-0.5 text-xs font-medium tabular whitespace-nowrap",
      left === 0 ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
        : left === 1 ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    )}>
      {used} / {quota} used{inProgress ? ` · ${inProgress} in progress` : ""}
    </span>
  );
}

export function CompanyStatusBadge({ status }: { status: "active" | "suspended" }) {
  return status === "active"
    ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Active</span>
    : <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950 dark:text-red-300">Suspended</span>;
}
