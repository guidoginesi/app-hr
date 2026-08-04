import { ReactNode } from 'react';
import { AdminShell } from '@/app/admin/AdminShell';
import { PageHeader } from '@pow/ui/components/ui/page-header';
import { MessagesTabs } from './MessagesTabs';

type MessagesTab = 'mensajes' | 'configuracion';

export function MessagesLayout({
  active,
  actions,
  showTabs = true,
  children,
}: {
  active?: MessagesTab;
  actions?: ReactNode;
  showTabs?: boolean;
  children: ReactNode;
}) {
  return (
    <AdminShell active="messages">
      <div className="space-y-6">
        <PageHeader
          title="Comunicaciones"
          description="Anuncios y avisos que People le envía al equipo, con seguimiento de lectura y entrega"
          actions={actions}
        />
        {showTabs && active && <MessagesTabs active={active} />}
        {children}
      </div>
    </AdminShell>
  );
}
