"use client";

import { Loader2 } from "lucide-react";
import { useAction } from "@/lib/client/use-action";

export function ResendVerification() {
  const { run, pending } = useAction();
  return (
    <button type="button" disabled={!!pending} className="inline-flex shrink-0 items-center gap-1 font-semibold underline underline-offset-2 disabled:opacity-60"
      onClick={() => run("resend", "/api/auth/verify-email", { success: "Confirmation email sent", refresh: false })}>
      {pending && <Loader2 className="size-3.5 animate-spin" />} Resend email
    </button>
  );
}
