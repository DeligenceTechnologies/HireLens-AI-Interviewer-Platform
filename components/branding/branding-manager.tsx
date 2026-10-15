"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImageUp, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { BrandMark } from "@/components/branding/brand-mark";
import { FormCard } from "@/components/settings/form-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type Brand, brandStyle, isHexColor } from "@/lib/branding";
import { api } from "@/lib/client/api";

const PRESETS = ["#0b5bd3", "#4f46e5", "#0f766e", "#16a34a", "#e11d48", "#ea580c", "#111827"];

/** Logo + brand colour editor, used in company Settings and on the platform admin company page. */
export function BrandingManager({ endpoint, initial }: { endpoint: string; initial: Brand }) {
  const router = useRouter();
  const file = useRef<HTMLInputElement>(null);
  const [brand, setBrand] = useState(initial);
  const [color, setColor] = useState(initial.color ?? "");
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<Brand>, ok: string) => {
    setBusy(key);
    try {
      const b = await fn();
      setBrand(b);
      setColor(b.color ?? "");
      toast.success(ok);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const upload = (f: File) => run("upload", async () => {
    const form = new FormData();
    form.set("file", f);
    const res = await fetch(endpoint, { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Upload failed.");
    return data as Brand;
  }, "Logo updated");

  const draft = isHexColor(color) ? color : null;
  const preview: Brand = { ...brand, color: draft };
  return (
    <>
      <FormCard title="Company logo" description="Shown to candidates on your apply pages and interview pages, instead of any platform branding. PNG, JPG or WebP, up to 2 MB. A wide logo with a transparent background works best.">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex h-24 items-center justify-center rounded-xl border bg-white px-4" aria-label="Preview on a light page">
            <BrandMark brand={brand} height={40} nameClassName="text-lg text-[#0f1f3a]" />
          </div>
          <div className="flex h-24 items-center justify-center rounded-xl bg-zinc-950 px-4" aria-label="Preview in the interview room">
            <BrandMark brand={brand} height={28} onDark nameClassName="text-lg text-white" />
          </div>
        </div>
        {!brand.logoUrl && <p className="text-sm text-muted-foreground">No logo yet: candidates see your company name, <strong>{brand.name}</strong>, instead.</p>}
        <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" aria-label="Logo file"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }} />
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => file.current?.click()} disabled={!!busy}>
            {busy === "upload" ? <Loader2 className="animate-spin" /> : <ImageUp />} {brand.logoUrl ? "Replace logo" : "Upload logo"}
          </Button>
          {brand.logoUrl && (
            <Button variant="outline" disabled={!!busy} onClick={() => run("remove", () => api<Brand>(endpoint, { method: "DELETE" }), "Logo removed")}>
              {busy === "remove" ? <Loader2 className="animate-spin" /> : <Trash2 />} Remove
            </Button>
          )}
        </div>
      </FormCard>

      <FormCard title="Brand colour" description="Used for buttons and highlights on candidate pages. Text colour is picked automatically so it stays readable."
        footer={
          <>
            {brand.color && (
              <Button variant="ghost" disabled={!!busy} onClick={() => run("reset", () => api<Brand>(endpoint, { method: "PATCH", body: { color: null } }), "Default colour restored")}>
                <RotateCcw /> Use default
              </Button>
            )}
            <Button disabled={!!busy || !draft || draft === brand.color} onClick={() => run("color", () => api<Brand>(endpoint, { method: "PATCH", body: { color: draft } }), "Brand colour saved")}>
              {busy === "color" && <Loader2 className="animate-spin" />} Save colour
            </Button>
          </>
        }>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="brand-color">Colour</Label>
            <div className="flex items-center gap-2">
              <input type="color" aria-label="Pick a colour" value={draft ?? "#0b5bd3"} onChange={(e) => setColor(e.target.value.toLowerCase())}
                className="h-9 w-12 cursor-pointer rounded-md border border-input bg-background p-1" />
              <Input id="brand-color" value={color} placeholder="#0b5bd3" maxLength={7} className="w-28 font-mono"
                onChange={(e) => setColor(e.target.value.trim().toLowerCase())} aria-invalid={!!color && !draft} />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5" aria-label="Suggested colours">
            {PRESETS.map((c) => (
              <button key={c} type="button" title={c} aria-label={`Use ${c}`} onClick={() => setColor(c)}
                className="size-7 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.15)]" style={{ background: c }} />
            ))}
          </div>
        </div>
        {color && !draft && <p className="text-xs text-destructive">Enter a colour like #0b5bd3.</p>}
        <div className="rounded-xl border bg-muted/30 p-4" style={brandStyle(preview.color)}>
          <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">Preview</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button>Submit application</Button>
            <Button variant="outline">Back</Button>
            <span className="text-sm text-primary">Link colour</span>
          </div>
        </div>
      </FormCard>
    </>
  );
}
