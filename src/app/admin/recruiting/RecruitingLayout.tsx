import { ReactNode } from 'react';
import { AdminShell } from '@/app/admin/AdminShell';
import { PageHeader } from '@pow/ui/components/ui/page-header';
import { RecruitingTabs } from './RecruitingTabs';

type RecruitingTab = 'dashboard' | 'busquedas' | 'candidatos' | 'banco' | 'configuracion';

export function RecruitingLayout({
  active,
  actions,
  children,
}: {
  active: RecruitingTab;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <AdminShell active="recruiting">
      <div className="space-y-6">
        <PageHeader
          title="Reclutamiento"
          description="Búsquedas, candidatos y proceso de selección"
          actions={actions}
        />
        <RecruitingTabs active={active} />
        {children}
      </div>
    </AdminShell>
  );
}
