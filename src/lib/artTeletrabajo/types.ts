export type ArtNotificationType = 'pre_departure' | 'post_return';

export interface TeleworkEmployeeRow {
  apellido: string;
  nombre: string;
  cuil: string;
  calle: string;
  nro: string;
  piso: string;
  depto: string;
  localidad: string;
  provincia: string;
  cantDias: string;
  hsSemanales: string;
}

export interface ArtTeletrabajoConfig {
  employerName: string;
  employerCuit: string;
  recipients: string[];
  defaultDays: string;
  defaultWeeklyHours: string;
}
