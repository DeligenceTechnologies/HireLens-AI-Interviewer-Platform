"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type RoundValue = { id?: string; key: string; name: string; template_id: string };
type Template = { id: string; name: string; total_minutes: number };

const selectClass = "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const SUGGESTED = ["Screening", "Technical", "Culture fit", "Final round"];

export const newRoundKey = () => Math.random().toString(36).slice(2, 10);

/** Ordered interview rounds for a job, each with its own template. */
export function RoundsEditor({ value, onChange, templates, error }: { value: RoundValue[]; onChange: (v: RoundValue[]) => void; templates: Template[]; error?: string }) {
  const update = (i: number, patch: Partial<RoundValue>) => onChange(value.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...value];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  const add = () => {
    const used = new Set(value.map((r) => r.name));
    const name = SUGGESTED.find((s) => !used.has(s)) ?? `Round ${value.length + 1}`;
    onChange([...value, { key: newRoundKey(), name, template_id: templates[0]?.id ?? "" }]);
  };
  return (
    <div className="space-y-2">
      <ol className="space-y-2">
        {value.map((r, i) => (
          <li key={r.key} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border bg-background p-2 sm:grid-cols-[auto_minmax(0,0.8fr)_minmax(0,1.2fr)_auto]">
            <span className="flex size-6 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">{i + 1}</span>
            <Input aria-label={`Round ${i + 1} name`} required value={r.name} maxLength={80} onChange={(e) => update(i, { name: e.target.value })} placeholder="e.g. Screening" />
            <select aria-label={`Round ${i + 1} template`} required className={`${selectClass} col-span-3 sm:col-span-1`} value={r.template_id} onChange={(e) => update(i, { template_id: e.target.value })}>
              <option value="">Select a template…</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.total_minutes} min</option>)}
            </select>
            <div className="col-start-3 row-start-1 flex sm:col-start-auto sm:row-start-auto">
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Move round ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp /></Button>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Move round ${i + 1} down`} disabled={i === value.length - 1} onClick={() => move(i, 1)}><ArrowDown /></Button>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove round ${i + 1}`} disabled={value.length === 1} onClick={() => onChange(value.filter((_, j) => j !== i))}><Trash2 /></Button>
            </div>
          </li>
        ))}
      </ol>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="button" variant="outline" size="sm" onClick={add} disabled={value.length >= 10}><Plus /> Add round</Button>
      <p className="text-xs text-muted-foreground">Candidates are invited round by round. Removing a round keeps the interviews already done in it.</p>
    </div>
  );
}
