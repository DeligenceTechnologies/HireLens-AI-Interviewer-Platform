import { CheckCircle2 } from "lucide-react";
import { CandidateFeedback } from "@/components/interview/candidate-feedback";
import { CandidateError, CandidateShell } from "@/components/interview/candidate-shell";
import { loadPublicInterview } from "@/lib/interview/public-page";

export default async function CompletedPage(props: PageProps<"/interview/[token]/completed">) {
  const { token } = await props.params;
  const { data, error } = await loadPublicInterview(token);
  if (!data) return <CandidateError message={error} />;
  return (
    <CandidateShell brand={data.brand} job={data.job_title}>
      <div className="mx-auto max-w-lg py-10 text-center">
        <CheckCircle2 className="mx-auto size-12 text-emerald-600" />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Thank you, {data.candidate_first_name}!</h1>
        <p className="mt-3 text-muted-foreground">Your interview for the {data.job_title} role is complete and has been sent to the {data.company_name} hiring team. They&apos;ll review it and be in touch about next steps.</p>
        <p className="mt-6 text-sm text-muted-foreground">You can close this window now.</p>
      </div>
      <CandidateFeedback token={token} />
    </CandidateShell>
  );
}
