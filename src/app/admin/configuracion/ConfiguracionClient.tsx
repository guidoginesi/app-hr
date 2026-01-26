'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { LegalEntity, Department } from '@/types/employee';

type DepartmentWithEntity = Department & {
	legal_entity: { id: string; name: string } | null;
};

type ConfiguracionClientProps = {
	initialLegalEntities: LegalEntity[];
	initialDepartments: DepartmentWithEntity[];
};

type Tab = 'entities' | 'departments';

export function ConfiguracionClient({ initialLegalEntities, initialDepartments }: ConfiguracionClientProps) {
	const router = useRouter();
	const [activeTab, setActiveTab] = useState<Tab>('entities');

	// Legal entities state
	const [legalEntities, setLegalEntities] = useState<LegalEntity[]>(initialLegalEntities);
	const [editingEntity, setEditingEntity] = useState<LegalEntity | null>(null);
	const [newEntityName, setNewEntityName] = useState('');
	const [newEntityCountry, setNewEntityCountry] = useState('');
	const [entitySaving, setEntitySaving] = useState(false);
	const [entityMessage, setEntityMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

	// Departments state
	const [departments, setDepartments] = useState<DepartmentWithEntity[]>(initialDepartments);
	const [editingDepartment, setEditingDepartment] = useState<DepartmentWithEntity | null>(null);
	const [newDeptName, setNewDeptName] = useState('');
	const [newDeptEntityId, setNewDeptEntityId] = useState('');
	const [deptSaving, setDeptSaving] = useState(false);
	const [deptMessage, setDeptMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

	// Legal Entity handlers
	async function handleCreateEntity() {
		if (!newEntityName.trim()) return;
		setEntitySaving(true);
		setEntityMessage(null);

		try {
			const res = await fetch('/api/admin/legal-entities', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: newEntityName, country: newEntityCountry || null })
			});

			if (res.ok) {
				const entity = await res.json();
				setLegalEntities(prev => [...prev, entity].sort((a, b) => a.name.localeCompare(b.name)));
				setNewEntityName('');
				setNewEntityCountry('');
				setEntityMessage({ type: 'success', text: 'Sociedad creada correctamente' });
				router.refresh();
			} else {
				const data = await res.json();
				setEntityMessage({ type: 'error', text: data.error });
			}
		} catch (error) {
			setEntityMessage({ type: 'error', text: 'Error al crear la sociedad' });
		} finally {
			setEntitySaving(false);
		}
	}

	async function handleUpdateEntity() {
		if (!editingEntity) return;
		setEntitySaving(true);
		setEntityMessage(null);

		try {
			const res = await fetch(`/api/admin/legal-entities/${editingEntity.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: editingEntity.name, country: editingEntity.country, is_active: editingEntity.is_active })
			});

			if (res.ok) {
				const updated = await res.json();
				setLegalEntities(prev => prev.map(e => e.id === updated.id ? updated : e));
				setEditingEntity(null);
				setEntityMessage({ type: 'success', text: 'Sociedad actualizada correctamente' });
				router.refresh();
			} else {
				const data = await res.json();
				setEntityMessage({ type: 'error', text: data.error });
			}
		} catch (error) {
			setEntityMessage({ type: 'error', text: 'Error al actualizar la sociedad' });
		} finally {
			setEntitySaving(false);
		}
	}

	async function handleDeleteEntity(id: string) {
		if (!confirm('¿Estás seguro de eliminar esta sociedad?')) return;
		setEntitySaving(true);

		try {
			const res = await fetch(`/api/admin/legal-entities/${id}`, { method: 'DELETE' });
			if (res.ok) {
				setLegalEntities(prev => prev.filter(e => e.id !== id));
				setEntityMessage({ type: 'success', text: 'Sociedad eliminada' });
				router.refresh();
			} else {
				const data = await res.json();
				setEntityMessage({ type: 'error', text: data.error });
			}
		} catch (error) {
			setEntityMessage({ type: 'error', text: 'Error al eliminar' });
		} finally {
			setEntitySaving(false);
		}
	}

	// Department handlers
	async function handleCreateDepartment() {
		if (!newDeptName.trim()) return;
		setDeptSaving(true);
		setDeptMessage(null);

		try {
			const res = await fetch('/api/admin/departments', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: newDeptName, legal_entity_id: newDeptEntityId || null })
			});

			if (res.ok) {
				const dept = await res.json();
				setDepartments(prev => [...prev, dept].sort((a, b) => a.name.localeCompare(b.name)));
				setNewDeptName('');
				setNewDeptEntityId('');
				setDeptMessage({ type: 'success', text: 'Departamento creado correctamente' });
				router.refresh();
			} else {
				const data = await res.json();
				setDeptMessage({ type: 'error', text: data.error });
			}
		} catch (error) {
			setDeptMessage({ type: 'error', text: 'Error al crear el departamento' });
		} finally {
			setDeptSaving(false);
		}
	}

	async function handleUpdateDepartment() {
		if (!editingDepartment) return;
		setDeptSaving(true);
		setDeptMessage(null);

		try {
			const res = await fetch(`/api/admin/departments/${editingDepartment.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ 
					name: editingDepartment.name, 
					legal_entity_id: editingDepartment.legal_entity_id,
					is_active: editingDepartment.is_active 
				})
			});

			if (res.ok) {
				const updated = await res.json();
				setDepartments(prev => prev.map(d => d.id === updated.id ? updated : d));
				setEditingDepartment(null);
				setDeptMessage({ type: 'success', text: 'Departamento actualizado correctamente' });
				router.refresh();
			} else {
				const data = await res.json();
				setDeptMessage({ type: 'error', text: data.error });
			}
		} catch (error) {
			setDeptMessage({ type: 'error', text: 'Error al actualizar el departamento' });
		} finally {
			setDeptSaving(false);
		}
	}

	async function handleDeleteDepartment(id: string) {
		if (!confirm('¿Estás seguro de eliminar este departamento?')) return;
		setDeptSaving(true);

		try {
			const res = await fetch(`/api/admin/departments/${id}`, { method: 'DELETE' });
			if (res.ok) {
				setDepartments(prev => prev.filter(d => d.id !== id));
				setDeptMessage({ type: 'success', text: 'Departamento eliminado' });
				router.refresh();
			} else {
				const data = await res.json();
				setDeptMessage({ type: 'error', text: data.error });
			}
		} catch (error) {
			setDeptMessage({ type: 'error', text: 'Error al eliminar' });
		} finally {
			setDeptSaving(false);
		}
	}

	const tabs: { key: Tab; label: string }[] = [
		{ key: 'entities', label: 'Sociedades' },
		{ key: 'departments', label: 'Departamentos' },
	];

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Configuración General</h1>
				<p className="mt-1 text-sm text-zinc-500">
					Administra las sociedades y departamentos de la organización
				</p>
			</div>

			{/* Tabs */}
			<div className="border-b border-zinc-200">
				<nav className="flex gap-8">
					{tabs.map((tab) => (
						<button
							key={tab.key}
							onClick={() => setActiveTab(tab.key)}
							className={`py-3 text-sm font-medium border-b-2 transition-colors ${
								activeTab === tab.key
									? 'border-black text-black'
									: 'border-transparent text-zinc-500 hover:text-zinc-900'
							}`}
						>
							{tab.label}
						</button>
					))}
				</nav>
			</div>

			{/* Legal Entities Tab */}
			{activeTab === 'entities' && (
				<div className="space-y-6">
					{/* Create new entity */}
					<div className="rounded-xl border border-zinc-200 bg-white p-6">
						<h2 className="text-lg font-semibold text-zinc-900 mb-4">Nueva Sociedad</h2>
						<div className="flex gap-4 items-end">
							<div className="flex-1">
								<label className="block text-sm font-medium text-zinc-700 mb-1">Nombre *</label>
								<input
									type="text"
									value={newEntityName}
									onChange={(e) => setNewEntityName(e.target.value)}
									placeholder="Nombre de la sociedad"
									className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
								/>
							</div>
							<div className="w-48">
								<label className="block text-sm font-medium text-zinc-700 mb-1">País</label>
								<input
									type="text"
									value={newEntityCountry}
									onChange={(e) => setNewEntityCountry(e.target.value)}
									placeholder="País"
									className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
								/>
							</div>
							<button
								onClick={handleCreateEntity}
								disabled={entitySaving || !newEntityName.trim()}
								className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
							>
								Crear
							</button>
						</div>
						{entityMessage && (
							<div className={`mt-4 rounded-lg p-3 text-sm ${
								entityMessage.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
							}`}>
								{entityMessage.text}
							</div>
						)}
					</div>

					{/* Entity list */}
					<div className="rounded-xl border border-zinc-200 bg-white">
						<div className="border-b border-zinc-200 px-6 py-4">
							<h2 className="text-base font-semibold text-zinc-900">Sociedades ({legalEntities.length})</h2>
						</div>
						<ul className="divide-y divide-zinc-200">
							{legalEntities.map((entity) => (
								<li key={entity.id} className="px-6 py-4">
									{editingEntity?.id === entity.id ? (
										<div className="flex gap-4 items-end">
											<div className="flex-1">
												<input
													type="text"
													value={editingEntity.name}
													onChange={(e) => setEditingEntity({ ...editingEntity, name: e.target.value })}
													className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
												/>
											</div>
											<div className="w-48">
												<input
													type="text"
													value={editingEntity.country || ''}
													onChange={(e) => setEditingEntity({ ...editingEntity, country: e.target.value })}
													placeholder="País"
													className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
												/>
											</div>
											<label className="flex items-center gap-2">
												<input
													type="checkbox"
													checked={editingEntity.is_active}
													onChange={(e) => setEditingEntity({ ...editingEntity, is_active: e.target.checked })}
													className="rounded border-zinc-300"
												/>
												<span className="text-sm text-zinc-600">Activo</span>
											</label>
											<button
												onClick={handleUpdateEntity}
												disabled={entitySaving}
												className="rounded-lg bg-black px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
											>
												Guardar
											</button>
											<button
												onClick={() => setEditingEntity(null)}
												className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
											>
												Cancelar
											</button>
										</div>
									) : (
										<div className="flex items-center justify-between">
											<div>
												<span className="font-medium text-zinc-900">{entity.name}</span>
												{entity.country && <span className="ml-2 text-sm text-zinc-500">({entity.country})</span>}
												{!entity.is_active && (
													<span className="ml-2 inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
														Inactivo
													</span>
												)}
											</div>
											<div className="flex items-center gap-2">
												<button
													onClick={() => setEditingEntity(entity)}
													className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
												>
													Editar
												</button>
												<button
													onClick={() => handleDeleteEntity(entity.id)}
													className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
												>
													Eliminar
												</button>
											</div>
										</div>
									)}
								</li>
							))}
							{legalEntities.length === 0 && (
								<li className="px-6 py-12 text-center text-sm text-zinc-500">
									No hay sociedades registradas
								</li>
							)}
						</ul>
					</div>
				</div>
			)}

			{/* Departments Tab */}
			{activeTab === 'departments' && (
				<div className="space-y-6">
					{/* Create new department */}
					<div className="rounded-xl border border-zinc-200 bg-white p-6">
						<h2 className="text-lg font-semibold text-zinc-900 mb-4">Nuevo Departamento</h2>
						<div className="flex gap-4 items-end">
							<div className="flex-1">
								<label className="block text-sm font-medium text-zinc-700 mb-1">Nombre *</label>
								<input
									type="text"
									value={newDeptName}
									onChange={(e) => setNewDeptName(e.target.value)}
									placeholder="Nombre del departamento"
									className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
								/>
							</div>
							<div className="w-64">
								<label className="block text-sm font-medium text-zinc-700 mb-1">Sociedad</label>
								<select
									value={newDeptEntityId}
									onChange={(e) => setNewDeptEntityId(e.target.value)}
									className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
								>
									<option value="">Sin sociedad específica</option>
									{legalEntities.filter(e => e.is_active).map((entity) => (
										<option key={entity.id} value={entity.id}>{entity.name}</option>
									))}
								</select>
							</div>
							<button
								onClick={handleCreateDepartment}
								disabled={deptSaving || !newDeptName.trim()}
								className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
							>
								Crear
							</button>
						</div>
						{deptMessage && (
							<div className={`mt-4 rounded-lg p-3 text-sm ${
								deptMessage.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
							}`}>
								{deptMessage.text}
							</div>
						)}
					</div>

					{/* Department list */}
					<div className="rounded-xl border border-zinc-200 bg-white">
						<div className="border-b border-zinc-200 px-6 py-4">
							<h2 className="text-base font-semibold text-zinc-900">Departamentos ({departments.length})</h2>
						</div>
						<ul className="divide-y divide-zinc-200">
							{departments.map((dept) => (
								<li key={dept.id} className="px-6 py-4">
									{editingDepartment?.id === dept.id ? (
										<div className="flex gap-4 items-end">
											<div className="flex-1">
												<input
													type="text"
													value={editingDepartment.name}
													onChange={(e) => setEditingDepartment({ ...editingDepartment, name: e.target.value })}
													className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
												/>
											</div>
											<div className="w-64">
												<select
													value={editingDepartment.legal_entity_id || ''}
													onChange={(e) => setEditingDepartment({ ...editingDepartment, legal_entity_id: e.target.value || null })}
													className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
												>
													<option value="">Sin sociedad</option>
													{legalEntities.filter(e => e.is_active).map((entity) => (
														<option key={entity.id} value={entity.id}>{entity.name}</option>
													))}
												</select>
											</div>
											<label className="flex items-center gap-2">
												<input
													type="checkbox"
													checked={editingDepartment.is_active}
													onChange={(e) => setEditingDepartment({ ...editingDepartment, is_active: e.target.checked })}
													className="rounded border-zinc-300"
												/>
												<span className="text-sm text-zinc-600">Activo</span>
											</label>
											<button
												onClick={handleUpdateDepartment}
												disabled={deptSaving}
												className="rounded-lg bg-black px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
											>
												Guardar
											</button>
											<button
												onClick={() => setEditingDepartment(null)}
												className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
											>
												Cancelar
											</button>
										</div>
									) : (
										<div className="flex items-center justify-between">
											<div>
												<span className="font-medium text-zinc-900">{dept.name}</span>
												{dept.legal_entity && (
													<span className="ml-2 text-sm text-zinc-500">({dept.legal_entity.name})</span>
												)}
												{!dept.is_active && (
													<span className="ml-2 inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
														Inactivo
													</span>
												)}
											</div>
											<div className="flex items-center gap-2">
												<button
													onClick={() => setEditingDepartment(dept)}
													className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
												>
													Editar
												</button>
												<button
													onClick={() => handleDeleteDepartment(dept.id)}
													className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
												>
													Eliminar
												</button>
											</div>
										</div>
									)}
								</li>
							))}
							{departments.length === 0 && (
								<li className="px-6 py-12 text-center text-sm text-zinc-500">
									No hay departamentos registrados
								</li>
							)}
						</ul>
					</div>
				</div>
			)}
		</div>
	);
}
