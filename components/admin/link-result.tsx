import { CopyButton } from "@/components/common/copy-button";
import { Input } from "@/components/ui/input";

/** A generated one-time link to copy and share by hand. */
export function LinkResult({ link, note }: { link: string; note: string }) {
  return (
    <div className="space-y-2">
      <p className="text-sm">{note}</p>
      <div className="flex gap-2"><Input readOnly value={link} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} /><CopyButton value={link} /></div>
    </div>
  );
}
