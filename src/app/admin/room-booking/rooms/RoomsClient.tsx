'use client';

import { useEffect, useState } from 'react';

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Salas</h1>
          <p className="mt-1 text-sm text-muted-foreground">Gestiona las salas de reunión disponibles</p>
        </div>
        <button onClick={openCreate} className="rounded-lg bg-cat-cyan px-4 py-2 text-sm font-medium text-white hover:bg-cat-cyan">Nueva sala</button>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-cat-cyan border-t-transparent" /></div>
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
                    <p className="font-medium text-foreground">{room.name}</p>
                    {room.description && <p className="mt-0.5 text-xs text-muted-foreground">{room.description}</p>}
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{room.location || '—'}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{room.capacity} {room.capacity === 1 ? 'persona' : 'personas'}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{room.equipment || '—'}</td>
                  <td className="px-6 py-4">
                    <button onClick={() => handleToggleActive(room)} disabled={togglingId === room.id} className="focus:outline-none">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${room.is_active ? 'bg-success-subtle text-[var(--green-700)]' : 'bg-secondary text-muted-foreground'}`}>
                        {togglingId === room.id ? '...' : room.is_active ? 'Activa' : 'Inactiva'}
                      </span>
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(room)} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-muted">Editar</button>
                      <button onClick={() => handleDelete(room)} className="rounded-lg border border-danger/20 px-3 py-1.5 text-xs font-medium text-[var(--red-600)] hover:bg-danger-subtle">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={closeModal} />
            <div className="relative w-full max-w-md rounded-xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
                <h2 className="text-lg font-semibold text-foreground">{editingRoom ? 'Editar sala' : 'Nueva sala'}</h2>
                <button type="button" onClick={closeModal} className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <form onSubmit={handleSave}>
                <div className="space-y-4 p-6">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-secondary-foreground">Nombre <span className="text-[var(--red-600)]">*</span></label>
                    <input type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Ej: Sala Patagonia" required className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-cat-cyan focus:outline-none focus:ring-1 focus:ring-cat-cyan" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-secondary-foreground">Ubicación</label>
                    <input type="text" value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} placeholder="Ej: Piso 2, Ala Norte" className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-cat-cyan focus:outline-none focus:ring-1 focus:ring-cat-cyan" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-secondary-foreground">Capacidad <span className="text-[var(--red-600)]">*</span></label>
                    <input type="number" min="1" max="100" value={form.capacity} onChange={(e) => setForm((p) => ({ ...p, capacity: parseInt(e.target.value) || 1 }))} required className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-cat-cyan focus:outline-none focus:ring-1 focus:ring-cat-cyan" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-secondary-foreground">Equipamiento</label>
                    <input type="text" value={form.equipment} onChange={(e) => setForm((p) => ({ ...p, equipment: e.target.value }))} placeholder="Ej: TV, Pizarra, Videoconferencia" className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-cat-cyan focus:outline-none focus:ring-1 focus:ring-cat-cyan" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-secondary-foreground">Descripción</label>
                    <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={2} placeholder="Descripción de la sala..." className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-cat-cyan focus:outline-none focus:ring-1 focus:ring-cat-cyan" />
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="is_active" checked={form.is_active} onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))} className="h-4 w-4 rounded border-[var(--border)] text-cat-cyan focus:ring-cat-cyan" />
                    <label htmlFor="is_active" className="text-sm text-secondary-foreground">Sala activa</label>
                  </div>
                </div>
                <div className="flex justify-end gap-3 border-t border-[var(--border)] px-6 py-4">
                  <button type="button" onClick={closeModal} className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-muted">Cancelar</button>
                  <button type="submit" disabled={saving} className="rounded-lg bg-cat-cyan px-4 py-2 text-sm font-medium text-white hover:bg-cat-cyan disabled:opacity-50">{saving ? 'Guardando...' : 'Guardar'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
