import Link from "next/link";
import { UserRound } from "lucide-react";
import { formatInZone, LOCATION_LABEL } from "@/lib/hiring";
import type { HumanListRow } from "@/lib/services/human-interviews";

/** Dashboard card: upcoming human interviews and scorecards still to fill in. */
export function UpcomingHumanInterviews({ rows }: { rows: HumanListRow[] }) {
  if (!rows.length) return null;
  return (
    <section className="mb-6 rounded-xl border bg-card">
      <h2 className="flex items-center gap-2 border-b px-5 py-4 font-semibold"><UserRound className="size-4 text-primary" /> Human interviews</h2>
      <ul className="divide-y">
        {rows.map((r) => {
          const needsScorecard = r.on_panel && !r.my_scorecard_submitted && (r.status === "completed" || r.is_past);
          return (
            <li key={r.id}>
              <Link href={`/interviews/human/${r.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-muted/40">
                <div className="w-44 shrink-0 text-sm font-medium tabular">{formatInZone(r.scheduled_at, r.timezone)}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{r.candidate_name} · {r.round_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{r.job_title} · {LOCATION_LABEL[r.location_type]}</p>
                </div>
                {needsScorecard ? <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:ring-violet-900">Your scorecard is needed</span>
                  : r.on_panel ? <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 ring-1 ring-inset ring-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:ring-sky-900">You&apos;re interviewing</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
