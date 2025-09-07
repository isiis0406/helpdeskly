import { auth } from "@/app/api/auth/[...nextauth]/route";
import { cookies } from "next/headers";
import TenantPickerSelect from "./tenant-picker-select";

interface Profile {
  memberships?: Array<{
    tenantSlug?: string;
    tenantName?: string;
    tenant?: {
      slug: string;
      name: string;
    };
  }>;
}

export default async function TenantMenu() {
  // Read memberships from session to avoid a guarded Control API call on each render
  const session = await auth();
  const memberships = ((session as any)?.user?.memberships || []) as Profile["memberships"]
  const cookieStore = await cookies();
  const current = cookieStore.get("tenantSlug")?.value;
  const options = memberships.map((m: any) => ({
    slug: m.tenantSlug || m.tenant?.slug,
    name: m.tenantName || m.tenant?.name,
  }));
  return <TenantPickerSelect options={options} current={current} />;
}
