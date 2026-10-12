import { Inbox } from "lucide-react";
import { AccessRequestList, type AccessRequest } from "@/components/admin/access-requests";
import { FilterTabs } from "@/components/admin/filter-tabs";
import { EmptyState } from "@/components/common/states";
import { PageHeader } from "@/components/common/page-header";
import { listAccessRequests, type AccessRequestStatus } from "@/lib/services/admin";
import { getDefaultQuota } from "@/lib/services/platform";

export const metadata = { title: "Access requests" };

const TABS: { value: "all" | AccessRequestStatus; label: string }[] = [
  { value: "all", label: "All" }, { value: "new", label: "New" }, { value: "contacted", label: "Contacted" },
  { value: "approved", label: "Approved" }, { value: "rejected", label: "Rejected" },
];

export default async function AccessRequestsPage(props: PageProps<"/admin/requests">) {
  const sp = await props.searchParams;
  const status = TABS.find((t) => t.value === sp.status && t.value !== "all")?.value as AccessRequestStatus | undefined;
  const [requests, defaultQuota] = await Promise.all([listAccessRequests(status), getDefaultQuota()]);
  return (
    <>
      <PageHeader title="Access requests" description="Requests from the home page form. Approve to create a one-time sign-up link." />
      <FilterTabs base="/admin/requests" param="status" current={status ?? "all"} tabs={TABS} />
      {requests.length === 0 ? <EmptyState icon={Inbox} title="No requests here" description="New requests from the home page will appear here." /> : (
        <AccessRequestList requests={JSON.parse(JSON.stringify(requests)) as AccessRequest[]} defaultQuota={defaultQuota} />
      )}
    </>
  );
}
