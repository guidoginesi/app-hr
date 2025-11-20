'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type EmailTemplate = {
	id: string;
	template_key: string;
	subject: string;
	body: string;
	description: string;
	variables: string[];
	is_active: boolean;
};

const TEMPLATE_NAMES: Record<string, string> = {
	'candidate_rejected': 'Email Candidato Descartado (General)',
	'interview_coordination': 'Email Coordinación Entrevista',
	'candidate_rejected_location': 'Email Candidato Descartado (Provincia OTRA)'
};

export function ConfiguracionClient() {
	const router = useRouter();
	const [templates, setTemplates] = useState<EmailTemplate[]>([]);
	const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [editedSubject, setEditedSubject] = useState('');
	const [editedBody, setEditedBody] = useState('');
	const [editedIsActive, setEditedIsActive] = useState(true);
	const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

	useEffect(() => {
		loadTemplates();
	}, []);

	async function loadTemplates() {
		try {
			const res = await fetch('/api/admin/email-templates');
			if (res.ok) {
				const data = await res.json();
				setTemplates(data.templates);
				if (data.templates.length > 0) {
					selectTemplate(data.templates[0]);
				}
			}
		} catch (error) {
			console.error('Error loading templates:', error);
		} finally {
			setLoading(false);
		}
	}

	function selectTemplate(template: EmailTemplate) {
		setSelectedTemplate(template);
		setEditedSubject(template.subject);
		setEditedBody(template.body);
		setEditedIsActive(template.is_active);
		setMessage(null);
	}

	async function handleSave() {
		if (!selectedTemplate) return;

		setSaving(true);
		setMessage(null);

		try {
			const res = await fetch('/api/admin/email-templates', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					templateKey: selectedTemplate.template_key,
					subject: editedSubject,
					body: editedBody,
					is_active: editedIsActive
				})
			});

			if (res.ok) {
				setMessage({ type: 'success', text: 'Plantilla guardada correctamente' });
				await loadTemplates();
				router.refresh();
			} else {
				const data = await res.json();
				setMessage({ type: 'error', text: data.error || 'Error al guardar' });
			}
		} catch (error) {
			setMessage({ type: 'error', text: 'Error al guardar la plantilla' });
		} finally {
			setSaving(false);
		}
	}

	function handleReset() {
		if (selectedTemplate) {
			setEditedSubject(selectedTemplate.subject);
			setEditedBody(selectedTemplate.body);
			setEditedIsActive(selectedTemplate.is_active);
			setMessage(null);
		}
	}

	if (loading) {
		return (
			<div className="flex items-center justify-center h-64">
				<p className="text-sm text-zinc-500">Cargando configuración...</p>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Configuración</h1>
				<p className="mt-1 text-sm text-zinc-500">
					Personaliza las plantillas de email enviadas a los candidatos
				</p>
			</div>

			<div className="grid grid-cols-12 gap-6">
				{/* Lista de plantillas */}
				<div className="col-span-4">
					<div className="rounded-xl border border-zinc-200 bg-white p-4">
						<h2 className="text-sm font-semibold text-zinc-900 mb-3">Plantillas de Email</h2>
						<div className="space-y-2">
							{templates.map((template) => (
								<button
									key={template.id}
									onClick={() => selectTemplate(template)}
									className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
										selectedTemplate?.id === template.id
											? 'bg-black text-white'
											: 'text-zinc-700 hover:bg-zinc-100'
									}`}
								>
									<div className="font-medium">
										{TEMPLATE_NAMES[template.template_key] || template.template_key}
									</div>
									{template.description && (
										<div className={`text-xs mt-1 ${
											selectedTemplate?.id === template.id ? 'text-zinc-300' : 'text-zinc-500'
										}`}>
											{template.description}
										</div>
									)}
								</button>
							))}
						</div>
					</div>
				</div>

				{/* Editor de plantilla */}
				<div className="col-span-8">
					{selectedTemplate ? (
						<div className="rounded-xl border border-zinc-200 bg-white p-6 space-y-6">
							<div className="flex items-start justify-between">
								<div>
									<h2 className="text-lg font-semibold text-zinc-900">
										{TEMPLATE_NAMES[selectedTemplate.template_key] || selectedTemplate.template_key}
									</h2>
									<p className="text-sm text-zinc-500 mt-1">{selectedTemplate.description}</p>
								</div>
								
								{/* Toggle de activación */}
								<div className="flex items-center gap-3">
									<span className={`text-sm font-medium ${editedIsActive ? 'text-green-700' : 'text-zinc-500'}`}>
										{editedIsActive ? 'Activo' : 'Desactivado'}
									</span>
									<button
										type="button"
										onClick={() => setEditedIsActive(!editedIsActive)}
										className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
											editedIsActive ? 'bg-green-600' : 'bg-zinc-300'
										}`}
									>
										<span
											className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
												editedIsActive ? 'translate-x-6' : 'translate-x-1'
											}`}
										/>
									</button>
								</div>
							</div>

							{/* Variables disponibles */}
							{selectedTemplate.variables && selectedTemplate.variables.length > 0 && (
								<div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
									<h3 className="text-sm font-semibold text-blue-900 mb-2">Variables disponibles</h3>
									<div className="flex flex-wrap gap-2">
										{selectedTemplate.variables.map((variable) => (
											<code
												key={variable}
												className="px-2 py-1 bg-white rounded text-xs font-mono text-blue-700 border border-blue-300"
											>
												{`{{${variable}}}`}
											</code>
										))}
									</div>
									<p className="text-xs text-blue-700 mt-2">
										Usa estas variables en el asunto o cuerpo del email
									</p>
								</div>
							)}

							{/* Asunto */}
							<div>
								<label htmlFor="subject" className="block text-sm font-medium text-zinc-900 mb-2">
									Asunto
								</label>
								<input
									id="subject"
									type="text"
									value={editedSubject}
									onChange={(e) => setEditedSubject(e.target.value)}
									className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
								/>
							</div>

							{/* Cuerpo */}
							<div>
								<label htmlFor="body" className="block text-sm font-medium text-zinc-900 mb-2">
									Cuerpo del Email
								</label>
								<textarea
									id="body"
									value={editedBody}
									onChange={(e) => setEditedBody(e.target.value)}
									rows={16}
									className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 font-mono focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
								/>
							</div>

							{/* Mensaje de estado */}
							{message && (
								<div
									className={`rounded-lg border p-4 ${
										message.type === 'success'
											? 'bg-green-50 border-green-200 text-green-800'
											: 'bg-red-50 border-red-200 text-red-800'
									}`}
								>
									<p className="text-sm font-medium">{message.text}</p>
								</div>
							)}

							{/* Botones */}
							<div className="flex items-center gap-3">
								<button
									onClick={handleSave}
									disabled={saving}
									className="rounded-lg bg-black px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
								>
									{saving ? 'Guardando...' : 'Guardar Cambios'}
								</button>
								<button
									onClick={handleReset}
									disabled={saving}
									className="rounded-lg border border-zinc-300 bg-white px-6 py-2.5 text-sm font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed"
								>
									Restablecer
								</button>
							</div>
						</div>
					) : (
						<div className="rounded-xl border border-zinc-200 bg-white p-12 text-center">
							<p className="text-sm text-zinc-500">Selecciona una plantilla para editar</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

