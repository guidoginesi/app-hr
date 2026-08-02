'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, buttonVariants } from '@pow/ui/components/ui/button';
import { Sheet, SheetTrigger, SheetContent } from '@pow/ui/components/ui/sheet';
import { Input } from '@pow/ui/components/ui/input';
import { Textarea } from '@pow/ui/components/ui/textarea';
import { SelectMenu } from '@pow/ui/components/ui/select-menu';
import {
  INQUIRY_CATEGORIES,
  CATEGORY_LABELS,
  STATUS_LABELS_EMPLOYEE,
  formatDueDate,
  type InquiryCategory,
  type InquiryStatus,
} from '@/lib/inquiries';

type Inquiry = {
  id: string;
  category: InquiryCategory;
  subject: string;
  status: InquiryStatus;
  created_at: string;
  last_activity_at: string;
  first_response_due_at: string | null;
  first_hr_response_at: string | null;
};

const statusPill: Record<InquiryStatus, string> = {
  nueva: 'bg-accent text-[var(--brand-strong)]',
  en_curso: 'bg-secondary text-secondary-foreground',
  esperando_colaborador: 'bg-warning-subtle text-[var(--amber-600)]',
  resuelta: 'bg-success-subtle text-[var(--green-700)]',
  cerrada: 'bg-secondary text-muted-foreground',
};

export function ConsultasClient() {
  const [items, setItems] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/portal/inquiries');
      const data = await res.json();
      if (res.ok) setItems(data.items ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    if (!category) return setError('Elegí una categoría.');
    if (!subject.trim()) return setError('Escribí un asunto.');
    if (!description.trim()) return setError('Contanos tu consulta.');

    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/portal/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, subject, description }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'No se pudo enviar la consulta.');
        return;
      }
      setSuccess(
        data.first_response_due_at
          ? `Consulta enviada. Te respondemos antes del ${formatDueDate(data.first_response_due_at)}.`
          : 'Consulta enviada.',
      );
      setShowForm(false);
      setCategory('');
      setSubject('');
      setDescription('');
      await load();
    } catch {
      setError('No se pudo enviar la consulta.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Consultas</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Hacé tus consultas al equipo de People y seguí el estado de cada una.
          </p>
        </div>
        {/* Panel lateral: mismo patrón de creación que Time Off y Certificados. */}
        <Sheet
          open={showForm}
          onOpenChange={(o) => {
            setShowForm(o);
            if (o) setSuccess(null);
            else setError(null);
          }}
        >
          <SheetTrigger className={buttonVariants({ variant: 'primary' })}>Nueva consulta</SheetTrigger>
          <SheetContent
            title="Nueva consulta"
            description="Contanos tu duda y el equipo de People te responde por acá"
            className="sm:max-w-xl"
          >
            {/* px-1: aire para que el ring de foco no se corte contra el overflow del Sheet */}
            <div className="space-y-4 px-1">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Categoría *</label>
                <SelectMenu
                  ariaLabel="Categoría"
                  className="w-full"
                  value={category}
                  onChange={setCategory}
                  options={[{ value: '', label: 'Elegí una categoría…' }, ...INQUIRY_CATEGORIES]}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Asunto *</label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Ej. Diferencia en mi recibo de junio"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Tu consulta *</label>
                <Textarea
                  rows={6}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Contanos con el mayor detalle posible…"
                />
              </div>
              {error && <p className="text-sm text-[var(--red-600)]">{error}</p>}
              <div className="flex items-center gap-3 pt-1">
                <Button onClick={submit} loading={saving}>Enviar consulta</Button>
                <Button variant="ghost" onClick={() => { setShowForm(false); setError(null); }}>Cancelar</Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {success && (
        <div className="rounded-lg border border-success/20 bg-success-subtle px-4 py-3 text-sm text-[var(--green-700)]">
          {success}
        </div>
      )}

      <div className="rounded-xl border border-[var(--border)] bg-warning-subtle px-5 py-3 text-sm text-[var(--amber-600)]">
        Antes de abrir una consulta, revisá la{' '}
        <Link href="/portal/ayuda" className="font-semibold underline">
          sección de Ayuda
        </Link>{' '}
        — quizás ya esté respondida.
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
        {loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Cargando…</div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Todavía no hiciste consultas.</div>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {items.map((i) => (
              <li key={i.id}>
                <Link
                  href={`/portal/consultas/${i.id}`}
                  className="flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-muted"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{i.subject}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {CATEGORY_LABELS[i.category]} · {new Date(i.created_at).toLocaleDateString('es-AR')}
                      {i.status === 'nueva' && i.first_response_due_at && !i.first_hr_response_at && (
                        <> · Te respondemos antes del {formatDueDate(i.first_response_due_at)}</>
                      )}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusPill[i.status]}`}>
                    {STATUS_LABELS_EMPLOYEE[i.status]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
