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

type Trial = { enabled: boolean; interviews: number; days: number; requireVerification: boolean };

export function PlatformSettingsForm({ initial }: { initial: { signupCode: { enabled: boolean; code: string | null }; defaultQuota: number | null; trial: Trial } }) {
  const { run, pending } = useAction();
  const [enabled, setEnabled] = useState(initial.signupCode.enabled);
  const [code, setCode] = useState(initial.signupCode.code ?? "");
  const [quota, setQuota] = useState<number | null>(initial.defaultQuota);
  const [trial, setTrial] = useState<Trial>(initial.trial);
  const setT = (patch: Partial<Trial>) => setTrial((t) => ({ ...t, ...patch }));
  const changed = enabled !== initial.signupCode.enabled || code !== (initial.signupCode.code ?? "") || quota !== initial.defaultQuota || JSON.stringify(trial) !== JSON.stringify(initial.trial);
  return (
    <div className="space-y-6">
      <FormCard title="Free trial" description="Anyone with a work email (not Gmail, Yahoo and similar) can start a trial from the home page without an access code.">
        <div className="flex items-center gap-3 text-sm font-medium">
          <Switch checked={trial.enabled} onCheckedChange={(c) => setT({ enabled: !!c })} aria-label="Allow free trials" />
          <span aria-hidden>{trial.enabled ? "On: “Start free trial” is shown on the home page and sign-up" : "Off: sign-up needs an access code or approval link"}</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="trial-interviews" required>Interviews per trial</Label>
            <Input id="trial-interviews" type="number" min={1} max={50} value={trial.interviews} onChange={(e) => setT({ interviews: Math.max(1, Math.min(50, Number(e.target.value) || 1)) })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="trial-days" required>Trial length (days)</Label>
            <Input id="trial-days" type="number" min={1} max={90} value={trial.days} onChange={(e) => setT({ days: Math.max(1, Math.min(90, Number(e.target.value) || 1)) })} />
          </div>
        </div>
        <div className="flex items-start gap-3 text-sm">
          <Switch checked={trial.requireVerification} onCheckedChange={(c) => setT({ requireVerification: !!c })} aria-label="Require email confirmation for trials" className="mt-0.5" />
          <span>
            <span className="font-medium">Require email confirmation</span>
            <span className="block text-xs text-muted-foreground">Trial accounts must click a link in their email before inviting candidates, and only one trial is allowed per company domain. Turn on only once email sending is set up; otherwise nobody receives the link.</span>
          </span>
        </div>
        <p className="text-xs text-muted-foreground">Changes apply to new trials. Extend or convert existing trials from each company&apos;s page.</p>
      </FormCard>
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
        <Button disabled={!changed || !!pending} onClick={() => run("save", "/api/admin/settings", { method: "PUT", body: { signupCodeEnabled: enabled, signupCode: code || null, defaultQuota: quota, trial }, success: "Settings saved" })}>
          {pending === "save" && <Loader2 className="animate-spin" />} Save settings
        </Button>
      </div>
    </div>
  );
}
