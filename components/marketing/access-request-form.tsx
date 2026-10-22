"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { DEMO_URL } from "@/lib/marketing";
import { cn } from "@/lib/utils";

const input =
  "h-11 w-full rounded-lg border border-[#CBD7EA] bg-white px-3.5 text-[15px] text-[#0F1F3A] outline-none placeholder:text-[#8A98B2] focus:border-[#0B5BD3] focus:ring-3 focus:ring-[#0B5BD3]/20";

type Tab = "access" | "contact";
const TABS: { value: Tab; label: string }[] = [{ value: "access", label: "Request access" }, { value: "contact", label: "Contact us" }];
const CONTACT_TOPICS = [["demo", "Book a demo"], ["pricing", "Pricing"], ["partnership", "Partnership"], ["other", "Other"]] as const;

/** `#contact` opens the Contact us tab and `#request-access` the Request access tab; the default is Request access. */
function tabFromHash(): Tab | null {
  if (typeof window === "undefined") return null;
  return window.location.hash === "#contact" ? "contact" : window.location.hash === "#request-access" ? "access" : null;
}

/** The home page's "Request access" and "Contact us" forms, as two tabs. */
export function ContactForms() {
  const [tab, setTab] = useState<Tab>("access");
  useEffect(() => {
    const sync = () => { const t = tabFromHash(); if (t) setTab(t); };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  return (
    <div className="rounded-2xl border border-[#DCE4F0] bg-white">
      <div role="tablist" aria-label="How can we help?" className="grid grid-cols-2 gap-1 border-b border-[#E3EAF5] p-1.5">
        {TABS.map((t) => (
          <button key={t.value} type="button" role="tab" id={`tab-${t.value}`} aria-selected={tab === t.value} aria-controls={`panel-${t.value}`}
            onClick={() => setTab(t.value)}
            className={cn("rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors", tab === t.value ? "bg-[#E9F1FD] text-[#0B4FB8]" : "text-[#5A6A86] hover:text-[#0F1F3A]")}>
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        <InquiryForm key={tab} kind={tab} />
      </div>
    </div>
  );
}

function InquiryForm({ kind }: { kind: Tab }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [topic, setTopic] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const access = kind === "access";

  if (done) {
    return (
      <div className="flex min-h-[28rem] flex-col items-center justify-center p-10 text-center">
        <CheckCircle2 className="size-10 text-[#0B6B3A]" />
        <h3 className="mt-4 text-xl font-semibold text-[#0F1F3A]">{access ? "Thanks, we've received your request" : "Thanks, we've received your message"}</h3>
        <p className="mt-2 max-w-sm text-[15px] text-[#4A5874]">{access ? "Our team will review it and get back to you shortly with next steps." : "We'll reply to your email as soon as we can."}</p>
      </div>
    );
  }

  const field = (name: string, label: string, type: string, ac: string, required: boolean) => (
    <div key={name} className="space-y-1.5">
      <label htmlFor={`ar-${name}`} className="text-sm font-medium text-[#0F1F3A]">
        {label}{!required && <span className="font-normal text-[#8A98B2]"> (optional)</span>}
      </label>
      <input id={`ar-${name}`} name={name} type={type} autoComplete={ac} required={required} aria-invalid={!!fieldErrors[name]} className={input} />
      {fieldErrors[name] && <p className="text-xs text-[#B42318]">{fieldErrors[name]}</p>}
    </div>
  );

  return (
    <form
      noValidate
      className="space-y-4 p-6 sm:p-8"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        setFieldErrors({});
        const data = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>;
        try {
          const res = await fetch("/api/public/access-request", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...data, topic: access ? "access" : data.topic, team_size: data.team_size || null }),
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) {
            if (json.issues) setFieldErrors(Object.fromEntries((json.issues as { path: string; message: string }[]).map((i) => [i.path, i.message])));
            throw new Error(json.error ?? "Something went wrong. Please try again.");
          }
          setDone(true);
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <h3 className="text-xl font-semibold text-[#0F1F3A]">{access ? "Request access" : "Contact us"}</h3>
        <p className="mt-1 text-sm text-[#5A6A86]">{access ? "Tell us about your team and we'll be in touch." : "Questions about demos, pricing, partnerships or anything else."}</p>
      </div>
      {!access && (
        <div className="space-y-1.5">
          <label htmlFor="ar-topic" className="text-sm font-medium text-[#0F1F3A]">What can we help with?</label>
          <select id="ar-topic" name="topic" required value={topic} onChange={(e) => setTopic(e.target.value)} aria-invalid={!!fieldErrors.topic} className={input}>
            <option value="" disabled>Select…</option>
            {CONTACT_TOPICS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          {fieldErrors.topic && <p className="text-xs text-[#B42318]">Please choose a topic</p>}
          {topic === "demo" && (
            <p className="text-xs text-[#5A6A86]">Prefer to pick a time now? <a href={DEMO_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#0B5BD3] hover:underline">Book directly</a></p>
          )}
        </div>
      )}
      {!access && topic === "other" && field("topic_other", "Please tell us what it's about", "text", "off", true)}
      <div className="grid gap-4 sm:grid-cols-2">
        {field("name", "Full name", "text", "name", true)}
        {field("email", "Work email", "email", "email", true)}
        {field("company", "Company", "text", "organization", access)}
        {field("phone", "Phone", "tel", "tel", false)}
      </div>
      {access && (
        <div className="space-y-1.5">
          <label htmlFor="ar-team" className="text-sm font-medium text-[#0F1F3A]">Team size <span className="font-normal text-[#8A98B2]">(optional)</span></label>
          <select id="ar-team" name="team_size" defaultValue="" className={input}>
            <option value="">Select…</option>
            <option value="1-10">1–10 employees</option>
            <option value="11-50">11–50 employees</option>
            <option value="51-200">51–200 employees</option>
            <option value="201-1000">201–1,000 employees</option>
            <option value="1000+">1,000+ employees</option>
          </select>
        </div>
      )}
      <div className="space-y-1.5">
        <label htmlFor="ar-message" className="text-sm font-medium text-[#0F1F3A]">
          {access ? "What are you hiring for?" : "Message"}{access && <span className="font-normal text-[#8A98B2]"> (optional)</span>}
        </label>
        <textarea id="ar-message" name="message" rows={access ? 3 : 4} maxLength={2000} required={!access} aria-invalid={!!fieldErrors.message} className={`${input} h-auto py-2.5`} />
        {fieldErrors.message && <p className="text-xs text-[#B42318]">{fieldErrors.message}</p>}
      </div>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      {error && <p role="alert" className="rounded-lg bg-[#FEF3F2] px-3 py-2 text-sm text-[#B42318]">{error}</p>}
      <button type="submit" disabled={busy} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0B5BD3] text-base font-semibold text-white hover:bg-[#0A4FB8] disabled:opacity-60">
        {busy && <Loader2 className="size-4 animate-spin" />} {access ? "Request access" : "Send message"}
      </button>
      <p className="text-center text-xs text-[#8A98B2]">We only use these details to contact you about PickMyHire.ai.</p>
    </form>
  );
}
