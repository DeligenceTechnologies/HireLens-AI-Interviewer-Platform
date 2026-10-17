"use client";

import { useRouter } from "next/navigation";
import { AuthForm, type Field } from "./auth-form";

export function SignupForm({ invite, company }: {
  invite: { token: string; email: string; orgName: string } | null;
  company?: { token: string; email: string; name: string } | null;
}) {
  const router = useRouter();
  const preset = invite?.email ?? company?.email;
  const fields: Field[] = [
    { name: "name", label: "Full name", autoComplete: "name" },
    { name: "email", label: "Work email", type: "email", autoComplete: "email", defaultValue: preset, readOnly: !!preset },
    ...(!invite && !company ? [
      { name: "orgName", label: "Company / workspace name", autoComplete: "organization", placeholder: "Acme Inc.", optional: true },
      { name: "accessCode", label: "Access code", autoComplete: "off", hint: "Provided by the PickMyHire.ai team after approval." },
    ] : []),
    { name: "password", label: "Password", type: "password", autoComplete: "new-password", hint: "At least 10 characters." },
  ];
  return (
    <AuthForm
      endpoint="/api/auth/signup"
      submitLabel={invite ? `Join ${invite.orgName}` : company ? `Create ${company.name}` : "Create workspace"}
      fields={fields}
      extra={{ inviteToken: invite?.token, companyInvite: company?.token }}
      onSuccess={() => {
        router.push("/dashboard");
        router.refresh();
      }}
    />
  );
}
