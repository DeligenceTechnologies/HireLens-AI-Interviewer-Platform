"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { api } from "@/lib/client/api";
import { FormCard } from "./form-card";

const PRESETS = [{ v: 30, l: "30 days" }, { v: 90, l: "90 days" }, { v: 180, l: "180 days" }, { v: 365, l: "1 year" }, { v: 0, l: "Keep indefinitely" }];

export function PrivacyForm({ retentionDays }: { retentionDays: number }) {
  const router = useRouter();
  const [days, setDays] = useState(retentionDays);
  const [custom, setCustom] = useState(!PRESETS.some((p) => p.v === retentionDays));
  const [busy, setBusy] = useState(false);
  return (
    <>
      <FormCard title="Data retention" description="Recordings and transcripts of completed interviews older than this are deleted when retention runs. Reports and evaluations are kept unless deleted individually."
        footer={<Button disabled={busy} onClick={async () => {
          setBusy(true);
          try { await api("/api/organizations", { method: "PATCH", body: { settings: { retention_days: days } } }); toast.success("Retention policy saved"); router.refresh(); }
          catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
        }}>{busy && <Loader2 className="animate-spin" />}Save policy</Button>}>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button key={p.v} type="button" onClick={() => { setDays(p.v); setCustom(false); }} className={`rounded-lg border px-3 py-1.5 text-sm ${!custom && days === p.v ? "border-primary bg-accent text-accent-foreground" : "hover:bg-muted"}`}>{p.l}</button>
          ))}
          <button type="button" onClick={() => setCustom(true)} className={`rounded-lg border px-3 py-1.5 text-sm ${custom ? "border-primary bg-accent text-accent-foreground" : "hover:bg-muted"}`}>Custom</button>
        </div>
        {custom && <div className="max-w-40 space-y-1.5"><Label htmlFor="ret" required>Days</Label><Input id="ret" type="number" min={1} max={3650} value={days} onChange={(e) => setDays(Math.max(1, Math.min(3650, Number(e.target.value) || 1)))} /></div>}
      </FormCard>
      <FormCard title="Run retention now" description="Applies the saved policy immediately. Deletions are logged in the audit log.">
        <ConfirmDialog title="Apply retention policy now?" description="Recordings and transcripts older than the retention period will be permanently deleted." confirmLabel="Delete expired data" destructive
          onConfirm={async () => { try { const r = await api<{ deleted: number }>("/api/privacy/retention", { body: {} }); toast.success(`Retention applied to ${r.deleted} interview(s)`); } catch (e) { toast.error((e as Error).message); } }}
          trigger={(o) => <Button variant="outline" onClick={o}>Run retention</Button>} />
      </FormCard>
      <FormCard title="Deletion requests">
        <p className="text-sm text-muted-foreground">To delete everything about a candidate (resume, extracted data, recordings, transcripts, reports), open the candidate and choose <strong>Delete</strong>. To delete only a recording, transcript or report, use the actions menu on the interview page.</p>
        <p className="text-sm text-muted-foreground">Consent is captured before every interview with a timestamp and consent version. Legal requirements vary by jurisdiction — configure retention to match your policies.</p>
      </FormCard>
    </>
  );
}
