import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { isWellFormedToken } from "@/lib/security/tokens";
import { verifyEmail } from "@/lib/services/accounts";

export const metadata = { title: "Confirm your email" };

export default async function VerifyEmailPage(props: PageProps<"/verify-email">) {
  const sp = await props.searchParams;
  const token = typeof sp.token === "string" && isWellFormedToken(sp.token) ? sp.token : null;
  const result = token ? await verifyEmail(token) : { ok: false as const };
  return result.ok ? (
    <div>
      <CheckCircle2 className="size-10 text-emerald-600" />
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Email confirmed</h1>
      <p className="mt-2 text-sm text-muted-foreground">You can now invite candidates to AI interviews.</p>
      <Link href="/dashboard" className={buttonVariants({ className: "mt-6" })}>Go to your dashboard</Link>
    </div>
  ) : (
    <div>
      <XCircle className="size-10 text-destructive" />
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">This link has expired</h1>
      <p className="mt-2 text-sm text-muted-foreground">Sign in and use “Resend email” on your dashboard to get a new confirmation link.</p>
      <Link href="/login" className={buttonVariants({ className: "mt-6" })}>Sign in</Link>
    </div>
  );
}
