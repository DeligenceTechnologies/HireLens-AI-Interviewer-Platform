import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { StatusBadge } from "@/components/common/status-badge";
import { formatDuration, timeAgo } from "@/lib/format";
import type { InterviewListRow } from "@/lib/services/interviews";

/** "Screening", or "Screening · attempt 2" for a repeat. */
export function roundLabel(r: { round_name: string | null; attempt: number }) {
  return r.round_name ? `${r.round_name}${r.attempt > 1 ? ` · attempt ${r.attempt}` : ""}` : null;
}

export function InterviewTable({ rows, hideJob, hideCandidate, showRound }: { rows: InterviewListRow[]; hideJob?: boolean; hideCandidate?: boolean; showRound?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40 text-left text-xs font-medium text-muted-foreground">
          <tr>
            {!hideCandidate && <th className="px-4 py-2.5 font-medium">Candidate</th>}
            {!hideJob && <th className="px-4 py-2.5 font-medium">Job</th>}
            {showRound && <th className="px-4 py-2.5 font-medium">Round</th>}
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 font-medium">Duration</th>
            <th className="px-4 py-2.5 text-right font-medium">Last activity</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={r.id} className="group relative hover:bg-muted/40">
              {!hideCandidate && (
                <td className="px-4 py-3">
                  <Link href={`/interviews/${r.id}`} className="font-medium after:absolute after:inset-0 group-hover:text-primary">{r.candidate_name}</Link>
                  <p className="text-xs text-muted-foreground">{r.candidate_email}</p>
                </td>
              )}
              {!hideJob && (
                <td className="px-4 py-3">
                  {hideCandidate ? <Link href={`/interviews/${r.id}`} className="font-medium after:absolute after:inset-0 group-hover:text-primary">{r.job_title}</Link> : r.job_title}
                  {!showRound && roundLabel(r) && <p className="text-xs text-muted-foreground">{roundLabel(r)}</p>}
                </td>
              )}
              {showRound && <td className="px-4 py-3 text-muted-foreground">{roundLabel(r) ?? "—"}</td>}
              <td className="px-4 py-3">
                <span className="flex items-center gap-2">
                  <StatusBadge status={r.status} />
                  {r.issue_count > 0 && (
                    <span title={`Candidate reported ${r.issue_count === 1 ? "an issue" : `${r.issue_count} issues`}`} className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
                      <AlertTriangle className="size-3.5" /> Issue
                    </span>
                  )}
                </span>
              </td>
              <td className="px-4 py-3 tabular text-muted-foreground">{formatDuration(r.duration_seconds)}</td>
              <td className="px-4 py-3 text-right text-muted-foreground">{timeAgo(r.completed_at ?? r.started_at ?? r.invited_at ?? r.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
