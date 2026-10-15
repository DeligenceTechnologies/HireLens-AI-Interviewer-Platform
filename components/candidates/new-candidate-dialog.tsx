"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ClientApiError } from "@/lib/client/api";

export function NewCandidateDialog() {
  const router = useRouter();
  const sp = useSearchParams();
  const [open, setOpen] = useState(sp.get("new") === "1");
  const [v, setV] = useState({ name: "", email: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus /> Add candidate</Button>
      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add candidate</DialogTitle>
            <DialogDescription>You can upload their resume on the next screen.</DialogDescription>
          </DialogHeader>
          <form id="new-cand" className="space-y-3" onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setErrors({});
            try {
              const { id } = await api<{ id: string }>("/api/candidates", { body: { ...v, phone: v.phone || null } });
              toast.success("Candidate added");
              router.push(`/candidates/${id}`);
            } catch (err) {
              const ce = err as ClientApiError;
              setErrors(Object.fromEntries((ce.issues ?? []).map((i) => [i.path, i.message])));
              if (!ce.issues) toast.error(ce.message);
              setBusy(false);
            }
          }}>
            {(["name", "email", "phone"] as const).map((k) => (
              <div key={k} className="space-y-1.5">
                <Label htmlFor={`c-${k}`} required={k !== "phone"}>{k === "name" ? "Full name" : k === "email" ? "Email" : <>Phone <span className="font-normal text-muted-foreground">(optional)</span></>}</Label>
                <Input id={`c-${k}`} type={k === "email" ? "email" : "text"} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} aria-invalid={!!errors[k]} />
                {errors[k] && <p className="text-xs text-destructive">{errors[k]}</p>}
              </div>
            ))}
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" form="new-cand" disabled={busy}>{busy && <Loader2 className="animate-spin" />}Add candidate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
