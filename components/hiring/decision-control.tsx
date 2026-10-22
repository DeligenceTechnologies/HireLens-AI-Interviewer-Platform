"use client";

import { useState } from "react";
import { Check, Loader2, Pause, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/lib/client/use-action";
import { DECISION_LABEL, DECISIONS, type Decision } from "@/lib/hiring";
import { cn } from "@/lib/utils";
import { DecisionBadge } from "./badges";

const ICON = { qualified: Check, not_qualified: X, on_hold: Pause } as const;
const ACTIVE: Record<Decision, string> = {
  qualified: "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-600/90",
  not_qualified: "border-red-600 bg-red-600 text-white hover:bg-red-600/90",
  on_hold: "border-amber-500 bg-amber-500 text-white hover:bg-amber-500/90",
};

/** The team's decision on one interview round. The AI report and scorecards are advice; this is the call. */
export function DecisionControl({ endpoint, decision, note, decidedBy, decidedOn, canEdit, hint }: {
  /** `decidedOn` is already formatted by the server (avoids time-zone differences while hydrating). */
  endpoint: string; decision: Decision | null; note: string | null; decidedBy: string | null; decidedOn: string | null; canEdit: boolean;
  /** e.g. "2 of 2 interviewers recommend Qualified" */
  hint?: string | null;
}) {
  const { run, pending } = useAction();
  const [choice, setChoice] = useState<Decision | null>(null);
  const [text, setText] = useState("");
  const save = async (d: Decision | null, n: string | null) => {
    const ok = await run("decide", endpoint, { body: { decision: d, note: n }, success: d ? `Marked ${DECISION_LABEL[d]}` : "Decision cleared" });
    if (ok) setChoice(null);
  };
  return (
    <div className="space-y-3">
      {decision ? (
        <div className="space-y-1">
          <DecisionBadge decision={decision} className="text-sm" />
          <p className="text-xs text-muted-foreground">{[decidedBy && `by ${decidedBy}`, decidedOn].filter(Boolean).join(" · ")}</p>
          {note && <p className="rounded-md bg-muted/60 px-2.5 py-1.5 text-sm">{note}</p>}
        </div>
      ) : <p className="text-sm text-muted-foreground">No decision yet.</p>}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          {DECISIONS.map((d) => {
            const Icon = ICON[d];
            return (
              <Button key={d} size="sm" variant="outline" disabled={!!pending} className={cn(decision === d && ACTIVE[d])}
                onClick={() => { setText(decision === d ? note ?? "" : ""); setChoice(d); }} aria-pressed={decision === d}>
                <Icon /> {DECISION_LABEL[d]}
              </Button>
            );
          })}
          {decision && <Button size="sm" variant="ghost" disabled={!!pending} onClick={() => save(null, null)}>Clear</Button>}
        </div>
      )}
      <Dialog open={!!choice} onOpenChange={(o) => !o && setChoice(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark this round {choice ? DECISION_LABEL[choice] : ""}?</DialogTitle>
            <DialogDescription>Your team sees the decision on the candidate&apos;s profile and the job pipeline.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="decision-note">Note <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Textarea id="decision-note" rows={3} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Strong on APIs, needs to go deeper on system design" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChoice(null)}>Cancel</Button>
            <Button disabled={!!pending} onClick={() => choice && save(choice, text.trim() || null)}>{pending && <Loader2 className="animate-spin" />} Save decision</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
