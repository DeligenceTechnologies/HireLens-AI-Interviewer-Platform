import Link from "next/link";
import { ChevronRight, LifeBuoy, MessageSquareText } from "lucide-react";
import { FilterTabs } from "@/components/admin/filter-tabs";
import { EmptyState } from "@/components/common/states";
import { PageHeader } from "@/components/common/page-header";
import { SupportStatusBadge } from "@/components/support/badges";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { listSupportTickets, SUPPORT_CATEGORIES, SUPPORT_CATEGORY_LABEL, type SupportCategory, type SupportStatus } from "@/lib/services/support";

export const metadata = { title: "Support" };

const TABS: { value: "all" | SupportStatus; label: string }[] = [
  { value: "all", label: "All" }, { value: "open", label: "Open" }, { value: "in_progress", label: "In progress" }, { value: "resolved", label: "Resolved" },
];

export default async function AdminSupportPage(props: PageProps<"/admin/support">) {
  const sp = await props.searchParams;
  const status = TABS.find((t) => t.value === sp.status && t.value !== "all")?.value as SupportStatus | undefined;
  const category = SUPPORT_CATEGORIES.find((c) => c === sp.category) as SupportCategory | undefined;
  const tickets = await listSupportTickets({ status, category });
  const href = (c?: SupportCategory) => `/admin/support?${new URLSearchParams({ ...(status ? { status } : {}), ...(c ? { category: c } : {}) })}`;
  return (
    <>
      <PageHeader title="Support" description="Requests from customers inside the app. Replies reach them in the app and by email." />
      <FilterTabs base="/admin/support" param="status" current={status ?? "all"} tabs={TABS} />
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {[undefined, ...SUPPORT_CATEGORIES].map((c) => (
          <Link key={c ?? "any"} href={href(c)} className={cn("rounded-full border px-3 py-1", category === c ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}>
            {c ? SUPPORT_CATEGORY_LABEL[c] : "All types"}
          </Link>
        ))}
      </div>
      {tickets.length === 0 ? <EmptyState icon={LifeBuoy} title="No support requests here" description="Requests customers send from Help and support appear here." /> : (
        <ul className="divide-y rounded-xl border bg-card">
          {tickets.map((t) => {
            const waiting = t.status !== "resolved" && !t.last_message_from_admin;
            return (
              <li key={t.id}>
                <Link href={`/admin/support/${t.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.subject}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {t.org_name} · {t.author ?? "Former member"} · {SUPPORT_CATEGORY_LABEL[t.category]} · {t.messages} message{t.messages === 1 ? "" : "s"} · {timeAgo(t.last_message_at)}
                    </p>
                  </div>
                  {waiting && <span className="hidden items-center gap-1 text-xs font-medium text-primary sm:inline-flex"><MessageSquareText className="size-3.5" />Needs reply</span>}
                  <SupportStatusBadge status={t.status} />
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
