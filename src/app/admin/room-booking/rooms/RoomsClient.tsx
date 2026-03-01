'use client';

import { useEffect, useState } from 'react';

interface Room {
  id: string;
  name: string;
  floor: string | null;
  capacity: number;
  amenities: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface RoomForm {
  name: string;
  floor: string;
  capacity: number;
  amenities: string[];
  is_active: boolean;
}

const emptyForm: RoomForm = { name: '', floor: '', capacity: 1, amenities: [], is_active: true };

const AMENITY_OPTIONS = [
  'Proyector',
  'Pizarra',
  'TV',
  'Videoconferencia',
  'Aire acondicionado',
  'Teléfono',
  'Webcam',
  'Micrófono',
];

export function RoomsClient() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [form, setForm] = useState<RoomForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    fetchRooms();
  }, []);

  async function fetchRooms() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/room-booking/rooms');
      if (res.ok) {
        setRooms(await res.json());
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
      floor: room.floor || '',
      capacity: room.capacity,
      amenities: room.amenities || [],
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
      const payload = {
        ...(editingRoom ? { id: editingRoom.id } : {}),
        name: form.name,
        floor: form.floor || null,
        capacity: form.capacity,
        amenities: form.amenities,
        is_active: form.is_active,
      };

      const res = await fetch('/api/admin/room-booking/rooms', {
        method: editingRoom ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        closeModal();
        fetchRooms();
      } else {
        const data = await res.json();
        alert(data.error || 'Error al guardar');
      }
    } catch (error) {
      console.error('Error saving room:', error);
      alert('Error de conexión');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(room: Room) {
    setTogglingId(room.id);
    try {
      const res = await fetch('/api/admin/room-booking/rooms', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: room.id, is_active: !room.is_active }),
      });

      if (res.ok) {
        setRooms((prev) =>
          prev.map((r) => (r.id === room.id ? { ...r, is_active: !r.is_active } : r))
        );
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
      const res = await fetch(`/api/admin/room-booking/rooms?id=${room.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchRooms();
      } else {
        const data = await res.json();
        alert(data.error || 'Error al eliminar');
      }
    } catch (error) {
      console.error('Error deleting room:', error);
      alert('Error de conexión');
    }
  }

  function toggleAmenity(amenity: string) {
    setForm((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter((a) => a !== amenity)
        : [...prev.amenities, amenity],
    }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Salas</h1>
          <p className="mt-1 text-sm text-zinc-500">Gestiona las salas de reunión disponibles</p>
        </div>
        <button
          onClick={openCreate}
          className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700"
        >
          Nueva sala
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent" />
          </div>
        ) : rooms.length === 0 ? (
          <div className="py-12 text-center text-sm text-zinc-500">
            No hay salas configuradas
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <th className="px-6 py-3">Nombre</th>
                <th className="px-6 py-3">Piso</th>
                <th className="px-6 py-3">Capacidad</th>
                <th className="px-6 py-3">Amenities</th>
                <th className="px-6 py-3">Estado</th>
                <th className="px-6 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {rooms.map((room) => (
                <tr key={room.id} className="hover:bg-zinc-50">
                  <td className="px-6 py-4">
                    <p className="font-medium text-zinc-900">{room.name}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-600">{room.floor || '—'}</td>
                  <td className="px-6 py-4 text-sm text-zinc-600">
                    {room.capacity} {room.capacity === 1 ? 'persona' : 'personas'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {room.amenities && room.amenities.length > 0 ? (
                        room.amenities.map((amenity) => (
                          <span
                            key={amenity}
                            className="inline-flex items-center rounded-full bg-cyan-50 px-2 py-0.5 text-xs font-medium text-cyan-700"
                          >
                            {amenity}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleToggleActive(room)}
                      disabled={togglingId === room.id}
                      className="focus:outline-none"
                    >
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          room.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-zinc-100 text-zinc-500'
                        }`}
                      >
                        {togglingId === room.id ? '...' : room.is_active ? 'Activa' : 'Inactiva'}
                      </span>
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEdit(room)}
                        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(room)}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!loading && rooms.length > 0 && (
        <div className="text-sm text-zinc-500">
          {rooms.length} sala{rooms.length !== 1 ? 's' : ''} ·{' '}
          {rooms.filter((r) => r.is_active).length} activa{rooms.filter((r) => r.is_active).length !== 1 ? 's' : ''}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={closeModal} />
            <div className="relative w-full max-w-md rounded-xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-zinc-900">
                  {editingRoom ? 'Editar sala' : 'Nueva sala'}
                </h2>
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleSave}>
                <div className="space-y-4 p-6">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700">
                      Nombre <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="Ej: Sala Patagonia"
                      required
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700">Piso</label>
                    <input
                      type="text"
                      value={form.floor}
                      onChange={(e) => setForm((prev) => ({ ...prev, floor: e.target.value }))}
                      placeholder="Ej: 3"
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700">
                      Capacidad <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={form.capacity}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, capacity: parseInt(e.target.value) || 1 }))
                      }
                      required
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700">
                      Amenities
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {AMENITY_OPTIONS.map((amenity) => (
                        <button
                          key={amenity}
                          type="button"
                          onClick={() => toggleAmenity(amenity)}
                          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                            form.amenities.includes(amenity)
                              ? 'bg-cyan-600 text-white'
                              : 'border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50'
                          }`}
                        >
                          {amenity}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={form.is_active}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, is_active: e.target.checked }))
                      }
                      className="h-4 w-4 rounded border-zinc-300 text-cyan-600 focus:ring-cyan-500"
                    />
                    <label htmlFor="is_active" className="text-sm text-zinc-700">
                      Sala activa
                    </label>
                  </div>
                </div>
                <div className="flex justify-end gap-3 border-t border-zinc-200 px-6 py-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-50"
                  >
                    {saving ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
