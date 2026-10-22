import { cn } from "@/lib/utils";

type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "brand";

const toneClass: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground ring-border",
  info: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:ring-sky-900",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900",
  warning: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900",
  danger: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950 dark:text-red-300 dark:ring-red-900",
  brand: "bg-accent text-accent-foreground ring-primary/20",
};

const STATUS: Record<string, { label: string; tone: Tone }> = {
  // interviews
  created: { label: "Created", tone: "neutral" },
  invited: { label: "Invited", tone: "info" },
  consent_pending: { label: "Opened", tone: "info" },
  device_check: { label: "Device check", tone: "info" },
  ready: { label: "Ready", tone: "info" },
  in_progress: { label: "In progress", tone: "brand" },
  completing: { label: "Finishing", tone: "brand" },
  completed: { label: "Completed", tone: "success" },
  processing: { label: "Processing", tone: "warning" },
  report_ready: { label: "Report ready", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  expired: { label: "Expired", tone: "neutral" },
  failed: { label: "Failed", tone: "danger" },
  // human interviews
  scheduled: { label: "Scheduled", tone: "info" },
  no_show: { label: "No-show", tone: "warning" },
  // jobs
  draft: { label: "Draft", tone: "neutral" },
  active: { label: "Active", tone: "success" },
  paused: { label: "Paused", tone: "warning" },
  closed: { label: "Closed", tone: "neutral" },
  // processing
  pending: { label: "Pending", tone: "neutral" },
  // sections
  skipped: { label: "Skipped", tone: "neutral" },
};

export function StatusBadge({ status, className, label }: { status: string; className?: string; label?: string }) {
  const s = STATUS[status] ?? { label: status.replace(/_/g, " "), tone: "neutral" as Tone };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap", toneClass[s.tone], className)}>
      <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {label ?? s.label}
    </span>
  );
}

const ASSESS: Record<string, { label: string; tone: Tone }> = {
  very_strong: { label: "Very strong", tone: "success" },
  strong: { label: "Strong", tone: "success" },
  adequate: { label: "Adequate", tone: "info" },
  limited: { label: "Limited", tone: "warning" },
  insufficient_evidence: { label: "Insufficient evidence", tone: "neutral" },
};

export function AssessmentBadge({ assessment, score, showScore }: { assessment: string | null | undefined; score?: number | null; showScore?: boolean }) {
  if (!assessment) return <span className="text-xs text-muted-foreground">Not assessed</span>;
  const a = ASSESS[assessment] ?? { label: assessment, tone: "neutral" as Tone };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap", toneClass[a.tone])}>
      {a.label}
      {showScore && score != null && <span className="tabular opacity-70">· {score}/5</span>}
    </span>
  );
}
