"use client";

import { useState } from "react";
import { KeyRound, Loader2, MoreHorizontal } from "lucide-react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAction } from "@/lib/client/use-action";
import { LinkResult } from "./link-result";

export function UserActions({ id, name, disabled, isSelf }: { id: string; name: string; disabled: boolean; isSelf: boolean }) {
  const { run, pending } = useAction();
  const [confirm, setConfirm] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${name}`} />}>
          {pending ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={async () => {
            const r = await run<{ link: string }>("reset", `/api/admin/users/${id}/reset-link`, { refresh: false });
            if (r) setLink(r.link);
          }}><KeyRound /> Create password reset link</DropdownMenuItem>
          {!isSelf && (disabled
            ? <DropdownMenuItem onClick={() => run("en", `/api/admin/users/${id}`, { method: "PATCH", body: { disabled: false }, success: `${name} can sign in again` })}>Enable account</DropdownMenuItem>
            : <DropdownMenuItem variant="destructive" onClick={() => setConfirm(true)}>Disable account</DropdownMenuItem>)}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Disable ${name}?`}
        description="They're signed out on every device and can't sign in to any company. You can enable the account again later."
        confirmLabel="Disable account"
        destructive
        onConfirm={async () => { await run("dis", `/api/admin/users/${id}`, { method: "PATCH", body: { disabled: true }, success: "Account disabled" }); }}
      />
      <Dialog open={!!link} onOpenChange={(o) => !o && setLink(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Password reset link for {name}</DialogTitle><DialogDescription>Share it with them directly. It works once and expires in 24 hours.</DialogDescription></DialogHeader>
          {link && <LinkResult link={link} note="Reset link:" />}
          <DialogFooter><Button onClick={() => setLink(null)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
