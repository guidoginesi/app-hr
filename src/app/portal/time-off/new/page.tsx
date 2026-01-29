'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { LeaveType, LeaveBalanceWithDetails } from '@/types/time-off';
import { MondayDatePicker } from '@/components/MondayDatePicker';

// Parse date string as local date to avoid timezone issues
function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export default function NewTimeOffRequestPage() {
  const router = useRouter();
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<LeaveBalanceWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [selectedType, setSelectedType] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [vacationWeeks, setVacationWeeks] = useState<number>(1);
  const [notes, setNotes] = useState('');
  
  // Remote work specific fields
  const [remoteDestino, setRemoteDestino] = useState('');
  const [remoteDomicilio, setRemoteDomicilio] = useState('');
  const [remoteContactoNombre, setRemoteContactoNombre] = useState('');
  const [remoteContactoTelefono, setRemoteContactoTelefono] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  // Reset weeks to 1 when type changes to ensure it's always valid
  useEffect(() => {
    setVacationWeeks(1);
  }, [selectedType]);

  async function fetchData() {
    try {
      const [typesRes, balancesRes] = await Promise.all([
        fetch('/api/portal/time-off/leave-types'),
        fetch('/api/portal/time-off/balances'),
      ]);

      if (typesRes.ok) {
        const data = await typesRes.json();
        setLeaveTypes(data);
      }
      if (balancesRes.ok) {
        const data = await balancesRes.json();
        setBalances(data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  function calculateDays(): number {
    if (!startDate || !endDate) return 0;

    const start = parseLocalDate(startDate);
    const end = parseLocalDate(endDate);

    if (end < start) return 0;

    const selectedLeaveType = leaveTypes.find((t) => t.id === selectedType);

    if (selectedLeaveType?.count_type === 'weeks') {
      // Count weeks
      const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return Math.ceil(days / 7);
    } else if (selectedLeaveType?.count_type === 'business_days') {
      // Count business days (Mon-Fri)
      let count = 0;
      const current = new Date(start);
      while (current <= end) {
        const day = current.getDay();
        if (day !== 0 && day !== 6) count++;
        current.setDate(current.getDate() + 1);
      }
      return count;
    } else {
      // Calendar days
      return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }
  }

  function getBalanceForType(typeId: string): LeaveBalanceWithDetails | undefined {
    return balances.find((b) => b.leave_type_id === typeId);
  }

  function getAvailableDays(typeId: string): number {
    const balance = getBalanceForType(typeId);
    if (!balance) return 0;
    return balance.available_days;
  }

  // Check if selected type is vacation
  function isVacationType(): boolean {
    const type = leaveTypes.find((t) => t.id === selectedType);
    return type?.code === 'vacation';
  }

  // Check if selected type is remote work
  function isRemoteWorkType(): boolean {
    const type = leaveTypes.find((t) => t.id === selectedType);
    return type?.code === 'remote_work';
  }

  // Check if selected type requires week-based selection (Monday to Sunday)
  function isWeekBasedType(): boolean {
    return isVacationType() || isRemoteWorkType();
  }

  // Check if a date is Monday
  function isMonday(dateStr: string): boolean {
    if (!dateStr) return false;
    const date = parseLocalDate(dateStr);
    return date.getDay() === 1;
  }

  // Calculate end date for vacations based on weeks
  function calculateVacationEndDate(start: string, weeks: number): string {
    if (!start) return '';
    const startDate = parseLocalDate(start);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + (weeks * 7) - 1); // -1 because we include start day
    return endDate.toISOString().split('T')[0];
  }

  // Get next Monday from a given date
  function getNextMonday(dateStr: string): string {
    const date = parseLocalDate(dateStr);
    const day = date.getDay();
    const daysUntilMonday = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
    date.setDate(date.getDate() + daysUntilMonday);
    return date.toISOString().split('T')[0];
  }

  // Handle start date change for week-based types (vacations, remote work)
  function handleStartDateChange(value: string) {
    setStartDate(value);
    
    // For week-based types, auto-calculate end date
    if (isWeekBasedType() && value) {
      const calculatedEnd = calculateVacationEndDate(value, vacationWeeks);
      setEndDate(calculatedEnd);
    }
  }

  // Handle vacation weeks change
  function handleVacationWeeksChange(weeks: number) {
    setVacationWeeks(weeks);
    if (startDate) {
      const calculatedEnd = calculateVacationEndDate(startDate, weeks);
      setEndDate(calculatedEnd);
    }
  }

  // Handle leave type change
  function handleTypeChange(typeId: string) {
    setSelectedType(typeId);
    // Reset dates when changing type
    setStartDate('');
    setEndDate('');
    setVacationWeeks(1);
    // Reset remote work fields
    setRemoteDestino('');
    setRemoteDomicilio('');
    setRemoteContactoNombre('');
    setRemoteContactoTelefono('');
  }

  // Get available weeks based on balance and type
  function getMaxVacationWeeks(): number {
    const balance = getBalanceForType(selectedType);
    if (!balance) {
      // Default max: 5 for vacation, 8 for remote work
      return isRemoteWorkType() ? 8 : 5;
    }
    const maxByType = isRemoteWorkType() ? 8 : 5;
    // For remote work, available_days is already in weeks
    const availableWeeks = isRemoteWorkType() 
      ? balance.available_days 
      : Math.ceil(balance.available_days / 7);
    return Math.min(maxByType, availableWeeks);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!selectedType || !startDate || !endDate) {
      setError('Por favor completa todos los campos requeridos');
      return;
    }

    const days = calculateDays();
    if (days <= 0) {
      setError('Las fechas seleccionadas no son válidas');
      return;
    }

    const selectedLeaveType = leaveTypes.find((t) => t.id === selectedType);

    // Validate vacation weeks (must start Monday, end Sunday)
    if (selectedLeaveType?.code === 'vacation') {
      const start = parseLocalDate(startDate);
      const end = parseLocalDate(endDate);

      if (start.getDay() !== 1) {
        setError('Las vacaciones deben comenzar un lunes');
        return;
      }
      if (end.getDay() !== 0) {
        setError('Las vacaciones deben terminar un domingo');
        return;
      }
    }

    // Validate remote work weeks and required fields
    if (selectedLeaveType?.code === 'remote_work') {
      const start = parseLocalDate(startDate);
      const end = parseLocalDate(endDate);

      if (start.getDay() !== 1) {
        setError('Las semanas de trabajo remoto deben comenzar un lunes');
        return;
      }
      if (end.getDay() !== 0) {
        setError('Las semanas de trabajo remoto deben terminar un domingo');
        return;
      }
      
      // Validate required remote work fields
      if (!remoteDestino.trim() || !remoteDomicilio.trim() || !remoteContactoNombre.trim() || !remoteContactoTelefono.trim()) {
        setError('Por favor completa todos los campos de información de trabajo remoto');
        return;
      }
    }

    // Build notes with remote work info if applicable
    let finalNotes = notes;
    if (selectedLeaveType?.code === 'remote_work') {
      const remoteInfo = `📍 INFORMACIÓN DE TRABAJO REMOTO\n` +
        `Destino: ${remoteDestino}\n` +
        `Domicilio: ${remoteDomicilio}\n` +
        `Contacto de emergencia: ${remoteContactoNombre} - Tel: ${remoteContactoTelefono}` +
        (notes ? `\n\nNotas adicionales: ${notes}` : '');
      finalNotes = remoteInfo;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/portal/time-off/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leave_type_id: selectedType,
          start_date: startDate,
          end_date: endDate,
          days_requested: days,
          notes: finalNotes || null,
        }),
      });

      if (res.ok) {
        router.push('/portal/time-off');
      } else {
        const data = await res.json();
        setError(data.error || 'Error al crear la solicitud');
      }
    } catch (error) {
      setError('Error al crear la solicitud');
    } finally {
      setSubmitting(false);
    }
  }

  const selectedLeaveType = leaveTypes.find((t) => t.id === selectedType);
  const daysCalculated = calculateDays();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/portal/time-off"
          className="mb-6 inline-flex items-center text-sm text-zinc-500 hover:text-zinc-900"
        >
          <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver a Time Off
        </Link>

        <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-zinc-900">Nueva solicitud</h1>
          <p className="mt-1 text-sm text-zinc-500">Solicita vacaciones, días Pow u otras licencias</p>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            {/* Tipo de licencia */}
            <div>
              <label className="block text-sm font-medium text-zinc-700">Tipo de licencia</label>
              {leaveTypes.filter((type) => getAvailableDays(type.id) > 0).length === 0 ? (
                <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm text-amber-800">
                    No tienes días disponibles para solicitar licencias en este momento.
                  </p>
                </div>
              ) : (
                <select
                  value={selectedType}
                  onChange={(e) => handleTypeChange(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  required
                >
                  <option value="">Selecciona un tipo</option>
                  {leaveTypes
                    .filter((type) => getAvailableDays(type.id) > 0)
                    .map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name} - Disponible: {getAvailableDays(type.id)}{' '}
                        {type.count_type === 'weeks' ? 'semanas' : 'días'}
                      </option>
                    ))}
                </select>
              )}
              {selectedLeaveType && (
                <p className="mt-1 text-xs text-zinc-500">{selectedLeaveType.description}</p>
              )}
            </div>

            {/* Fechas - Vacaciones y Trabajo Remoto (semanas completas) */}
            {isWeekBasedType() && (
              <div className="space-y-4">
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <ul className="text-sm text-amber-800 space-y-1">
                    <li>
                      • {isVacationType() 
                        ? 'Las vacaciones deben ser en '
                        : 'El trabajo remoto debe ser en '}
                      <strong>semanas completas</strong> (lunes a domingo).
                    </li>
                    {selectedLeaveType && selectedLeaveType.advance_notice_days > 0 && (
                      <li>
                        • Requiere <strong>{selectedLeaveType.advance_notice_days} días de anticipación</strong>.
                      </li>
                    )}
                  </ul>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700">
                      Fecha de inicio
                    </label>
                    <MondayDatePicker
                      value={startDate}
                      onChange={handleStartDateChange}
                      advanceNoticeDays={selectedLeaveType?.advance_notice_days || 0}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700">Duración</label>
                    <select
                      value={vacationWeeks}
                      onChange={(e) => handleVacationWeeksChange(Number(e.target.value))}
                      className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].slice(0, getMaxVacationWeeks() || 8).map((weeks) => (
                        <option key={weeks} value={weeks}>
                          {weeks} semana{weeks > 1 ? 's' : ''} ({weeks * 7} días)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {startDate && endDate && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-sm text-emerald-800">
                      <strong>Período:</strong>{' '}
                      {parseLocalDate(startDate).toLocaleDateString('es-AR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                      })}{' '}
                      al{' '}
                      {parseLocalDate(endDate).toLocaleDateString('es-AR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                )}

                {/* Remote work additional fields */}
                {isRemoteWorkType() && (
                  <div className="space-y-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <p className="text-sm text-blue-800">
                      En el caso de que trabajes temporalmente desde otro lugar que no sea el habitual 
                      declarado al momento del ingreso, deberás completar la siguiente información:
                    </p>
                    
                    <div>
                      <label className="block text-sm font-medium text-blue-900">
                        Destino <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={remoteDestino}
                        onChange={(e) => setRemoteDestino(e.target.value)}
                        placeholder="Ej: Córdoba, Argentina"
                        className="mt-1 block w-full rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-blue-900">
                        Domicilio <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={remoteDomicilio}
                        onChange={(e) => setRemoteDomicilio(e.target.value)}
                        placeholder="Ej: Av. Colón 1234, Piso 5, Depto B"
                        className="mt-1 block w-full rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-blue-900">
                        Contacto de emergencia
                      </label>
                      <div className="mt-1 grid grid-cols-2 gap-3">
                        <div>
                          <input
                            type="text"
                            value={remoteContactoNombre}
                            onChange={(e) => setRemoteContactoNombre(e.target.value)}
                            placeholder="Nombre y vínculo"
                            className="block w-full rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            required
                          />
                          <p className="mt-1 text-xs text-blue-600">Ej: Juan Pérez (hermano)</p>
                        </div>
                        <div>
                          <input
                            type="tel"
                            value={remoteContactoTelefono}
                            onChange={(e) => setRemoteContactoTelefono(e.target.value)}
                            placeholder="Teléfono"
                            className="block w-full rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            required
                          />
                          <p className="mt-1 text-xs text-blue-600">Ej: +54 11 1234-5678</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Fechas - Otros tipos (Días Pow, Estudio) */}
            {selectedType && !isWeekBasedType() && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700">Fecha de inicio</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700">Fecha de fin</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>
            )}

            {/* Días calculados - solo para tipos que no son vacaciones */}
            {daysCalculated > 0 && selectedLeaveType && !isVacationType() && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm text-emerald-800">
                  <strong>{daysCalculated}</strong>{' '}
                  {selectedLeaveType.count_type === 'weeks'
                    ? `semana${daysCalculated > 1 ? 's' : ''}`
                    : selectedLeaveType.count_type === 'business_days'
                    ? `día${daysCalculated > 1 ? 's' : ''} hábiles`
                    : `día${daysCalculated > 1 ? 's' : ''} corridos`}
                </p>
              </div>
            )}

            {/* Advertencia de anticipación - solo para tipos que no son week-based (ya está incluido arriba) */}
            {selectedLeaveType && selectedLeaveType.advance_notice_days > 0 && !isWeekBasedType() && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm text-amber-800">
                  Este tipo de licencia requiere{' '}
                  <strong>{selectedLeaveType.advance_notice_days} días de anticipación</strong>.
                </p>
              </div>
            )}


            {/* Notas */}
            <div>
              <label className="block text-sm font-medium text-zinc-700">Notas (opcional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Agrega cualquier comentario adicional..."
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Botones */}
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={
                  submitting || 
                  !selectedType || 
                  daysCalculated <= 0 ||
                  (isRemoteWorkType() && (!remoteDestino.trim() || !remoteDomicilio.trim() || !remoteContactoNombre.trim() || !remoteContactoTelefono.trim()))
                }
                className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Enviando...' : 'Enviar solicitud'}
              </button>
              <Link
                href="/portal/time-off"
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cancelar
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
