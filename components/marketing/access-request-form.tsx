"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

const input =
  "h-11 w-full rounded-lg border border-[#CBD7EA] bg-white px-3.5 text-[15px] text-[#0F1F3A] outline-none placeholder:text-[#8A98B2] focus:border-[#0B5BD3] focus:ring-3 focus:ring-[#0B5BD3]/20";

export function AccessRequestForm() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  if (done) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-[#DCE4F0] bg-white p-10 text-center">
        <CheckCircle2 className="size-10 text-[#0B6B3A]" />
        <h3 className="mt-4 text-xl font-semibold text-[#0F1F3A]">Thanks, we&apos;ve received your request</h3>
        <p className="mt-2 max-w-sm text-[15px] text-[#4A5874]">Our team will review it and get back to you shortly with next steps.</p>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="space-y-4 rounded-2xl border border-[#DCE4F0] bg-white p-6 sm:p-8"
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
            body: JSON.stringify({ ...data, team_size: data.team_size || null }),
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
        <h3 className="text-xl font-semibold text-[#0F1F3A]">Request access</h3>
        <p className="mt-1 text-sm text-[#5A6A86]">Tell us about your team and we&apos;ll be in touch.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {([
          ["name", "Full name", "text", "name", true],
          ["email", "Work email", "email", "email", true],
          ["company", "Company", "text", "organization", true],
          ["phone", "Phone", "tel", "tel", false],
        ] as const).map(([name, label, type, ac, required]) => (
          <div key={name} className="space-y-1.5">
            <label htmlFor={`ar-${name}`} className="text-sm font-medium text-[#0F1F3A]">
              {label}{!required && <span className="font-normal text-[#8A98B2]"> (optional)</span>}
            </label>
            <input id={`ar-${name}`} name={name} type={type} autoComplete={ac} required={required} aria-invalid={!!fieldErrors[name]} className={input} />
            {fieldErrors[name] && <p className="text-xs text-[#B42318]">{fieldErrors[name]}</p>}
          </div>
        ))}
      </div>
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
      <div className="space-y-1.5">
        <label htmlFor="ar-message" className="text-sm font-medium text-[#0F1F3A]">What are you hiring for? <span className="font-normal text-[#8A98B2]">(optional)</span></label>
        <textarea id="ar-message" name="message" rows={3} maxLength={2000} className={`${input} h-auto py-2.5`} />
      </div>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      {error && <p role="alert" className="rounded-lg bg-[#FEF3F2] px-3 py-2 text-sm text-[#B42318]">{error}</p>}
      <button type="submit" disabled={busy} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0B5BD3] text-base font-semibold text-white hover:bg-[#0A4FB8] disabled:opacity-60">
        {busy && <Loader2 className="size-4 animate-spin" />} Request access
      </button>
      <p className="text-center text-xs text-[#8A98B2]">We only use these details to contact you about PickMyHire.ai.</p>
    </form>
  );
}
