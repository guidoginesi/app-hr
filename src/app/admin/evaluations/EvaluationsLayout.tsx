import { ReactNode } from 'react';
import { AdminShell } from '@/app/admin/AdminShell';
import { PageHeader } from '@pow/ui/components/ui/page-header';
import { EvaluationsTabs, type EvaluationsTab } from './EvaluationsTabs';

export function EvaluationsLayout({
  active,
  actions,
  children,
}: {
  active: EvaluationsTab;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <AdminShell active="evaluations">
      <div className="space-y-6">
        <PageHeader
          title="Evaluaciones"
          description="Evaluaciones de desempeño y feedback 360°"
          actions={actions}
        />
        <EvaluationsTabs active={active} />
        {children}
      </div>
    </AdminShell>
  );
}
