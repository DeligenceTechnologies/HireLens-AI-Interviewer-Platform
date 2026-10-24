// Illustrative product previews for the marketing page, built from the same
// visual language as the app. Content is sample data, labelled as such.
import { AlertTriangle, Bot, CheckCircle2, CircleDashed, Mic, PlayCircle, Radio, ScanFace, Sparkles, Star, UserX, Users } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

function Frame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-[#DCE4F0] bg-white shadow-[0_24px_60px_-20px_rgba(11,30,61,0.25)]", className)}>
      <div className="flex items-center gap-1.5 border-b border-[#E8EEF7] bg-[#F7F9FC] px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-[#F2B8B5]" />
        <span className="size-2.5 rounded-full bg-[#F5D9A6]" />
        <span className="size-2.5 rounded-full bg-[#BFE3C8]" />
      </div>
      {children}
    </div>
  );
}

/** Hero preview: an evidence-backed report section with a linked recording. */
export function ReportMock() {
  return (
    <Frame>
      <div className="grid gap-0 sm:grid-cols-[1.1fr_1fr]">
        <div className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-[#0F1F3A]">Jordan Lee</p>
              <p className="text-xs text-[#5A6A86]">Senior Full Stack Engineer · 31 min</p>
            </div>
            <span className="shrink-0 rounded-full bg-[#DDF5E8] px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-[#0B6B3A]">Report ready</span>
          </div>
          <div className="rounded-xl border border-[#E3EAF5] p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[#0F1F3A]">Project deep dive</p>
              <span className="rounded-md bg-[#DDF5E8] px-2 py-0.5 text-xs font-semibold text-[#0B6B3A]">Strong · 4/5</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[#5A6A86]">Clear personal ownership of the payments service, with specific design decisions and a production incident.</p>
            <div className="mt-3 space-y-2">
              {[["12:41", "“I designed the webhook pipeline with idempotency keys.”"], ["14:05", "“I fixed duplicate charges with reconciliation jobs.”"]].map(([t, q]) => (
                <div key={t} className="flex items-start gap-2 rounded-lg bg-[#F0F5FD] p-2.5">
                  <PlayCircle className="mt-0.5 size-4 shrink-0 text-[#0B5BD3]" />
                  <p className="text-xs text-[#0F1F3A]"><span className="font-mono font-semibold text-[#0B5BD3]">{t}</span> {q}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[["Experience", "Strong"], ["Technical", "Adequate"], ["Behavioral", "Strong"]].map(([s, a]) => (
              <div key={s} className="rounded-lg border border-[#E3EAF5] px-2 py-2">
                <p className="text-[11px] text-[#5A6A86]">{s}</p>
                <p className="text-xs font-semibold text-[#0F1F3A]">{a}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-[#E8EEF7] bg-[#0B1E3D] p-5 sm:border-t-0 sm:border-l">
          <div className="relative aspect-video overflow-hidden rounded-lg bg-gradient-to-br from-[#1D3A6B] to-[#0B1E3D]">
            <div className="absolute inset-0 flex items-center justify-center">
              <PlayCircle className="size-10 text-white/80" />
            </div>
            <span className="absolute bottom-2 left-2 rounded bg-black/50 px-1.5 py-0.5 font-mono text-[10px] text-white">12:41</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="flex h-full">
              <span className="w-[16%] bg-[#4F8DF5]" /><span className="w-[22%] bg-[#38BDF8]" /><span className="w-[34%] bg-[#34D399]" /><span className="w-[28%] bg-[#FBBF24]" />
            </div>
          </div>
          <div className="space-y-2 text-[11px] leading-relaxed">
            <p className="text-[#7DB8FF]"><span className="font-mono">12:30</span> Interviewer</p>
            <p className="text-white/80">What part of the payments service did you personally own?</p>
            <p className="rounded-md bg-white/10 p-2 text-white"><span className="font-mono text-[#7DB8FF]">12:41</span> Candidate: I designed the webhook pipeline…</p>
          </div>
        </div>
      </div>
    </Frame>
  );
}

/** AI screening preview for a public application. */
export function ScreeningMock() {
  const rows: [string, "met" | "partial", string][] = [
    ["Node.js", "met", "Led a move to Node.js microservices"],
    ["PostgreSQL", "met", "Cut p95 latency 40% via query tuning"],
    ["AWS", "met", "Migrated checkout to AWS"],
    ["4+ years each", "partial", "8 years total; per-skill not stated"],
  ];
  return (
    <Frame>
      <div className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[#0F1F3A]">Morgan Applicant</p>
            <p className="text-xs text-[#5A6A86]">Applied via public link · Backend Engineer</p>
          </div>
          <span className="shrink-0 rounded-md bg-[#E3EEFF] px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-[#0B4FB8]">Good match</span>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-[#5A6A86]"><Sparkles className="size-3.5 text-[#0B5BD3]" /> 3 of 4 required items evidenced in the resume</p>
        <div className="divide-y divide-[#EEF2F8] rounded-xl border border-[#E3EAF5]">
          {rows.map(([r, s, e]) => (
            <div key={r} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 px-3 py-2.5 sm:grid-cols-[110px_90px_1fr]">
              <p className="text-xs font-semibold text-[#0F1F3A]">{r}</p>
              <p className={cn("flex items-center gap-1 text-xs", s === "met" ? "text-[#0B6B3A]" : "text-[#9A5B00]")}>
                {s === "met" ? <CheckCircle2 className="size-3.5" /> : <CircleDashed className="size-3.5" />}{s === "met" ? "Met" : "Partial"}
              </p>
              <p className="col-span-2 text-xs text-[#5A6A86] sm:col-span-1">{e}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <span className="rounded-lg bg-[#0B5BD3] px-3 py-1.5 text-xs font-semibold text-white">Invite to AI interview</span>
          <span className="rounded-lg border border-[#DCE4F0] px-3 py-1.5 text-xs font-semibold text-[#0F1F3A]">Shortlist</span>
        </div>
      </div>
    </Frame>
  );
}

/** Candidate-side live interview preview. */
export function InterviewMock() {
  return (
    <Frame className="bg-[#0B0F19]">
      <div className="grid gap-3 bg-[#0B0F19] p-4 sm:grid-cols-[1.3fr_1fr]">
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-gradient-to-br from-[#25324A] to-[#0F172A]">
          <Image src="/marketing/candidate-interview.jpg" alt="Sample candidate on camera during an interview" fill sizes="(min-width: 1024px) 360px, 90vw" className="object-cover" />
          <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white"><span className="size-1.5 rounded-full bg-red-500" />Recording</span>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col items-center rounded-xl bg-white/5 p-4 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-indigo-500/30"><Radio className="size-6 text-indigo-200" /></div>
            <p className="mt-2 text-xs font-semibold text-white">Alex · AI interviewer</p>
            <p className="text-[11px] text-zinc-400">Listening…</p>
          </div>
          <div className="rounded-xl bg-white/5 p-3">
            <p className="text-[10px] font-semibold tracking-wide text-zinc-500 uppercase">Follow-up</p>
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-200">You mentioned leading the migration. What part did you personally own?</p>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
            <span className="flex items-center gap-1.5 text-[11px] text-zinc-400"><Mic className="size-3.5 text-emerald-400" /> Mic on</span>
            <span className="rounded-md bg-indigo-500 px-2 py-1 text-[11px] font-semibold text-white">Done answering</span>
          </div>
        </div>
      </div>
    </Frame>
  );
}

/** One candidate's progress across AI and human rounds, through to the shortlist. */
export function PipelineMock() {
  const rounds: { name: string; kind: "AI" | "Human"; detail: React.ReactNode; status: string; tone: "green" | "amber" }[] = [
    { name: "AI screening", kind: "AI", detail: "Report ready · 28 min", status: "Qualified", tone: "green" },
    {
      name: "Technical interview", kind: "Human",
      detail: <span className="inline-flex items-center gap-1"><Star className="size-3 fill-[#F5B301] text-[#F5B301]" />4.3 · 2 scorecards</span>,
      status: "Qualified", tone: "green",
    },
    {
      name: "Final round", kind: "Human",
      detail: <span className="inline-flex items-center gap-1"><Star className="size-3 fill-[#F5B301] text-[#F5B301]" />4.6 · 3 scorecards · Google Meet</span>,
      status: "Qualified", tone: "green",
    },
  ];
  const tones = { green: "bg-[#DDF5E8] text-[#0B6B3A]", amber: "bg-[#FDF0D9] text-[#8A5300]" };
  return (
    <Frame>
      <div className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[#0F1F3A]">Priya Sharma</p>
            <p className="text-xs text-[#5A6A86]">Backend Engineer · Hiring progress</p>
          </div>
          <span className="shrink-0 rounded-full bg-[#E0F2FE] px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-[#0369A1]">Shortlisted</span>
        </div>
        <ol className="space-y-2.5">
          {rounds.map((r, i) => (
            <li key={r.name} className="flex items-center gap-3 rounded-xl border border-[#E3EAF5] p-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#F0F5FD] text-[#0B5BD3]">
                {r.kind === "AI" ? <Bot className="size-4" /> : <Users className="size-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-[#0F1F3A]">{i + 1}. {r.name} <span className="font-normal text-[#7A8AA6]">· {r.kind}</span></p>
                <p className="mt-0.5 text-[11px] text-[#5A6A86]">{r.detail}</p>
              </div>
              <span className={cn("shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold", tones[r.tone])}>
                {r.status === "Qualified" && <CheckCircle2 className="mr-1 inline size-3 align-[-2px]" />}{r.status}
              </span>
            </li>
          ))}
        </ol>
        <div className="rounded-xl bg-[#F0F5FD] p-3 text-[11px] leading-relaxed text-[#3D4D6A]">
          <span className="font-semibold text-[#0F1F3A]">All rounds qualified</span> · Shortlisted by Anita R. on 14 Oct · Scorecards locked
        </div>
      </div>
    </Frame>
  );
}

/** Identity check: the reference photo, a random check and one flag to review. */
export function IdentityMock() {
  const photo = (label: string) => (
    <div className="relative aspect-[4/3] overflow-hidden bg-[#EEF2F8]">
      <Image src="/marketing/candidate-interview.jpg" alt={label} fill sizes="(min-width: 1024px) 180px, 45vw" className="object-cover" />
    </div>
  );
  const items = [
    { label: "Reference photo", detail: "Setup check", time: null, flagged: false, image: photo("Sample reference photo taken at the setup check") },
    { label: "Random check", detail: "Match", time: "08:12", flagged: false, image: photo("Sample random check photo matching the reference") },
    { label: "No face in view", detail: "Flagged", time: "14:05", flagged: true, image: <div className="flex aspect-[4/3] items-center justify-center bg-[#E9EEF5]"><UserX className="size-8 text-[#9AA8BF]" /></div> },
  ];
  return (
    <Frame>
      <div className="flex items-center justify-between gap-2 border-b border-[#E8EEF7] px-5 py-3.5">
        <p className="flex items-center gap-2 text-sm font-semibold text-[#0F1F3A]"><ScanFace className="size-4 text-[#0B5BD3]" /> Identity check</p>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#FDF0D9] px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-[#8A5300]"><AlertTriangle className="size-3.5" /> Needs review · 1 flag</span>
      </div>
      <div className="space-y-4 p-5">
        <p className="text-xs leading-relaxed text-[#5A6A86]">The candidate left the frame once. Watch that moment before deciding anything.</p>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {items.map((it) => (
            <div key={it.label} className="overflow-hidden rounded-xl border border-[#E3EAF5]">
              {it.image}
              <div className="px-2 py-2 sm:px-2.5">
                <p className={cn("text-[11px] font-semibold", it.flagged ? "text-[#8A5300]" : "text-[#0F1F3A]")}>{it.label}</p>
                <div className="mt-0.5 flex flex-wrap items-center justify-between gap-x-1 text-[11px] text-[#5A6A86]">
                  <span className="flex items-center gap-1">{it.detail === "Match" && <CheckCircle2 className="size-3 text-[#0B6B3A]" />}{it.detail}</span>
                  {it.time && <span className="inline-flex items-center gap-0.5 font-mono font-semibold text-[#0B5BD3]"><PlayCircle className="size-3" />{it.time}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}
