"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Number of free interviews, with an "Unlimited" switch. `value` null = unlimited. */
export function QuotaInput({ id, value, onChange, label = "Free interviews" }: { id: string; value: number | null; onChange: (v: number | null) => void; label?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-3">
        <Input
          id={id}
          type="number"
          min={0}
          max={100000}
          className="w-28 tabular"
          disabled={value === null}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? 0 : Math.max(0, Math.floor(Number(e.target.value))))}
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={value === null} onChange={(e) => onChange(e.target.checked ? null : 3)} className="size-4 accent-[var(--primary)]" />
          Unlimited
        </label>
      </div>
      <p className="text-xs text-muted-foreground">Counted when an interview is completed. Sent-but-unfinished interviews hold a slot.</p>
    </div>
  );
}
