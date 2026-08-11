'use client';

import { useState } from 'react';
import { TabNav } from '@pow/ui/components/ui/tab-nav';
import { EmailTemplatesClient } from './EmailTemplatesClient';
import { TalentPoolAreasPanel } from './TalentPoolAreasPanel';

type Section = 'mails' | 'areas';

export function ConfigClient() {
  const [section, setSection] = useState<Section>('mails');

  return (
    <div className="space-y-6">
      <TabNav<Section>
        aria-label="Configuración de Reclutamiento"
        value={section}
        onChange={setSection}
        options={[
          { value: 'mails', label: 'Plantillas de mail' },
          { value: 'areas', label: 'Áreas del Banco' },
        ]}
      />
      {section === 'mails' ? <EmailTemplatesClient /> : <TalentPoolAreasPanel />}
    </div>
  );
}
