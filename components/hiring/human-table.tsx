import Link from "next/link";
import { StatusBadge } from "@/components/common/status-badge";
import { formatInZone } from "@/lib/hiring";
import type { HumanTableRow } from "@/lib/services/human-interviews";
import { DecisionBadge } from "./badges";

/** Human interviews list: when, who, status, scorecards and the round decision. */
export function HumanInterviewTable({ rows, showEmail }: { rows: HumanTableRow[]; showEmail: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-sm">
        <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">Candidate</th><th className="px-4 py-2.5 font-medium">Job · round</th><th className="px-4 py-2.5 font-medium">When</th>
            <th className="px-4 py-2.5 font-medium">Interviewers</th><th className="px-4 py-2.5 font-medium">Status</th><th className="px-4 py-2.5 font-medium">Scorecards</th><th className="px-4 py-2.5 font-medium">Decision</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={r.id} className="group relative hover:bg-muted/40">
              <td className="px-4 py-3">
                <Link href={`/interviews/human/${r.id}`} className="font-medium after:absolute after:inset-0 group-hover:text-primary">{r.candidate_name}</Link>
                {showEmail && <p className="text-xs text-muted-foreground">{r.candidate_email}</p>}
              </td>
              <td className="px-4 py-3"><p>{r.job_title}</p><p className="text-xs text-muted-foreground">{r.round_name}{r.attempt > 1 ? ` · attempt ${r.attempt}` : ""}</p></td>
              <td className="px-4 py-3 whitespace-nowrap">{formatInZone(r.scheduled_at, r.timezone)}</td>
              <td className="px-4 py-3 text-muted-foreground">{r.interviewers}</td>
              <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
              <td className="px-4 py-3 tabular text-muted-foreground">{r.status === "cancelled" ? "—" : `${r.scorecards} / ${r.panel_size}`}</td>
              <td className="px-4 py-3">{r.decision ? <DecisionBadge decision={r.decision} /> : <span className="text-xs text-muted-foreground">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
