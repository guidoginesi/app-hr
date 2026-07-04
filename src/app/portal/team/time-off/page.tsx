import { redirect } from 'next/navigation';

// Ruta legacy: la gestión de Time Off del equipo vive en la pestaña "Mi equipo"
// de Time Off (rediseñada). Redirigimos para no mantener dos UIs divergentes.
export default function LegacyTeamTimeOffPage() {
  redirect('/portal/time-off/team');
}
