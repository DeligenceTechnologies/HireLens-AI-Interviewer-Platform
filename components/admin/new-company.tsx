"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAction } from "@/lib/client/use-action";
import { LinkResult } from "./link-result";
import { QuotaInput } from "./quota-input";

export function NewCompanyButton({ defaultQuota }: { defaultQuota: number | null }) {
  const { run, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [quota, setQuota] = useState<number | null>(defaultQuota);
  const [link, setLink] = useState<string | null>(null);
  return (
    <>
      <Button onClick={() => { setName(""); setEmail(""); setQuota(defaultQuota); setLink(null); setOpen(true); }}><Plus /> New company</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a company</DialogTitle>
            <DialogDescription>For clients you onboard yourself. They become the owner when they use the sign-up link.</DialogDescription>
          </DialogHeader>
          {link ? <LinkResult link={link} note="Send this link to the owner. It works once, only for this email, and expires in 14 days." /> : (
            <div className="space-y-3">
              <div className="space-y-1.5"><Label htmlFor="nc-name" required>Company name</Label><Input id="nc-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="nc-email" required>Owner email</Label><Input id="nc-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <QuotaInput id="nc-quota" value={quota} onChange={setQuota} />
            </div>
          )}
          <DialogFooter>
            {link ? <Button onClick={() => setOpen(false)}>Done</Button> : (
              <Button disabled={!!pending || !name.trim() || !email.trim()} onClick={async () => {
                const res = await run<{ link: string }>("create", "/api/admin/company-invites", { body: { companyName: name, email, quota }, success: "Sign-up link created" });
                if (res) setLink(res.link);
              }}>{pending === "create" && <Loader2 className="animate-spin" />} Create sign-up link</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function RevokeLinkButton({ id }: { id: string }) {
  const { run, pending } = useAction();
  return <Button variant="ghost" size="sm" disabled={!!pending} onClick={() => run("revoke", `/api/admin/company-invites/${id}`, { method: "DELETE", success: "Link revoked" })}>Revoke</Button>;
}
