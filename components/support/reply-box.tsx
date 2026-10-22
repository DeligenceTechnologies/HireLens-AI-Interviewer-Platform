"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, RotateCcw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/lib/client/use-action";

type Status = "open" | "in_progress" | "resolved";
const selectClass = "h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/** Customer side: reply, or mark the request resolved / open it again. */
export function CustomerReplyBox({ id, status }: { id: string; status: Status }) {
  const { run, pending } = useAction();
  const [message, setMessage] = useState("");
  return (
    <div className="space-y-3">
      <Label htmlFor="reply" className="sr-only">Reply</Label>
      <Textarea id="reply" rows={4} maxLength={5000} value={message} onChange={(e) => setMessage(e.target.value)}
        placeholder={status === "resolved" ? "Still need help? Reply to open this request again." : "Write a reply…"} />
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={!message.trim() || !!pending} onClick={async () => {
          if (await run("reply", `/api/support/${id}/messages`, { body: { message }, success: "Reply sent" })) setMessage("");
        }}>{pending === "reply" ? <Loader2 className="animate-spin" /> : <Send />} Send reply</Button>
        {status === "resolved"
          ? <Button variant="outline" disabled={!!pending} onClick={() => run("st", `/api/support/${id}`, { method: "PATCH", body: { status: "open" }, success: "Request opened again" })}><RotateCcw /> Open again</Button>
          : <Button variant="outline" disabled={!!pending} onClick={() => run("st", `/api/support/${id}`, { method: "PATCH", body: { status: "resolved" }, success: "Marked as resolved" })}><CheckCircle2 /> Mark resolved</Button>}
      </div>
    </div>
  );
}

/** Platform admin side: reply and set the status in one go. */
export function AdminReplyBox({ id, status }: { id: string; status: Status }) {
  const { run, pending } = useAction();
  const [message, setMessage] = useState("");
  const [next, setNext] = useState<Status | "">("");
  return (
    <div className="space-y-3">
      <Label htmlFor="admin-reply" className="sr-only">Reply to customer</Label>
      <Textarea id="admin-reply" rows={5} maxLength={5000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Reply to the customer. They'll see it in the app and get an email." />
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="admin-status" className="text-sm text-muted-foreground">Status</label>
        <select id="admin-status" className={selectClass} value={next} onChange={(e) => setNext(e.target.value as Status | "")}>
          <option value="">{message.trim() && status === "open" ? "In progress (automatic)" : "Keep current"}</option>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="resolved">Resolved</option>
        </select>
        <Button disabled={(!message.trim() && !next) || !!pending} onClick={async () => {
          const body = { ...(message.trim() ? { message } : {}), ...(next ? { status: next } : {}) };
          if (await run("save", `/api/admin/support/${id}`, { method: "PATCH", body, success: message.trim() ? "Reply sent" : "Status updated" })) { setMessage(""); setNext(""); }
        }}>{pending ? <Loader2 className="animate-spin" /> : <Send />} {message.trim() ? "Send reply" : "Update status"}</Button>
      </div>
    </div>
  );
}
