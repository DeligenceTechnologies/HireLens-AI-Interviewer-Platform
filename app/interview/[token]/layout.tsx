import type { Metadata } from "next";
import { loadPublicInterview } from "@/lib/interview/public-page";

// Candidate pages carry only the hiring company's identity (no platform branding).
export async function generateMetadata(props: LayoutProps<"/interview/[token]">): Promise<Metadata> {
  const { token } = await props.params;
  const { data } = await loadPublicInterview(token);
  return {
    title: { absolute: data ? `Interview — ${data.company_name}` : "Interview" },
    icons: { icon: data?.brand.logoUrl ?? "/neutral-icon.png" },
    robots: { index: false, follow: false },
  };
}

export default function CandidateLayout({ children }: LayoutProps<"/interview/[token]">) {
  return <div className="flex min-h-screen flex-col bg-background">{children}</div>;
}
