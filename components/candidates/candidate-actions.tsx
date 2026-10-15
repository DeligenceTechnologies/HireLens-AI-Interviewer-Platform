"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { api } from "@/lib/client/api";

export function CandidateActions({ candidate, canEdit, canDelete }: { candidate: { id: string; name: string; email: string; phone: string | null }; canEdit: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ name: candidate.name, email: candidate.email, phone: candidate.phone ?? "" });
  const [busy, setBusy] = useState(false);
  return (
    <>
      {canEdit && <Button variant="outline" onClick={() => setOpen(true)}><Pencil /> Edit</Button>}
      {canDelete && (
        <ConfirmDialog
          title={`Delete ${candidate.name}?`}
          description="This permanently deletes the candidate, their resume and extracted data, and all interviews including recordings, transcripts and reports."
          confirmLabel="Delete permanently"
          destructive
          onConfirm={async () => {
            try {
              await api(`/api/candidates/${candidate.id}`, { method: "DELETE" });
              toast.success("Candidate and all related data deleted");
              router.push("/candidates");
            } catch (err) { toast.error((err as Error).message); }
          }}
          trigger={(o) => <Button variant="destructive" onClick={o}><Trash2 /> Delete</Button>}
        />
      )}
      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit candidate</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {(["name", "email", "phone"] as const).map((k) => (
              <div key={k} className="space-y-1.5">
                <Label htmlFor={`e-${k}`} className="capitalize" required={k !== "phone"}>{k}{k === "phone" && <span className="font-normal normal-case text-muted-foreground">(optional)</span>}</Label>
                <Input id={`e-${k}`} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={busy} onClick={async () => {
              setBusy(true);
              try {
                await api(`/api/candidates/${candidate.id}`, { method: "PUT", body: { ...v, phone: v.phone || null } });
                toast.success("Candidate updated");
                setOpen(false);
                router.refresh();
              } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
            }}>{busy && <Loader2 className="animate-spin" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
