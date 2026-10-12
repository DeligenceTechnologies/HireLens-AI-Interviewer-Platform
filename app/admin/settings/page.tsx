import { PlatformSettingsForm } from "@/components/admin/settings-form";
import { PageHeader } from "@/components/common/page-header";
import { getPlatformSettings } from "@/lib/services/admin";

export const metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  const settings = await getPlatformSettings();
  return (
    <>
      <PageHeader title="Platform settings" description="Sign-up access and defaults for new companies." />
      <div className="max-w-2xl"><PlatformSettingsForm initial={settings} /></div>
    </>
  );
}
