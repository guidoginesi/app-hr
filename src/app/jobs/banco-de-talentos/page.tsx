import { getActiveAreas } from '@/lib/talentPoolServer';
import { PublicShell } from '../PublicShell';
import { TalentPoolForm } from './TalentPoolForm';

// Las áreas se editan desde el admin: sin esto una edición no se vería hasta
// el próximo deploy.
export const dynamic = 'force-dynamic';

export default async function BancoDeTalentosPage() {
  let areas: string[] = [];
  try {
    areas = (await getActiveAreas()).map((a) => a.name);
  } catch (err) {
    console.error('Error fetching talent pool areas:', err);
  }

  return (
    <PublicShell back={{ href: '/jobs', label: 'Volver a búsquedas' }}>
      <div className="space-y-6">
        <div>
          <h1 className="type-display">Dejanos tus datos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sumate a nuestro Banco de Talentos y te tenemos en cuenta para las próximas búsquedas.
          </p>
        </div>

        {areas.length === 0 ? (
          <div className="rounded-[var(--radius)] border border-[var(--border)] bg-card p-12 text-center">
            <p className="text-sm font-medium text-foreground">
              El formulario no está disponible por el momento
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Probá de nuevo en un rato.</p>
          </div>
        ) : (
          <TalentPoolForm areas={areas} />
        )}
      </div>
    </PublicShell>
  );
}
