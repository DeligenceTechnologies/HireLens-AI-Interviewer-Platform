import { cn } from "@/lib/utils";

type Status = "open" | "in_progress" | "resolved";
const STATUS: Record<Status, { label: string; cls: string }> = {
  open: { label: "Open", cls: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" },
  in_progress: { label: "In progress", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  resolved: { label: "Resolved", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
};

export function SupportStatusBadge({ status, className }: { status: Status; className?: string }) {
  return <span className={cn("inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", STATUS[status].cls, className)}>{STATUS[status].label}</span>;
}
