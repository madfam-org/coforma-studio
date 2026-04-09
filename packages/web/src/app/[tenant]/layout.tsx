import { redirect } from 'next/navigation';

import { TenantNav } from '@/components/TenantNav';
import { getSession } from '@/lib/auth';

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { tenant: string };
}) {
  const session = await getSession();

  if (!session) {
    redirect('/auth/signin');
  }

  // Find the tenant in user's memberships
  const tenantMembership = session.user.tenants.find(
    (t) => t.slug === params.tenant
  );

  if (!tenantMembership) {
    // User doesn't have access to this tenant
    if (session.user.tenants.length > 0) {
      redirect(`/${session.user.tenants[0].slug}`);
    }
    redirect('/auth/signin');
  }

  return (
    <div className="flex h-screen">
      <TenantNav
        tenantSlug={params.tenant}
        tenantName={tenantMembership.name}
        userRole={tenantMembership.role}
      />
      <main className="flex-1 overflow-y-auto bg-background">
        {children}
      </main>
    </div>
  );
}
