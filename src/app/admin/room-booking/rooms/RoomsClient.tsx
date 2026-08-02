'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@pow/ui/components/ui/button';
import { Sheet, SheetContent, SheetClose } from '@pow/ui/components/ui/sheet';
import { Checkbox } from '@pow/ui/components/ui/checkbox';
import { SkeletonRows } from '@pow/ui/components/ui/skeleton';

interface Room {
  id: string;
  name: string;
  capacity: number;
  location: string | null;
  description: string | null;
  equipment: string | null;
  status: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface RoomForm {
  name: string;
  location: string;
  description: string;
  capacity: number;
  equipment: string;
  is_active: boolean;
}

const emptyForm: RoomForm = { name: '', location: '', description: '', capacity: 1, equipment: '', is_active: true };

export function RoomsClient() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [form, setForm] = useState<RoomForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => { fetchRooms(); }, []);

  async function fetchRooms() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/room-booking/rooms');
      if (res.ok) {
        const data = await res.json();
        setRooms(data.rooms || data);
      }
    } catch (error) {
      console.error('Error fetching rooms:', error);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingRoom(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(room: Room) {
    setEditingRoom(room);
    setForm({
      name: room.name,
      location: room.location || '',
      description: room.description || '',
      capacity: room.capacity,
      equipment: room.equipment || '',
      is_active: room.is_active,
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingRoom(null);
    setForm(emptyForm);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editingRoom
        ? `/api/admin/room-booking/rooms/${editingRoom.id}`
        : '/api/admin/room-booking/rooms';
      const res = await fetch(url, {
        method: editingRoom ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          location: form.location || null,
          description: form.description || null,
          capacity: form.capacity,
          equipment: form.equipment || null,
          is_active: form.is_active,
        }),
      });
      if (res.ok) {
        closeModal();
        fetchRooms();
      } else {
        const data = await res.json();
        alert(data.error || 'Error al guardar');
      }
    } catch {
      alert('Error de conexión');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(room: Room) {
    setTogglingId(room.id);
    try {
      const res = await fetch(`/api/admin/room-booking/rooms/${room.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !room.is_active }),
      });
      if (res.ok) {
        setRooms((prev) => prev.map((r) => (r.id === room.id ? { ...r, is_active: !r.is_active } : r)));
      }
    } catch (error) {
      console.error('Error toggling room:', error);
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(room: Room) {
    if (!confirm(`¿Eliminar la sala "${room.name}"? Esta acción no se puede deshacer.`)) return;
    try {
      const res = await fetch(`/api/admin/room-booking/rooms/${room.id}`, { method: 'DELETE' });
      if (res.ok) fetchRooms();
      else {
        const data = await res.json();
        alert(data.error || 'Error al eliminar');
      }
    } catch {
      alert('Error de conexión');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button onClick={openCreate}>Nueva sala</Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
        {loading ? (
          <div className="px-6 py-5">
            <SkeletonRows rows={5} />
          </div>
        ) : rooms.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">No hay salas configuradas</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)] bg-muted text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-3">Nombre</th>
                <th className="px-6 py-3">Ubicación</th>
                <th className="px-6 py-3">Capacidad</th>
                <th className="px-6 py-3">Equipamiento</th>
                <th className="px-6 py-3">Estado</th>
                <th className="px-6 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rooms.map((room) => (
                <tr key={room.id} className="hover:bg-muted">
                  <td className="px-6 py-4">
                    <p className="text-sm font-semibold text-foreground">{room.name}</p>
                    {room.description && <p className="mt-0.5 text-xs text-muted-foreground">{room.description}</p>}
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{room.location || '—'}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{room.capacity} {room.capacity === 1 ? 'persona' : 'personas'}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{room.equipment || '—'}</td>
                  <td className="px-6 py-4">
                    <button onClick={() => handleToggleActive(room)} disabled={togglingId === room.id} className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${room.is_active ? 'bg-success-subtle text-[var(--green-700)]' : 'bg-secondary text-muted-foreground'}`}>
                        {togglingId === room.id ? '…' : room.is_active ? 'Activa' : 'Inactiva'}
                      </span>
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(room)}>Editar</Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-danger/20 text-[var(--red-600)] hover:bg-danger-subtle hover:text-[var(--red-600)]"
                        onClick={() => handleDelete(room)}
                      >
                        Eliminar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <Sheet open onOpenChange={(o) => { if (!o) closeModal(); }}>
          <SheetContent side="right" flush title={editingRoom ? 'Editar sala' : 'Nueva sala'} className="max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
              <h2 className="text-base font-semibold text-foreground">{editingRoom ? 'Editar sala' : 'Nueva sala'}</h2>
              <SheetClose
                aria-label="Cerrar"
                className="-mr-1.5 grid h-8 w-8 place-items-center rounded-[var(--radius)] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-5 w-5" />
              </SheetClose>
            </div>

            {/* Form */}
            <form onSubmit={handleSave} className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 space-y-4 overflow-y-auto p-6">
                <div>
                  <label className="mb-1 block text-xs font-medium text-secondary-foreground">Nombre <span className="text-[var(--red-600)]">*</span></label>
                  <input type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Ej: Sala Patagonia" required className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-secondary-foreground">Ubicación</label>
                  <input type="text" value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} placeholder="Ej: Piso 2, Ala Norte" className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-secondary-foreground">Capacidad <span className="text-[var(--red-600)]">*</span></label>
                  <input type="number" min="1" max="100" value={form.capacity} onChange={(e) => setForm((p) => ({ ...p, capacity: parseInt(e.target.value) || 1 }))} required className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-secondary-foreground">Equipamiento</label>
                  <input type="text" value={form.equipment} onChange={(e) => setForm((p) => ({ ...p, equipment: e.target.value }))} placeholder="Ej: TV, Pizarra, Videoconferencia" className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-secondary-foreground">Descripción</label>
                  <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={2} placeholder="Descripción de la sala..." className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring" />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="is_active" checked={form.is_active} onCheckedChange={(v) => setForm((p) => ({ ...p, is_active: v === true }))} />
                  <label htmlFor="is_active" className="text-sm text-secondary-foreground">Sala activa</label>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 border-t border-[var(--border)] px-6 py-4">
                <Button type="button" variant="outline" onClick={closeModal} disabled={saving}>Cancelar</Button>
                <Button type="submit" loading={saving}>Guardar</Button>
              </div>
            </form>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
