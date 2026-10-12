import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getAuth, getSessionUser } from "@/lib/auth/session";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getAuth()) redirect("/dashboard");
  if ((await getSessionUser())?.isPlatformAdmin) redirect("/admin");
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-1 mb-8 text-sm text-muted-foreground">Sign in to your recruiting workspace.</p>
      <Suspense><LoginForm /></Suspense>
      <div className="mt-6 flex justify-between text-sm">
        <Link href="/forgot-password" className="text-muted-foreground hover:text-foreground">Forgot password?</Link>
        <Link href="/#contact" className="font-medium text-primary hover:underline">Request access</Link>
      </div>
    </>
  );
}
