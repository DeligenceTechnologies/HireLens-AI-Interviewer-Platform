import type { Metadata } from "next";
import { Briefcase, Clock, MapPin } from "lucide-react";
import { ApplyForm } from "@/components/apply/apply-form";
import { Copyright, Logo } from "@/components/layout/logo";
import { employmentTypeLabel } from "@/lib/format";
import { getPublicJob } from "@/lib/services/applications";

export async function generateMetadata(props: PageProps<"/apply/[slug]">): Promise<Metadata> {
  const job = await getPublicJob((await props.params).slug);
  return job ? { title: `${job.title} — ${job.company_name}`, description: `Apply for ${job.title} at ${job.company_name}.` } : { title: "Job not available" };
}

export default async function ApplyPage(props: PageProps<"/apply/[slug]">) {
  const { slug } = await props.params;
  const job = await getPublicJob(slug);
  if (!job) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <div>
          <Briefcase className="mx-auto size-8 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-semibold">This job isn&apos;t accepting applications</h1>
          <p className="mt-2 text-sm text-muted-foreground">The position may have been filled or closed.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-5">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{job.company_name}</p>
            <p className="text-xs text-muted-foreground">Careers</p>
          </div>
          <Logo height={22} className="shrink-0" />
        </div>
      </header>
      <main className="mx-auto grid max-w-5xl gap-10 px-6 py-10 lg:grid-cols-[minmax(0,1fr)_420px]">
        <article>
          <h1 className="text-3xl font-semibold tracking-tight">{job.title}</h1>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {job.location && <span className="inline-flex items-center gap-1"><MapPin className="size-4" />{job.location}</span>}
            {job.employment_type && <span className="inline-flex items-center gap-1"><Briefcase className="size-4" />{employmentTypeLabel[job.employment_type]}</span>}
            {job.experience_min != null && <span className="inline-flex items-center gap-1"><Clock className="size-4" />{job.experience_min}{job.experience_max != null ? `–${job.experience_max}` : "+"} years experience</span>}
          </div>
          {job.required_skills.length > 0 && (
            <div className="mt-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Key skills</p>
              <div className="flex flex-wrap gap-1.5">
                {job.required_skills.map((s) => <span key={s} className="rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">{s}</span>)}
                {job.preferred_skills.map((s) => <span key={s} className="rounded-md bg-muted px-2 py-0.5 text-xs">{s}</span>)}
              </div>
            </div>
          )}
          {job.description && <div className="mt-8 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{job.description}</div>}
          {job.responsibilities.length > 0 && (
            <div className="mt-8">
              <h2 className="font-semibold">What you&apos;ll do</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground/90">{job.responsibilities.map((r) => <li key={r}>{r}</li>)}</ul>
            </div>
          )}
        </article>
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <ApplyForm slug={slug} company={job.company_name} jobTitle={job.title} />
        </aside>
      </main>
      <footer className="flex flex-col items-center gap-3 border-t py-8"><Logo height={24} /><Copyright /></footer>
    </div>
  );
}
