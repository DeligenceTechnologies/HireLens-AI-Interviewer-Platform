"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/client/api";
import { FormCard } from "./form-card";

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const [n, setN] = useState(name);
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const save = async (key: string, body: Record<string, string>) => {
    setBusy(key);
    try {
      await api("/api/auth/profile", { method: "PATCH", body });
      toast.success(key === "pw" ? "Password changed. Other sessions were signed out." : "Profile updated");
      if (key === "pw") setPw({ currentPassword: "", newPassword: "" });
      router.refresh();
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(null); }
  };
  return (
    <>
      <FormCard title="Profile" footer={<Button disabled={busy === "name" || n === name} onClick={() => save("name", { name: n })}>{busy === "name" && <Loader2 className="animate-spin" />}Save</Button>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="p-name" required>Name</Label><Input id="p-name" value={n} onChange={(e) => setN(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="p-email">Email</Label><Input id="p-email" value={email} readOnly disabled /></div>
        </div>
      </FormCard>
      <FormCard title="Password" footer={<Button disabled={busy === "pw" || !pw.newPassword} onClick={() => save("pw", pw)}>{busy === "pw" && <Loader2 className="animate-spin" />}Change password</Button>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="p-cur" required>Current password</Label><Input id="p-cur" type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="p-new" required>New password</Label><Input id="p-new" type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></div>
        </div>
      </FormCard>
    </>
  );
}
