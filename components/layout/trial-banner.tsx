import { CalendarClock, MailWarning, Sparkles } from "lucide-react";
import { DEMO_URL } from "@/lib/marketing";
import type { QuotaStatus } from "@/lib/services/quota";
import { cn } from "@/lib/utils";
import { ResendVerification } from "./resend-verification";

/** Shown across the app for free-trial companies: what's left, and how to continue. */
export function TrialBanner({ quota, email }: { quota: QuotaStatus; email: string }) {
  if (quota.plan !== "trial") return null;
  const daysLeft = quota.trialDaysLeft;
  const usedUp = quota.remaining === 0;
  const tone = quota.trialEnded || usedUp ? "red" : quota.needsVerification ? "amber" : "sky";
  const bookCall = <a href={DEMO_URL} target="_blank" rel="noopener noreferrer" className="shrink-0 font-semibold underline underline-offset-2">Book a call</a>;
  return (
    <div role="status" className={cn("flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b px-4 py-2 text-sm", {
      "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-100": tone === "sky",
      "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200": tone === "amber",
      "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200": tone === "red",
    })}>
      {quota.trialEnded ? (
        <><CalendarClock className="size-4 shrink-0" /><span>Your free trial has ended. Your jobs and reports are still here; book a call with us to keep interviewing.</span>{bookCall}</>
      ) : quota.needsVerification ? (
        <><MailWarning className="size-4 shrink-0" /><span>Confirm your email to start sending interviews. We sent a link to <strong>{email}</strong>.</span><ResendVerification /></>
      ) : usedUp ? (
        <><Sparkles className="size-4 shrink-0" /><span>You&apos;ve used all {quota.quota} trial interviews{quota.inProgress ? ` (${quota.inProgress} still in progress)` : ""}. Book a call with us to continue.</span>{bookCall}</>
      ) : (
        <><Sparkles className="size-4 shrink-0" /><span><strong>Free trial</strong> · {quota.remaining} of {quota.quota} interviews left{daysLeft !== null ? ` · ${daysLeft} day${daysLeft === 1 ? "" : "s"} left` : ""}</span>{bookCall}</>
      )}
    </div>
  );
}
