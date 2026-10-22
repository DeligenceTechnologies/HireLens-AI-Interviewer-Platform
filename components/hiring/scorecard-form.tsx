"use client";

import { useState } from "react";
import { Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/lib/client/use-action";
import { DECISION_LABEL, DECISIONS, type Decision } from "@/lib/hiring";
import { cn } from "@/lib/utils";

type Rating = { criterion: string; rating: number | null; comment?: string | null };
const RATING_LABEL = ["", "Poor", "Below expectations", "Meets expectations", "Strong", "Exceptional"];

export function Stars({ value, onChange, label }: { value: number | null; onChange?: (n: number) => void; label: string }) {
  return (
    <div className="flex items-center gap-0.5" role={onChange ? "radiogroup" : undefined} aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = value !== null && n <= value;
        const star = <Star className={cn("size-5", on ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")} />;
        return onChange ? (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n}: ${RATING_LABEL[n]}`} title={RATING_LABEL[n]} onClick={() => onChange(n)} className="rounded p-0.5 hover:bg-muted">{star}</button>
        ) : <span key={n}>{star}</span>;
      })}
      {value !== null && <span className="ml-1.5 text-xs text-muted-foreground">{RATING_LABEL[value]}</span>}
    </div>
  );
}

/** The signed-in interviewer's scorecard: a rating per skill, notes and a recommendation. */
export function ScorecardForm({ id, criteria, initial, submitted }: {
  id: string; criteria: string[]; submitted: boolean;
  initial: { ratings: Rating[]; notes: string | null; recommendation: Decision | null } | null;
}) {
  const { run, pending } = useAction();
  const [ratings, setRatings] = useState<Rating[]>(() => criteria.map((c) => initial?.ratings.find((r) => r.criterion === c) ?? { criterion: c, rating: null, comment: "" }));
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [rec, setRec] = useState<Decision | null>(initial?.recommendation ?? null);
  const set = (i: number, patch: Partial<Rating>) => setRatings((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const save = (submit: boolean) => run(submit ? "submit" : "save", `/api/human-interviews/${id}/scorecard`, {
    method: "PUT", body: { ratings, notes: notes.trim() || null, recommendation: rec, submit }, success: submit ? "Scorecard submitted" : "Draft saved",
  });
  const complete = ratings.every((r) => r.rating !== null) && !!rec;
  return (
    <div className="space-y-5">
      <ul className="space-y-4">
        {ratings.map((r, i) => (
          <li key={r.criterion} className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">{r.criterion}<span aria-hidden="true" className="ml-0.5 text-destructive">*</span></p>
              <Stars value={r.rating} onChange={(n) => set(i, { rating: n })} label={`Rating for ${r.criterion}`} />
            </div>
            <Input aria-label={`Comment on ${r.criterion}`} value={r.comment ?? ""} maxLength={1000} onChange={(e) => set(i, { comment: e.target.value })} placeholder="What did you see? (optional)" />
          </li>
        ))}
      </ul>
      <div className="space-y-1.5">
        <Label htmlFor="sc-notes">Overall notes <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Textarea id="sc-notes" rows={4} maxLength={5000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Strengths, concerns, anything the team should know" />
      </div>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Your recommendation<span aria-hidden="true" className="ml-0.5 text-destructive">*</span></legend>
        <div className="flex flex-wrap gap-2">
          {DECISIONS.map((d) => (
            <button key={d} type="button" onClick={() => setRec(d)} aria-pressed={rec === d}
              className={cn("rounded-lg border px-3 py-1.5 text-sm", rec === d ? "border-primary bg-primary/5 font-medium text-primary" : "hover:bg-muted")}>{DECISION_LABEL[d]}</button>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={!!pending || !complete} onClick={() => save(true)}>{pending === "submit" && <Loader2 className="animate-spin" />} {submitted ? "Update scorecard" : "Submit scorecard"}</Button>
        {!submitted && <Button variant="outline" disabled={!!pending} onClick={() => save(false)}>{pending === "save" && <Loader2 className="animate-spin" />} Save draft</Button>}
        {!complete && <p className="text-xs text-muted-foreground">Rate every skill and choose a recommendation to submit.</p>}
      </div>
    </div>
  );
}
