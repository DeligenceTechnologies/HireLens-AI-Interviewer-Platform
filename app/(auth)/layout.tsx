import Link from "next/link";
import { Copyright, Logo } from "@/components/layout/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Link href="/" className="self-start"><Logo height={36} /></Link>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <Copyright />
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-primary lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,oklch(0.65_0.2_268/.6),transparent_50%),radial-gradient(circle_at_80%_80%,oklch(0.4_0.2_280/.8),transparent_50%)]" />
        <div className="relative flex h-full flex-col justify-end p-12 text-primary-foreground">
          <blockquote className="max-w-md text-2xl font-medium leading-snug">
            Structured, evidence-based interviews — every assessment linked to the exact moment in the recording.
          </blockquote>
          <p className="mt-4 text-sm opacity-80">AI conducts. Recruiters decide.</p>
        </div>
      </div>
    </div>
  );
}
