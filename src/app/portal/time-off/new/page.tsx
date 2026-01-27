'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { LeaveType, LeaveBalanceWithDetails } from '@/types/time-off';

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
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

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

    // Validate remote work weeks
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
          notes: notes || null,
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
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                required
              >
                <option value="">Selecciona un tipo</option>
                {leaveTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name} - Disponible: {getAvailableDays(type.id)}{' '}
                    {type.count_type === 'weeks' ? 'semanas' : 'días'}
                  </option>
                ))}
              </select>
              {selectedLeaveType && (
                <p className="mt-1 text-xs text-zinc-500">{selectedLeaveType.description}</p>
              )}
            </div>

            {/* Fechas */}
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

            {/* Días calculados */}
            {daysCalculated > 0 && selectedLeaveType && (
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

            {/* Advertencia de anticipación */}
            {selectedLeaveType && selectedLeaveType.advance_notice_days > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm text-amber-800">
                  Este tipo de licencia requiere{' '}
                  <strong>{selectedLeaveType.advance_notice_days} días de anticipación</strong>.
                </p>
              </div>
            )}

            {/* Info trabajo remoto */}
            {selectedLeaveType?.code === 'remote_work' && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm text-blue-800">
                  Las semanas de trabajo remoto deben ser <strong>completas</strong> (de lunes a
                  domingo). Selecciona un lunes como fecha de inicio y el domingo siguiente como
                  fecha de fin.
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
                disabled={submitting || !selectedType || daysCalculated <= 0}
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
