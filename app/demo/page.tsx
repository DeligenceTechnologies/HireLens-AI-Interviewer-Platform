import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Copyright } from "@/components/layout/logo";
import { DemoVideo } from "@/components/marketing/demo-video";
import { SiteHeader } from "@/components/marketing/site-header";
import { DEMO_URL } from "@/lib/marketing";

export const metadata: Metadata = {
  title: { absolute: "Product demo · DeliberateHire AI" },
  description: "Watch a 10-minute walkthrough of DeliberateHire AI, including a live AI video interview and the evidence-backed report.",
  openGraph: {
    title: "DeliberateHire AI · Product demo",
    description: "A 10-minute walkthrough with a live AI interview and the evidence-backed report.",
    images: ["/demo/poster.jpg"],
  },
};

const CHAPTERS = [
  "Jobs, AI-extracted requirements and interview templates",
  "Public apply link and AI application screening",
  "Inviting a candidate to an AI interview",
  "A live AI interview, with personalized follow-ups",
  "The evidence-backed report, transcript and comparison",
  "Team roles, settings and platform admin",
];

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFD] text-[#0F1F3A]">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-5 py-14 sm:px-8 sm:py-20">
        <p className="text-center text-sm font-semibold tracking-[0.18em] text-[#0B5BD3] uppercase">Product demo</p>
        <h1 className="mt-3 text-center text-3xl font-bold tracking-tight text-balance sm:text-5xl">See DeliberateHire AI in action</h1>
        <p className="mx-auto mt-4 max-w-2xl text-center text-lg leading-relaxed text-[#4A5874]">
          A 10-minute walkthrough, from creating a job to a live AI interview and the report your team reviews.
        </p>
        <DemoVideo className="mt-10" />
        <p className="mt-3 text-center text-xs text-[#7A8AA6]">Recorded with sample data.</p>

        <div className="mt-12 grid gap-10 md:grid-cols-[1.2fr_1fr]">
          <section>
            <h2 className="text-lg font-semibold">What you&apos;ll see</h2>
            <ol className="mt-4 space-y-2.5 text-[15px] text-[#3D4D6A]">
              {CHAPTERS.map((c, i) => (
                <li key={c} className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#E6EFFC] text-xs font-semibold text-[#0B5BD3]">{i + 1}</span>
                  {c}
                </li>
              ))}
            </ol>
          </section>
          <section className="rounded-2xl border border-[#DCE4F0] bg-white p-6">
            <h2 className="text-lg font-semibold">Want to try it on your next role?</h2>
            <p className="mt-2 text-[15px] text-[#4A5874]">Book a call and we&apos;ll walk through your hiring process, or request access for your team.</p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row md:flex-col lg:flex-row">
              <a href={DEMO_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B5BD3] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0A4FB8]">Book a demo <ArrowRight className="size-4" /></a>
              <Link href="/#contact" className="inline-flex items-center justify-center rounded-xl border border-[#CBD7EA] bg-white px-5 py-3 text-sm font-semibold hover:border-[#0B5BD3] hover:text-[#0B5BD3]">Request access</Link>
            </div>
          </section>
        </div>
      </main>
      <footer className="border-t border-[#E3EAF5] bg-white py-6 text-center"><Copyright /></footer>
    </div>
  );
}
