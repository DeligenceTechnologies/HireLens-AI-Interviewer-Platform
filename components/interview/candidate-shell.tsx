import { AlertCircle } from "lucide-react";
import { Copyright, Logo } from "@/components/layout/logo";

export function CandidateShell({ company, job, children, step }: { company?: string; job?: string; children: React.ReactNode; step?: number }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div>
            <p className="font-semibold">{company ?? "Interview"}</p>
            {job && <p className="text-xs text-muted-foreground">{job}</p>}
          </div>
          {step != null && (
            <ol className="flex items-center gap-2 text-xs text-muted-foreground" aria-label="Steps">
              {["Welcome", "Consent", "Device check", "Interview"].map((s, i) => (
                <li key={s} className={`flex items-center gap-1.5 ${i === step ? "font-medium text-foreground" : ""}`}>
                  <span className={`flex size-5 items-center justify-center rounded-full text-[10px] ${i <= step ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{i + 1}</span>
                  <span className="hidden sm:inline">{s}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">{children}</main>
      <footer className="flex flex-col items-center gap-2 py-6 text-center text-xs text-muted-foreground">
        <Logo height={22} />
        <span>Your responses are reviewed by the hiring team.</span>
        <Copyright />
      </footer>
    </div>
  );
}

export function CandidateError({ message }: { message: string }) {
  return (
    <CandidateShell>
      <div className="mx-auto max-w-md rounded-xl border bg-card p-8 text-center">
        <AlertCircle className="mx-auto size-8 text-muted-foreground" />
        <h1 className="mt-4 text-lg font-semibold">We can&apos;t open this interview</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      </div>
    </CandidateShell>
  );
}
