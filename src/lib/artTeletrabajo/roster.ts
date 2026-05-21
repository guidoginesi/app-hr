import type { SupabaseClient } from '@supabase/supabase-js';
import { buildRowFromEmployee, parseRemoteLocationFromNotes } from './parseAddress';
import type { ArtTeletrabajoConfig, TeleworkEmployeeRow } from './types';

const REMOTE_LEAVE_CODES = ['remote_work', 'remote_work_trip'];

interface EmployeeRecord {
  id: string;
  first_name: string;
  last_name: string;
  cuil: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
}

interface RemoteRequestRecord {
  employee_id: string;
  notes: string | null;
}

/** Arma el listado completo de relación de dependencia para una fecha de referencia. */
export async function buildTeleworkRoster(
  supabase: SupabaseClient,
  asOfDate: string,
  config: Pick<ArtTeletrabajoConfig, 'defaultDays' | 'defaultWeeklyHours'>,
): Promise<TeleworkEmployeeRow[]> {
  const { data: employees, error: employeesError } = await supabase
    .from('employees')
    .select('id, first_name, last_name, cuil, address, city, country, employment_type')
    .eq('status', 'active')
    .eq('employment_type', 'dependency')
    .order('last_name', { ascending: true })
    .order('first_name', { ascending: true });

  if (employeesError) {
    throw new Error(`Error obteniendo empleados: ${employeesError.message}`);
  }

  const { data: leaveTypes } = await supabase
    .from('leave_types')
    .select('id, code')
    .in('code', REMOTE_LEAVE_CODES);

  const remoteTypeIds = (leaveTypes ?? []).map((t) => t.id);
  const remoteNotesByEmployee = new Map<string, string>();

  if (remoteTypeIds.length > 0) {
    const { data: activeRemoteRequests, error: remoteError } = await supabase
      .from('leave_requests')
      .select('employee_id, notes')
      .eq('status', 'approved')
      .in('leave_type_id', remoteTypeIds)
      .lte('start_date', asOfDate)
      .gte('end_date', asOfDate);

    if (remoteError) {
      throw new Error(`Error obteniendo licencias remotas: ${remoteError.message}`);
    }

    for (const request of (activeRemoteRequests ?? []) as RemoteRequestRecord[]) {
      remoteNotesByEmployee.set(request.employee_id, request.notes ?? '');
    }
  }

  const defaults = {
    cantDias: config.defaultDays,
    hsSemanales: config.defaultWeeklyHours,
  };

  return ((employees ?? []) as EmployeeRecord[]).map((employee) => {
    const notes = remoteNotesByEmployee.get(employee.id);
    if (notes) {
      const location = parseRemoteLocationFromNotes(notes);
      return buildRowFromEmployee(
        employee,
        defaults,
        location.domicilio || undefined,
        location.destino || undefined,
      );
    }
    return buildRowFromEmployee(employee, defaults);
  });
}

export interface LeaveTrigger {
  id: string;
  employee_name: string;
  start_date: string;
  end_date: string;
  leave_type_code: string;
}

export async function findDeparturesStartingOn(
  supabase: SupabaseClient,
  startDate: string,
): Promise<LeaveTrigger[]> {
  const { data, error } = await supabase
    .from('leave_requests_with_details')
    .select('id, employee_name, start_date, end_date, leave_type_code')
    .eq('status', 'approved')
    .in('leave_type_code', REMOTE_LEAVE_CODES)
    .eq('start_date', startDate);

  if (error) throw new Error(error.message);
  return (data ?? []) as LeaveTrigger[];
}

export async function findReturnsEndingOn(
  supabase: SupabaseClient,
  endDate: string,
): Promise<LeaveTrigger[]> {
  const { data, error } = await supabase
    .from('leave_requests_with_details')
    .select('id, employee_name, start_date, end_date, leave_type_code')
    .eq('status', 'approved')
    .in('leave_type_code', REMOTE_LEAVE_CODES)
    .eq('end_date', endDate);

  if (error) throw new Error(error.message);
  return (data ?? []) as LeaveTrigger[];
}

export function getArtTeletrabajoConfig(): ArtTeletrabajoConfig {
  const recipients = (process.env.ART_TELETRABAJO_RECIPIENTS ?? 'guido@pow.la,agustina.marques@pow.la')
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean);

  return {
    employerName: process.env.ART_EMPLOYER_NAME ?? 'Pow S.A.',
    employerCuit: process.env.ART_EMPLOYER_CUIT ?? '30-71439537-4',
    recipients,
    defaultDays: process.env.ART_TELETRABAJO_DEFAULT_DAYS ?? '5',
    defaultWeeklyHours: process.env.ART_TELETRABAJO_DEFAULT_HOURS ?? '40',
  };
}
