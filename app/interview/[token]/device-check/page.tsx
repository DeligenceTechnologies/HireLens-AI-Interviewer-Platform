import { redirect } from "next/navigation";
import { CandidateError, CandidateShell } from "@/components/interview/candidate-shell";
import { DeviceCheck } from "@/components/interview/device-check";
import { candidateStep, loadPublicInterview } from "@/lib/interview/public-page";

export default async function DeviceCheckPage(props: PageProps<"/interview/[token]/device-check">) {
  const { token } = await props.params;
  const { data, error } = await loadPublicInterview(token);
  if (!data) return <CandidateError message={error} />;
  const step = candidateStep(data);
  if (step === "completed" || step === "session") redirect(`/interview/${token}/${step}`);
  if (step === "welcome") redirect(`/interview/${token}/consent`);
  return (
    <CandidateShell brand={data.brand} job={data.job_title} step={2}>
      <DeviceCheck token={token} planReady={data.plan_ready} />
    </CandidateShell>
  );
}
