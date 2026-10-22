import Link from "next/link";
import { Inbox } from "lucide-react";
import { AccessRequestList, type AccessRequest } from "@/components/admin/access-requests";
import { FilterTabs } from "@/components/admin/filter-tabs";
import { EmptyState } from "@/components/common/states";
import { PageHeader } from "@/components/common/page-header";
import { INQUIRY_TOPIC_LABEL, INQUIRY_TOPICS, type InquiryTopic } from "@/lib/marketing";
import { listAccessRequests, type AccessRequestStatus } from "@/lib/services/admin";
import { getDefaultQuota } from "@/lib/services/platform";
import { cn } from "@/lib/utils";

export const metadata = { title: "Inquiries" };

const TABS: { value: "all" | AccessRequestStatus; label: string }[] = [
  { value: "all", label: "All" }, { value: "new", label: "New" }, { value: "contacted", label: "Contacted" },
  { value: "approved", label: "Approved" }, { value: "closed", label: "Closed" }, { value: "rejected", label: "Rejected" },
];

export default async function InquiriesPage(props: PageProps<"/admin/requests">) {
  const sp = await props.searchParams;
  const status = TABS.find((t) => t.value === sp.status && t.value !== "all")?.value as AccessRequestStatus | undefined;
  const topic = INQUIRY_TOPICS.find((t) => t === sp.topic) as InquiryTopic | undefined;
  const [requests, defaultQuota] = await Promise.all([listAccessRequests(status, topic), getDefaultQuota()]);
  const href = (t?: InquiryTopic) => `/admin/requests?${new URLSearchParams({ ...(status ? { status } : {}), ...(t ? { topic: t } : {}) })}`;
  return (
    <>
      <PageHeader title="Inquiries" description="Messages from the home page: Request access and Contact us. Approve an access request to create a one-time sign-up link." />
      <FilterTabs base="/admin/requests" param="status" current={status ?? "all"} tabs={TABS} />
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {[undefined, ...INQUIRY_TOPICS].map((t) => (
          <Link key={t ?? "any"} href={href(t)} className={cn("rounded-full border px-3 py-1", topic === t ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}>
            {t ? INQUIRY_TOPIC_LABEL[t] : "All types"}
          </Link>
        ))}
      </div>
      {requests.length === 0 ? <EmptyState icon={Inbox} title="No inquiries here" description="New messages from the home page will appear here." /> : (
        <AccessRequestList requests={JSON.parse(JSON.stringify(requests)) as AccessRequest[]} defaultQuota={defaultQuota} />
      )}
    </>
  );
}
