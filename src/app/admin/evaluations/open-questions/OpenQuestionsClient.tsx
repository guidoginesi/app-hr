'use client';

import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Button } from '@pow/ui/components/ui/button';
import { Sheet, SheetContent, SheetClose } from '@pow/ui/components/ui/sheet';
import { Checkbox } from '@pow/ui/components/ui/checkbox';
import type { OpenQuestionConfig, OpenQuestionConfigFormData } from '@/types/evaluation';

export function OpenQuestionsClient() {
  const [questions, setQuestions] = useState<OpenQuestionConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<OpenQuestionConfig | null>(null);
  const [formData, setFormData] = useState<OpenQuestionConfigFormData>({
    question_key: '',
    label_self: '',
    label_leader: '',
    description: '',
    is_active: true,
    sort_order: 0,
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/admin/open-question-config');
      if (!res.ok) throw new Error('Error al cargar preguntas');
      const data = await res.json();
      setQuestions(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingQuestion(null);
    setFormData({
      question_key: '',
      label_self: '',
      label_leader: '',
      description: '',
      is_active: true,
      sort_order: questions.length + 1,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (question: OpenQuestionConfig) => {
    setEditingQuestion(question);
    setFormData({
      question_key: question.question_key,
      label_self: question.label_self,
      label_leader: question.label_leader,
      description: question.description || '',
      is_active: question.is_active,
      sort_order: question.sort_order,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingQuestion(null);
    setError(null);
  };

  // Generate a unique key from the label
  const generateKey = (label: string): string => {
    return label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9\s]/g, '') // Remove special chars
      .trim()
      .replace(/\s+/g, '_') // Spaces to underscores
      .slice(0, 30) // Limit length
      + '_' + Date.now().toString(36).slice(-4); // Add unique suffix
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const url = editingQuestion
        ? `/api/admin/open-question-config/${editingQuestion.id}`
        : '/api/admin/open-question-config';
      
      const method = editingQuestion ? 'PUT' : 'POST';

      // Auto-generate key for new questions
      const dataToSend = editingQuestion 
        ? formData 
        : { ...formData, question_key: generateKey(formData.label_self) };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al guardar');
      }

      await fetchQuestions();
      closeModal();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (question: OpenQuestionConfig) => {
    if (!confirm(`¿Eliminar esta pregunta?`)) return;

    try {
      const res = await fetch(`/api/admin/open-question-config/${question.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Error al eliminar');
      await fetchQuestions();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggleActive = async (question: OpenQuestionConfig) => {
    try {
      const res = await fetch(`/api/admin/open-question-config/${question.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !question.is_active }),
      });

      if (!res.ok) throw new Error('Error al actualizar');
      await fetchQuestions();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-end">
        <Button onClick={openCreateModal}>
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva pregunta
        </Button>
      </div>

      {error && (
        <div className="rounded-lg bg-danger-subtle border border-danger/20 p-4 text-sm text-[var(--red-600)]">
          {error}
        </div>
      )}

      {/* Questions List */}
      <div className="space-y-4">
        {questions.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-white p-12 text-center">
            <p className="text-muted-foreground">No hay preguntas configuradas</p>
            <div className="mt-4">
              <Button variant="ghost" onClick={openCreateModal}>
                Crear primera pregunta
              </Button>
            </div>
          </div>
        ) : (
          questions.map((question, index) => (
            <div
              key={question.id}
              className={`rounded-xl border bg-white p-6 shadow-sm transition-all ${
                question.is_active ? 'border-[var(--border)]' : 'border-[var(--border)] opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground">
                      {index + 1}
                    </span>
                    {!question.is_active && (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                        Inactiva
                      </span>
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
                        Autoevaluación
                      </p>
                      <p className="text-sm text-secondary-foreground">{question.label_self}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
                        Evaluación del líder
                      </p>
                      <p className="text-sm text-secondary-foreground">{question.label_leader}</p>
                    </div>
                  </div>

                  {question.description && (
                    <p className="text-sm text-muted-foreground">{question.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleActive(question)}
                    title={question.is_active ? 'Desactivar' : 'Activar'}
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      {question.is_active ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      )}
                    </svg>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditModal(question)}
                    title="Editar"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="border-danger/30 text-[var(--red-600)] hover:bg-danger-subtle"
                    onClick={() => handleDelete(question)}
                    title="Eliminar"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Form Sheet */}
      {isModalOpen && (
        <Sheet open onOpenChange={(o) => { if (!o) closeModal(); }}>
          <SheetContent
            side="right"
            flush
            title={editingQuestion ? 'Editar pregunta' : 'Nueva pregunta'}
            className="max-w-lg"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
              <h2 className="type-title">
                {editingQuestion ? 'Editar pregunta' : 'Nueva pregunta'}
              </h2>
              <SheetClose
                aria-label="Cerrar"
                className="-mr-1.5 grid h-8 w-8 place-items-center rounded-[var(--radius)] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-5 w-5" />
              </SheetClose>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 space-y-4 overflow-y-auto p-6">
                <div>
                  <label className="block text-sm font-medium text-secondary-foreground mb-1">
                    Pregunta para autoevaluación *
                  </label>
                  <textarea
                    value={formData.label_self}
                    onChange={(e) => setFormData({ ...formData, label_self: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
                    rows={2}
                    placeholder="¿Cuáles consideras que son tus principales fortalezas?"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary-foreground mb-1">
                    Pregunta para evaluación del líder *
                  </label>
                  <textarea
                    value={formData.label_leader}
                    onChange={(e) => setFormData({ ...formData, label_leader: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
                    rows={2}
                    placeholder="¿Cuáles consideras que son las principales fortalezas del colaborador?"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary-foreground mb-1">
                    Descripción / Instrucciones (opcional)
                  </label>
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
                    rows={2}
                    placeholder="Instrucciones adicionales para responder esta pregunta..."
                  />
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-secondary-foreground mb-1">
                      Orden
                    </label>
                    <input
                      type="number"
                      value={formData.sort_order}
                      onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                      className="w-full rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
                      min={0}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="flex items-center gap-2 cursor-pointer pt-6">
                      <Checkbox
                        checked={formData.is_active}
                        onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked === true })}
                      />
                      <span className="text-sm font-medium text-secondary-foreground">Activa</span>
                    </label>
                  </div>
                </div>

                {error && (
                  <div className="rounded-lg bg-danger-subtle border border-danger/20 p-3 text-sm text-[var(--red-600)]">
                    {error}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 border-t border-[var(--border)] p-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeModal}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  loading={isSaving}
                >
                  {editingQuestion ? 'Guardar cambios' : 'Crear pregunta'}
                </Button>
              </div>
            </form>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
