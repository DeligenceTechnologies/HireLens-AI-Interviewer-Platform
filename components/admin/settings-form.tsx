"use client";

import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { CopyButton } from "@/components/common/copy-button";
import { FormCard } from "@/components/settings/form-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAction } from "@/lib/client/use-action";
import { QuotaInput } from "./quota-input";

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export function PlatformSettingsForm({ initial }: { initial: { signupCode: { enabled: boolean; code: string | null }; defaultQuota: number | null } }) {
  const { run, pending } = useAction();
  const [enabled, setEnabled] = useState(initial.signupCode.enabled);
  const [code, setCode] = useState(initial.signupCode.code ?? "");
  const [quota, setQuota] = useState<number | null>(initial.defaultQuota);
  const changed = enabled !== initial.signupCode.enabled || code !== (initial.signupCode.code ?? "") || quota !== initial.defaultQuota;
  return (
    <div className="space-y-6">
      <FormCard title="Shared access code" description="Approved clients can create a company at /signup with this code. One-time links from access requests work whether this is on or off.">
        <div className="flex items-center gap-3 text-sm font-medium">
          <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Allow sign-up with the shared code" />
          <span aria-hidden>{enabled ? "On: anyone with the code can create a company" : "Off: only one-time links and team invites work"}</span>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="signup-code">Access code</Label>
          <div className="flex flex-wrap gap-2">
            <Input id="signup-code" value={code} onChange={(e) => setCode(e.target.value.trim())} className="max-w-xs font-mono" autoComplete="off" />
            {code && <CopyButton value={code} />}
            <Button type="button" variant="outline" size="sm" onClick={() => setCode(randomCode())}><RefreshCw /> Generate new</Button>
          </div>
          <p className="text-xs text-muted-foreground">At least 8 characters. Changing it stops the old code working immediately; existing accounts aren&apos;t affected.</p>
        </div>
      </FormCard>
      <FormCard title="New companies" description="Free interviews given to a company created with the access code. Approval links set their own number.">
        <QuotaInput id="default-quota" value={quota} onChange={setQuota} label="Default free interviews" />
      </FormCard>
      <div className="flex justify-end">
        <Button disabled={!changed || !!pending} onClick={() => run("save", "/api/admin/settings", { method: "PUT", body: { signupCodeEnabled: enabled, signupCode: code || null, defaultQuota: quota }, success: "Settings saved" })}>
          {pending === "save" && <Loader2 className="animate-spin" />} Save settings
        </Button>
      </div>
    </div>
  );
}
