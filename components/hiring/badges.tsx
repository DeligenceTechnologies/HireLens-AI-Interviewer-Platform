import { Check, CircleDashed, Clock3, Pause, X } from "lucide-react";
import { DECISION_LABEL, STAGE_LABEL, type Decision, type Stage } from "@/lib/hiring";
import { cn } from "@/lib/utils";

const DECISION_CLASS: Record<Decision, string> = {
  qualified: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900",
  not_qualified: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950 dark:text-red-300 dark:ring-red-900",
  on_hold: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900",
};
const DECISION_ICON = { qualified: Check, not_qualified: X, on_hold: Pause } as const;

export function DecisionBadge({ decision, className }: { decision: Decision; className?: string }) {
  const Icon = DECISION_ICON[decision];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap", DECISION_CLASS[decision], className)}>
      <Icon className="size-3" aria-hidden />{DECISION_LABEL[decision]}
    </span>
  );
}

const STAGE_CLASS: Record<Stage, string> = {
  in_progress: "bg-muted text-muted-foreground ring-border",
  shortlisted: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:ring-sky-900",
  hired: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900",
  rejected: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950 dark:text-red-300 dark:ring-red-900",
  withdrawn: "bg-muted text-muted-foreground ring-border",
};

export function StageBadge({ stage, className }: { stage: Stage; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset whitespace-nowrap", STAGE_CLASS[stage], className)}>{STAGE_LABEL[stage]}</span>;
}

/** Compact round result for tables: ✓ qualified, ✗ not, ⏸ on hold, ⏳ waiting, ○ not started. */
export function RoundChip({ name, decision, state }: { name: string; decision: Decision | null; state: "none" | "waiting" | "done" }) {
  const label = decision ? DECISION_LABEL[decision] : state === "waiting" ? "In progress" : state === "done" ? "Awaiting decision" : "Not started";
  const Icon = decision ? DECISION_ICON[decision] : state === "none" ? CircleDashed : Clock3;
  return (
    <span title={`${name}: ${label}`} aria-label={`${name}: ${label}`}
      className={cn("inline-flex size-6 items-center justify-center rounded-full ring-1 ring-inset", decision ? DECISION_CLASS[decision] : state === "done" ? "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:ring-violet-900" : "bg-muted text-muted-foreground ring-border")}>
      <Icon className="size-3.5" />
    </span>
  );
}
