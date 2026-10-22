"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/lib/client/use-action";

const selectClass = "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const CATEGORIES = [["problem", "Something isn't working"], ["question", "Question"], ["feature", "Feature request"], ["billing", "Billing and plan"]] as const;

/** Write a new support request; opens the conversation once sent. */
export function NewRequestForm() {
  const router = useRouter();
  const { run, pending } = useAction();
  const [category, setCategory] = useState<string>("problem");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const ready = subject.trim().length >= 3 && message.trim().length > 0;
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await run<{ id: string }>("send", "/api/support", { body: { category, subject, message, pageUrl }, success: "Sent. We'll reply here and by email.", refresh: false });
        if (res) router.push(`/help/${res.id}`);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-[14rem_1fr]">
        <div className="space-y-1.5">
          <Label htmlFor="sr-category" required>Type</Label>
          <select id="sr-category" className={selectClass} value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sr-subject" required>Subject</Label>
          <Input id="sr-subject" maxLength={160} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Candidate can't start their interview" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sr-message" required>Message</Label>
        <Textarea id="sr-message" rows={6} maxLength={5000} value={message} onChange={(e) => setMessage(e.target.value)}
          placeholder={category === "problem" ? "What happened, what you expected, and the candidate or job it affects." : "How can we help?"} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sr-page">Link to the page <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Input id="sr-page" maxLength={500} value={pageUrl} onChange={(e) => setPageUrl(e.target.value)} placeholder="Paste the page address where you saw the problem" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">Your name, email and company are included automatically.</p>
        <Button type="submit" disabled={!ready || !!pending}>{pending ? <Loader2 className="animate-spin" /> : <Send />} Send to support</Button>
      </div>
    </form>
  );
}
