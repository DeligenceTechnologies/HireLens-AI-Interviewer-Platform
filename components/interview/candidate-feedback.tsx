"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, MessageSquareHeart, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/client/api";
import { ISSUE_CATEGORIES, type IssueCategory } from "@/lib/feedback";
import { cn } from "@/lib/utils";

type Mode = "feedback" | "issue";

/** Optional feedback / issue report on the candidate thank-you page. */
export function CandidateFeedback({ token }: { token: string }) {
  const [open, setOpen] = useState<Mode | null>(null);
  const [sent, setSent] = useState<Record<Mode, boolean>>({ feedback: false, issue: false });

  const done = (mode: Mode) => {
    setSent((s) => ({ ...s, [mode]: true }));
    setOpen(null);
  };

  return (
    <div className="mx-auto mt-10 max-w-lg rounded-xl border bg-card p-6 text-left">
      <p className="font-semibold">How did it go?</p>
      <p className="mt-1 text-sm text-muted-foreground">Optional. Your feedback goes to the hiring team and doesn&apos;t affect your evaluation.</p>

      {(sent.feedback || sent.issue) && (
        <div className="mt-4 space-y-2">
          {sent.feedback && <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="size-4" /> Thanks for your feedback.</p>}
          {sent.issue && <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="size-4" /> Your report was sent to the hiring team.</p>}
        </div>
      )}

      {open === null && (
        <div className="mt-4 flex flex-wrap gap-2">
          {!sent.feedback && <Button variant="outline" onClick={() => setOpen("feedback")}><MessageSquareHeart /> Share feedback</Button>}
          {!sent.issue && <Button variant="outline" onClick={() => setOpen("issue")}><AlertTriangle /> Report an issue</Button>}
        </div>
      )}
      {open === "feedback" && <FeedbackForm token={token} onCancel={() => setOpen(null)} onDone={() => done("feedback")} />}
      {open === "issue" && <IssueForm token={token} onCancel={() => setOpen(null)} onDone={() => done("issue")} />}
    </div>
  );
}

function useSubmit(token: string, onDone: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (body: unknown) => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/public/interview/${token}/feedback`, { body });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, submit };
}

function FeedbackForm({ token, onCancel, onDone }: { token: string; onCancel: () => void; onDone: () => void }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [message, setMessage] = useState("");
  const { busy, error, submit } = useSubmit(token, onDone);
  return (
    <form
      className="mt-4 space-y-4"
      onSubmit={(e) => { e.preventDefault(); if (rating) submit({ kind: "feedback", rating, message: message.trim() || undefined }); }}
    >
      <div className="space-y-1.5">
        <Label required>How was your interview experience?</Label>
        <div className="flex gap-1" role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              className="rounded p-0.5"
            >
              <Star className={cn("size-7", n <= (hover || rating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")} />
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fb-message">Anything you&apos;d like to share? <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Textarea id="fb-message" rows={3} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={!rating || busy}>{busy && <Loader2 className="animate-spin" />} Send feedback</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

function IssueForm({ token, onCancel, onDone }: { token: string; onCancel: () => void; onDone: () => void }) {
  const [category, setCategory] = useState<IssueCategory | "">("");
  const [message, setMessage] = useState("");
  const { busy, error, submit } = useSubmit(token, onDone);
  return (
    <form
      className="mt-4 space-y-4"
      onSubmit={(e) => { e.preventDefault(); if (category) submit({ kind: "issue", category, message: message.trim() }); }}
    >
      <div className="space-y-1.5">
        <Label required>What went wrong?</Label>
        <div className="flex flex-wrap gap-2">
          {(Object.entries(ISSUE_CATEGORIES) as [IssueCategory, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={category === key}
              onClick={() => setCategory(key)}
              className={cn("rounded-full border px-3 py-1.5 text-sm", category === key ? "border-primary bg-primary/10 font-medium text-primary" : "hover:bg-muted")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="issue-message" required>Describe what happened</Label>
        <Textarea id="issue-message" rows={4} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="For example: the interviewer moved on before I finished my answer." />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={!category || message.trim().length < 5 || busy}>{busy && <Loader2 className="animate-spin" />} Send report</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
