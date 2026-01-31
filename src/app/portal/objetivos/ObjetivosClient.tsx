'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Employee } from '@/types/employee';
import type { Objective, ObjectiveFormData, ObjectivePeriodType, ObjectiveStatus, ObjectivesPeriod, ObjectivePeriodicity } from '@/types/objective';
import { PERIOD_TYPE_LABELS, STATUS_LABELS, STATUS_COLORS, PERIODICITY_LABELS, SUB_OBJECTIVES_COUNT, SUB_OBJECTIVE_LABELS } from '@/types/objective';

type ObjetivosClientProps = {
  employee: Employee;
  isLeader: boolean;
  directReports: { id: string; first_name: string; last_name: string; job_title: string | null }[];
  ownObjectives: Objective[];
  teamObjectives: Objective[];
  periods: ObjectivesPeriod[];
  today: string;
};

export function ObjetivosClient({
  employee,
  isLeader,
  directReports,
  ownObjectives: initialOwnObjectives,
  teamObjectives: initialTeamObjectives,
  periods,
  today,
}: ObjetivosClientProps) {
  const router = useRouter();
  const [ownObjectives, setOwnObjectives] = useState<Objective[]>(initialOwnObjectives);
  const [teamObjectives, setTeamObjectives] = useState<Objective[]>(initialTeamObjectives);
  const [activeTab, setActiveTab] = useState<'own' | 'team'>(isLeader ? 'team' : 'own');
  const [selectedYear, setSelectedYear] = useState<number | null>(null); // null = todos
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingObjective, setEditingObjective] = useState<Objective | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAchievementModal, setShowAchievementModal] = useState(false);
  const [evaluatingObjective, setEvaluatingObjective] = useState<Objective | null>(null);
  const [achievementData, setAchievementData] = useState({ percentage: '', notes: '' });
  
  // For evaluating objectives with sub-objectives
  const [showSubObjectivesEvalModal, setShowSubObjectivesEvalModal] = useState(false);
  const [evaluatingParentObjective, setEvaluatingParentObjective] = useState<Objective | null>(null);
  const [subObjectivesEvalData, setSubObjectivesEvalData] = useState<{ id: string; percentage: string; notes: string }[]>([]);

  // Helper functions to check periods
  const isPeriodOpen = (year: number, type: 'definition' | 'evaluation'): boolean => {
    if (!periods || periods.length === 0) {
      // If no periods configured, allow definition but not evaluation
      return type === 'definition';
    }
    const period = periods.find(p => p.year === year && p.period_type === type && p.is_active);
    if (!period) return false;
    return today >= period.start_date && today <= period.end_date;
  };

  const canCreateObjectives = (year: number) => isPeriodOpen(year, 'definition');
  const canEditObjectives = (year: number) => isPeriodOpen(year, 'definition');
  const canEvaluateObjectives = (year: number) => isPeriodOpen(year, 'evaluation');

  const [formData, setFormData] = useState<ObjectiveFormData>({
    employee_id: '',
    year: new Date().getFullYear(),
    period_type: 'annual',
    title: '',
    description: '',
    progress_percentage: 0,
    status: 'not_started',
    periodicity: 'annual',
    weight_pct: 50,
  });

  // String states for number inputs (to allow clearing)
  const [weightPctStr, setWeightPctStr] = useState('50');
  const [progressStr, setProgressStr] = useState('0');

  // Sub-objectives state for semestral/trimestral
  const [subObjectives, setSubObjectives] = useState<{ 
    id?: string; 
    title: string; 
    description: string; 
    progress_percentage: number;
    status: ObjectiveStatus;
  }[]>([]);

  // Update sub-objectives when periodicity changes
  const handlePeriodicityChange = (newPeriodicity: ObjectivePeriodicity) => {
    setFormData(prev => ({ ...prev, periodicity: newPeriodicity }));
    const count = SUB_OBJECTIVES_COUNT[newPeriodicity] || 0;
    setSubObjectives(Array(count).fill(null).map(() => ({ 
      title: '', 
      description: '', 
      progress_percentage: 0,
      status: 'not_started' as ObjectiveStatus,
    })));
  };

  // Maximum 2 area objectives per employee per year
  const MAX_OBJECTIVES_PER_EMPLOYEE = 2;

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  const resetForm = () => {
    setFormData({
      employee_id: selectedMember || '',
      year: selectedYear ?? currentYear,
      period_type: 'annual',
      title: '',
      description: '',
      progress_percentage: 0,
      status: 'not_started',
      periodicity: 'annual',
      weight_pct: 50,
    });
    setWeightPctStr('50');
    setProgressStr('0');
    setSubObjectives([]);
    setEditingObjective(null);
    setShowForm(false);
    setError(null);
  };

  // Check if employee already has max objectives for the year
  const getObjectivesCountForEmployee = (employeeId: string, year: number) => {
    return teamObjectives.filter(o => o.employee_id === employeeId && o.year === year && !o.parent_objective_id).length;
  };

  const canAddObjective = (employeeId: string, year: number) => {
    return getObjectivesCountForEmployee(employeeId, year) < MAX_OBJECTIVES_PER_EMPLOYEE;
  };

  // Get total weight already assigned to an employee for a year (excluding a specific objective when editing)
  const getAssignedWeight = (employeeId: string, year: number, excludeObjectiveId?: string) => {
    return teamObjectives
      .filter(o => 
        o.employee_id === employeeId && 
        o.year === year && 
        !o.parent_objective_id &&
        o.id !== excludeObjectiveId
      )
      .reduce((sum, o) => sum + (o.weight_pct ?? 0), 0);
  };

  // Get remaining weight available for new objective
  const getRemainingWeight = (employeeId: string, year: number, excludeObjectiveId?: string) => {
    return 100 - getAssignedWeight(employeeId, year, excludeObjectiveId);
  };

  const openCreateForm = (memberId?: string) => {
    const targetMemberId = memberId || selectedMember || '';
    const formYear = selectedYear ?? currentYear;
    
    // Check if can add more objectives
    if (targetMemberId && !canAddObjective(targetMemberId, formYear)) {
      setError(`Este colaborador ya tiene ${MAX_OBJECTIVES_PER_EMPLOYEE} objetivos de área para ${formYear}`);
      return;
    }

    // Calculate remaining weight for this employee
    const remainingWeight = targetMemberId ? getRemainingWeight(targetMemberId, formYear) : 50;

    setFormData({
      employee_id: targetMemberId,
      year: formYear,
      period_type: 'annual',
      title: '',
      description: '',
      progress_percentage: 0,
      status: 'not_started',
      periodicity: 'annual',
      weight_pct: remainingWeight,
    });
    setWeightPctStr(String(remainingWeight));
    setProgressStr('0');
    setSubObjectives([]);
    setEditingObjective(null);
    setShowForm(true);
  };

  const openEditForm = (objective: Objective) => {
    setFormData({
      employee_id: objective.employee_id,
      year: objective.year,
      period_type: objective.period_type,
      title: objective.title,
      description: objective.description || '',
      progress_percentage: objective.progress_percentage,
      status: objective.status,
      periodicity: objective.periodicity || 'annual',
      weight_pct: objective.weight_pct ?? 50,
    });
    setWeightPctStr(String(objective.weight_pct ?? 50));
    setProgressStr(String(objective.progress_percentage ?? 0));
    // Load existing sub-objectives or create empty slots
    const count = SUB_OBJECTIVES_COUNT[objective.periodicity] || 0;
    if (objective.sub_objectives && objective.sub_objectives.length > 0) {
      setSubObjectives(objective.sub_objectives.map(s => ({ 
        id: s.id,
        title: s.title, 
        description: s.description || '',
        progress_percentage: s.progress_percentage ?? 0,
        status: s.status ?? 'not_started',
      })));
    } else {
      setSubObjectives(Array(count).fill(null).map(() => ({ 
        title: '', 
        description: '',
        progress_percentage: 0,
        status: 'not_started' as ObjectiveStatus,
      })));
    }
    setEditingObjective(objective);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const periodicity = formData.periodicity || 'annual';
    const isAnnual = periodicity === 'annual';
    const requiredCount = SUB_OBJECTIVES_COUNT[periodicity] || 0;

    // Validate based on periodicity
    if (isAnnual) {
      if (!formData.title.trim()) {
        setError('El título es requerido');
        setSaving(false);
        return;
      }
      if (!formData.description?.trim()) {
        setError('La descripción es requerida');
        setSaving(false);
        return;
      }
    } else {
      // Validate all sub-objectives have titles and descriptions
      for (let i = 0; i < requiredCount; i++) {
        const sub = subObjectives[i];
        const label = SUB_OBJECTIVE_LABELS[periodicity]?.[i] || `#${i + 1}`;
        if (!sub?.title.trim()) {
          setError(`El título del objetivo ${label} es requerido`);
          setSaving(false);
          return;
        }
        if (!sub?.description?.trim()) {
          setError(`La descripción del objetivo ${label} es requerida`);
          setSaving(false);
          return;
        }
      }
    }

    try {
      // Parse string values to numbers
      const parsedWeightPct = parseFloat(weightPctStr) || 50;
      const parsedProgress = parseFloat(progressStr) || 0;

      // Validate weight doesn't exceed available
      const maxWeight = getRemainingWeight(formData.employee_id, formData.year, editingObjective?.id);
      if (parsedWeightPct > maxWeight) {
        setError(`El peso no puede exceder ${maxWeight}% (ya asignado: ${100 - maxWeight}%)`);
        setSaving(false);
        return;
      }

      // For the second objective, check that total will be 100%
      const currentObjectivesCount = getObjectivesCountForEmployee(formData.employee_id, formData.year);
      const isSecondObjective = !editingObjective && currentObjectivesCount === 1;
      if (isSecondObjective && parsedWeightPct !== maxWeight) {
        setError(`El segundo objetivo debe tener peso de ${maxWeight}% para que sumen 100%`);
        setSaving(false);
        return;
      }

      // For semestral/trimestral, generate a parent title from first sub-objective
      const submitData = { 
        ...formData,
        weight_pct: parsedWeightPct,
        progress_percentage: parsedProgress,
      };
      if (!isAnnual && subObjectives.length > 0) {
        submitData.title = `Objetivo ${PERIODICITY_LABELS[periodicity]}`;
        submitData.description = '';
      }

      const url = editingObjective
        ? `/api/portal/objectives/${editingObjective.id}`
        : '/api/portal/objectives';
      const method = editingObjective ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Error al guardar');
        return;
      }

      // Create or update sub-objectives for non-annual periodicities
      if (subObjectives.length > 0) {
        console.log('Creating/updating sub-objectives:', subObjectives.length);
        for (let i = 0; i < subObjectives.length; i++) {
          const sub = subObjectives[i];
          if (sub.title.trim()) {
            if (sub.id) {
              // Update existing sub-objective
              const updateRes = await fetch(`/api/portal/objectives/${sub.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  title: sub.title,
                  description: sub.description,
                  progress_percentage: sub.progress_percentage,
                  status: sub.status,
                }),
              });
              if (!updateRes.ok) {
                const errData = await updateRes.json();
                console.error(`Error updating sub-objective ${i + 1}:`, errData);
              }
            } else {
              // Create new sub-objective
              console.log(`Creating sub-objective ${i + 1} for parent ${data.id}`);
              const createRes = await fetch('/api/portal/objectives', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  employee_id: formData.employee_id,
                  year: formData.year,
                  period_type: formData.period_type,
                  title: sub.title,
                  description: sub.description,
                  progress_percentage: sub.progress_percentage || 0,
                  status: sub.status || 'not_started',
                  periodicity: formData.periodicity,
                  weight_pct: formData.weight_pct,
                  parent_objective_id: data.id,
                  sub_objective_number: i + 1,
                }),
              });
              if (!createRes.ok) {
                const errData = await createRes.json();
                console.error(`Error creating sub-objective ${i + 1}:`, errData);
                throw new Error(`Error al crear sub-objetivo ${i + 1}: ${errData.error}`);
              }
              console.log(`Sub-objective ${i + 1} created successfully`);
            }
          }
        }
      }

      // Update local state
      if (editingObjective) {
        setTeamObjectives(prev => prev.map(o => o.id === data.id ? data : o));
      } else {
        setTeamObjectives(prev => [data, ...prev]);
      }

      resetForm();
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (objective: Objective) => {
    if (!confirm('¿Estás seguro de eliminar este objetivo?')) return;

    try {
      const res = await fetch(`/api/portal/objectives/${objective.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setTeamObjectives(prev => prev.filter(o => o.id !== objective.id));
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || 'Error al eliminar');
      }
    } catch (err: any) {
      setError(err.message || 'Error al eliminar');
    }
  };

  const handleUpdateProgress = async (objective: Objective, progress: number, status: ObjectiveStatus) => {
    try {
      const res = await fetch(`/api/portal/objectives/${objective.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progress_percentage: progress, status }),
      });

      if (res.ok) {
        const data = await res.json();
        setTeamObjectives(prev => prev.map(o => o.id === data.id ? data : o));
      }
    } catch (err) {
      console.error('Error updating progress:', err);
    }
  };

  const openAchievementModal = (objective: Objective) => {
    // If objective has sub-objectives, open the sub-objectives evaluation modal
    if (objective.sub_objectives && objective.sub_objectives.length > 0) {
      setEvaluatingParentObjective(objective);
      setSubObjectivesEvalData(
        objective.sub_objectives.map(sub => ({
          id: sub.id,
          percentage: String(sub.achievement_percentage ?? sub.progress_percentage ?? 0),
          notes: sub.achievement_notes || '',
        }))
      );
      setShowSubObjectivesEvalModal(true);
    } else {
      // Regular objective - open simple modal
      setEvaluatingObjective(objective);
      setAchievementData({
        percentage: String(objective.achievement_percentage ?? objective.progress_percentage ?? 0),
        notes: objective.achievement_notes || '',
      });
      setShowAchievementModal(true);
    }
  };

  const handleSaveAchievement = async () => {
    if (!evaluatingObjective) return;
    setSaving(true);
    setError(null);

    const percentageValue = Math.round(parseFloat(achievementData.percentage) || 0);

    try {
      const res = await fetch(`/api/portal/objectives/${evaluatingObjective.id}/achievement`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          achievement_percentage: percentageValue,
          achievement_notes: achievementData.notes,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al guardar');
      }

      // Update local state immediately for better UX
      setTeamObjectives(prev => prev.map(obj => {
        if (obj.id === evaluatingObjective.id) {
          return { 
            ...obj, 
            achievement_percentage: percentageValue,
            achievement_notes: achievementData.notes,
            calculated_progress: percentageValue,
          };
        }
        return obj;
      }));

      setShowAchievementModal(false);
      setEvaluatingObjective(null);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAllSubObjectivesAchievements = async () => {
    if (!evaluatingParentObjective) return;
    setSaving(true);
    setError(null);

    try {
      // Save each sub-objective evaluation
      const savedEvaluations: { id: string; percentage: number; notes: string }[] = [];
      
      for (let i = 0; i < subObjectivesEvalData.length; i++) {
        const subEval = subObjectivesEvalData[i];
        const percentageValue = Math.round(parseFloat(subEval.percentage) || 0);
        const subLabel = SUB_OBJECTIVE_LABELS[evaluatingParentObjective.periodicity]?.[i] || `#${i + 1}`;
        
        const res = await fetch(`/api/portal/objectives/${subEval.id}/achievement`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            achievement_percentage: percentageValue,
            achievement_notes: subEval.notes,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(`Error en ${subLabel}: ${data.error || 'Error desconocido'}`);
        }
        
        savedEvaluations.push({ id: subEval.id, percentage: percentageValue, notes: subEval.notes });
      }

      // Calculate new average for parent objective
      const avgAchievement = Math.round(
        savedEvaluations.reduce((sum, e) => sum + e.percentage, 0) / savedEvaluations.length
      );

      // Update local state immediately for better UX
      setTeamObjectives(prev => prev.map(obj => {
        if (obj.id === evaluatingParentObjective.id) {
          // Update sub-objectives with new achievements
          const updatedSubObjectives = obj.sub_objectives?.map(sub => {
            const savedSub = savedEvaluations.find(e => e.id === sub.id);
            if (savedSub) {
              return {
                ...sub,
                achievement_percentage: savedSub.percentage,
                achievement_notes: savedSub.notes,
              };
            }
            return sub;
          });
          
          return { 
            ...obj, 
            sub_objectives: updatedSubObjectives,
            calculated_progress: avgAchievement,
          };
        }
        return obj;
      }));

      setShowSubObjectivesEvalModal(false);
      setEvaluatingParentObjective(null);
      setSubObjectivesEvalData([]);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Filter objectives
  const filteredOwnObjectives = selectedYear 
    ? ownObjectives.filter(o => o.year === selectedYear)
    : ownObjectives;
  const filteredTeamObjectives = selectedMember
    ? teamObjectives.filter(o => (!selectedYear || o.year === selectedYear) && o.employee_id === selectedMember)
    : selectedYear 
      ? teamObjectives.filter(o => o.year === selectedYear)
      : teamObjectives;

  // Group team objectives by employee
  const objectivesByEmployee = directReports.map(member => ({
    ...member,
    objectives: teamObjectives.filter(o => o.employee_id === member.id && (!selectedYear || o.year === selectedYear)),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Objetivos</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {isLeader ? 'Gestiona los objetivos de tu equipo' : 'Tus objetivos asignados'}
          </p>
        </div>
        
        {/* Year Filter */}
        <div className="flex items-center gap-4">
          <select
            value={selectedYear ?? ''}
            onChange={(e) => setSelectedYear(e.target.value === '' ? null : parseInt(e.target.value))}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600"
          >
            <option value="">Todos los años</option>
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">{error}</div>
      )}

      {/* Period Status Banners */}
      {isLeader && (
        <div className="flex flex-wrap gap-3">
          {canCreateObjectives(currentYear) && (
            <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span>Período de definición abierto para {currentYear}</span>
            </div>
          )}
          {canEvaluateObjectives(currentYear) && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Período de evaluación abierto para {currentYear}</span>
            </div>
          )}
          {!canEvaluateObjectives(currentYear) && periods && periods.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Período de evaluación cerrado para {currentYear}</span>
            </div>
          )}
        </div>
      )}

      {/* Tabs for Leaders */}
      {isLeader && (
        <div className="border-b border-zinc-200">
          <nav className="flex gap-6">
            <button
              onClick={() => setActiveTab('team')}
              className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
                activeTab === 'team'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700'
              }`}
            >
              Objetivos del equipo
            </button>
            <button
              onClick={() => setActiveTab('own')}
              className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
                activeTab === 'own'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700'
              }`}
            >
              Mis objetivos
            </button>
          </nav>
        </div>
      )}

      {/* Team Objectives (Leader view) */}
      {isLeader && activeTab === 'team' && (
        <div className="space-y-6">
          {directReports.length === 0 ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center">
              <p className="text-zinc-500">No tienes colaboradores asignados.</p>
            </div>
          ) : (
            objectivesByEmployee.map(member => (
              <div key={member.id} className="rounded-xl border border-zinc-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
                  <div>
                    <h3 className="font-semibold text-zinc-900">
                      {member.first_name} {member.last_name}
                    </h3>
                    <p className="text-sm text-zinc-500">{member.job_title || 'Sin puesto'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      member.objectives.length >= MAX_OBJECTIVES_PER_EMPLOYEE
                        ? 'bg-emerald-100 text-emerald-700'
                        : member.objectives.length > 0
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-zinc-100 text-zinc-500'
                    }`}>
                      {member.objectives.length}/{MAX_OBJECTIVES_PER_EMPLOYEE} objetivos
                    </span>
                    <button
                      onClick={() => openCreateForm(member.id)}
                      disabled={member.objectives.length >= MAX_OBJECTIVES_PER_EMPLOYEE || !canCreateObjectives(currentYear)}
                      title={!canCreateObjectives(currentYear) ? 'El período de definición está cerrado' : undefined}
                      className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      + Agregar objetivo
                    </button>
                  </div>
                </div>
                
                <div className="p-4">
                  {member.objectives.length === 0 ? (
                    <p className="text-center text-sm text-zinc-400 py-4">
                      Sin objetivos {selectedYear ? `para ${selectedYear}` : ''}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {member.objectives.map(obj => (
                        <ObjectiveCard
                          key={obj.id}
                          objective={obj}
                          onEdit={() => openEditForm(obj)}
                          onDelete={() => handleDelete(obj)}
                          onUpdateProgress={handleUpdateProgress}
                          onEvaluate={() => openAchievementModal(obj)}
                          onEvaluateSubObjective={(subObj) => openAchievementModal(subObj)}
                          canEdit={canEditObjectives(obj.year)}
                          canEvaluate={canEvaluateObjectives(obj.year)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Own Objectives (Employee view) */}
      {(activeTab === 'own' || !isLeader) && (
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 px-6 py-4">
            <h2 className="font-semibold text-zinc-900">Mis Objetivos {selectedYear ?? ''}</h2>
          </div>
          <div className="p-4">
            {filteredOwnObjectives.length === 0 ? (
              <p className="text-center text-sm text-zinc-400 py-8">
                No tienes objetivos asignados {selectedYear ? `para ${selectedYear}` : ''}
              </p>
            ) : (
              <div className="space-y-3">
                {filteredOwnObjectives.map(obj => (
                  <ObjectiveCard
                    key={obj.id}
                    objective={obj}
                    canEdit={false}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={resetForm} />
            <div className="relative w-full max-w-2xl rounded-xl bg-white shadow-2xl">
              <div className="border-b border-zinc-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-zinc-900">
                  {editingObjective ? 'Editar objetivo' : 'Nuevo objetivo'}
                </h2>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="p-6 space-y-4">
                  {!editingObjective && (
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Colaborador *</label>
                      <select
                        value={formData.employee_id}
                        onChange={(e) => setFormData(prev => ({ ...prev, employee_id: e.target.value }))}
                        required
                        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600"
                      >
                        <option value="">Seleccionar...</option>
                        {directReports.map(member => (
                          <option key={member.id} value={member.id}>
                            {member.first_name} {member.last_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Año *</label>
                      <select
                        value={formData.year}
                        onChange={(e) => setFormData(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600"
                      >
                        {years.map(year => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Periodicidad *</label>
                      <select
                        value={formData.periodicity}
                        onChange={(e) => handlePeriodicityChange(e.target.value as ObjectivePeriodicity)}
                        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600"
                      >
                        {Object.entries(PERIODICITY_LABELS).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Peso (%) *</label>
                      {(() => {
                        const maxWeight = formData.employee_id 
                          ? getRemainingWeight(formData.employee_id, formData.year, editingObjective?.id)
                          : 100;
                        const assignedWeight = formData.employee_id
                          ? getAssignedWeight(formData.employee_id, formData.year, editingObjective?.id)
                          : 0;
                        return (
                          <>
                            <input
                              type="number"
                              min={1}
                              max={maxWeight}
                              value={weightPctStr}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                if (val <= maxWeight) {
                                  setWeightPctStr(e.target.value);
                                }
                              }}
                              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600"
                            />
                            <p className="mt-1 text-xs text-zinc-500">
                              {assignedWeight > 0 
                                ? `Ya asignado: ${assignedWeight}% | Disponible: ${maxWeight}%`
                                : 'Los pesos deben sumar 100%'}
                            </p>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Título y descripción solo para objetivos anuales */}
                  {formData.periodicity === 'annual' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Título *</label>
                        <input
                          type="text"
                          value={formData.title}
                          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                          required
                          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600"
                          placeholder="Ej: Completar certificación de liderazgo"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Descripción *</label>
                        <textarea
                          value={formData.description}
                          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                          rows={2}
                          required
                          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600"
                          placeholder="Detalles del objetivo..."
                        />
                      </div>
                    </>
                  )}

                  {/* Sub-objetivos para semestral/trimestral */}
                  {subObjectives.length > 0 && (
                    <div className="space-y-4">
                      {subObjectives.map((sub, idx) => {
                        const periodicityKey = formData.periodicity || 'annual';
                        const subLabel = SUB_OBJECTIVE_LABELS[periodicityKey]?.[idx] || `Objetivo ${idx + 1}`;
                        return (
                        <div key={idx} className="rounded-lg border border-purple-200 bg-purple-50/50 p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-sm font-semibold text-purple-700 bg-purple-100 px-2.5 py-1 rounded">
                              {subLabel}
                            </span>
                          </div>
                          <div className="space-y-3">
                            <div>
                              <label className="block text-xs font-medium text-zinc-600 mb-1">Título *</label>
                              <input
                                type="text"
                                value={sub.title}
                                onChange={(e) => {
                                  const updated = [...subObjectives];
                                  updated[idx] = { ...updated[idx], title: e.target.value };
                                  setSubObjectives(updated);
                                }}
                                placeholder={`Título del objetivo ${subLabel}`}
                                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600 bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-zinc-600 mb-1">Descripción *</label>
                              <textarea
                                value={sub.description}
                                onChange={(e) => {
                                  const updated = [...subObjectives];
                                  updated[idx] = { ...updated[idx], description: e.target.value };
                                  setSubObjectives(updated);
                                }}
                                rows={2}
                                placeholder="Detalles del objetivo..."
                                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600 bg-white"
                              />
                            </div>
                            {/* Progress and Status for each sub-objective when editing */}
                            {editingObjective && (
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-zinc-600 mb-1">Progreso %</label>
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={sub.progress_percentage}
                                    onChange={(e) => {
                                      const updated = [...subObjectives];
                                      updated[idx] = { ...updated[idx], progress_percentage: parseInt(e.target.value) || 0 };
                                      setSubObjectives(updated);
                                    }}
                                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600 bg-white"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-zinc-600 mb-1">Estado</label>
                                  <select
                                    value={sub.status}
                                    onChange={(e) => {
                                      const updated = [...subObjectives];
                                      updated[idx] = { ...updated[idx], status: e.target.value as ObjectiveStatus };
                                      setSubObjectives(updated);
                                    }}
                                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600 bg-white"
                                  >
                                    {Object.entries(STATUS_LABELS).map(([key, label]) => (
                                      <option key={key} value={key}>{label}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );})}
                    </div>
                  )}

                  {/* Progress and Status for annual objectives only (no sub-objectives) */}
                  {editingObjective && subObjectives.length === 0 && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Progreso %</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={progressStr}
                          onChange={(e) => setProgressStr(e.target.value)}
                          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Estado</label>
                        <select
                          value={formData.status}
                          onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as ObjectiveStatus }))}
                          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600"
                        >
                          {Object.entries(STATUS_LABELS).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-3 border-t border-zinc-200 px-6 py-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                  >
                    {saving ? 'Guardando...' : editingObjective ? 'Guardar cambios' : 'Crear objetivo'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Achievement Modal */}
      {showAchievementModal && evaluatingObjective && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowAchievementModal(false)} />
            <div className="relative w-full max-w-md rounded-xl bg-white shadow-2xl">
              <div className="border-b border-zinc-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-zinc-900">
                  Evaluar cumplimiento {evaluatingObjective.parent_objective_id ? '(Sub-objetivo)' : ''}
                </h2>
                <p className="mt-1 text-sm text-zinc-500">{evaluatingObjective.title}</p>
              </div>
              <div className="p-6 space-y-4">
                {error && (
                  <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
                )}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    Cumplimiento (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={200}
                    value={achievementData.percentage}
                    onChange={(e) => setAchievementData(prev => ({ ...prev, percentage: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600"
                  />
                  <p className="mt-1 text-xs text-zinc-500">
                    0-100% normal, 101-200% sobrecumplimiento
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    Notas de evaluación
                  </label>
                  <textarea
                    value={achievementData.notes}
                    onChange={(e) => setAchievementData(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600"
                    placeholder="Comentarios sobre el cumplimiento del objetivo..."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 border-t border-zinc-200 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setShowAchievementModal(false)}
                  className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveAchievement}
                  disabled={saving}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : 'Guardar evaluación'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-objectives Evaluation Modal */}
      {showSubObjectivesEvalModal && evaluatingParentObjective && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowSubObjectivesEvalModal(false)} />
            <div className="relative w-full max-w-2xl rounded-xl bg-white shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="border-b border-zinc-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-zinc-900">
                  Evaluar Sub-objetivos
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {evaluatingParentObjective.title} - {PERIODICITY_LABELS[evaluatingParentObjective.periodicity]}
                </p>
              </div>
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                {error && (
                  <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
                )}
                
                {evaluatingParentObjective.sub_objectives?.map((sub, idx) => {
                  const evalData = subObjectivesEvalData.find(e => e.id === sub.id);
                  if (!evalData) return null;
                  
                  return (
                    <div key={sub.id} className="rounded-lg border border-purple-200 bg-purple-50/50 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm font-semibold text-purple-700 bg-purple-100 px-2.5 py-1 rounded">
                          {SUB_OBJECTIVE_LABELS[evaluatingParentObjective.periodicity]?.[idx] || `#${idx + 1}`}
                        </span>
                      </div>
                      <p className="font-medium text-zinc-800 mb-1">{sub.title}</p>
                      {sub.description && (
                        <p className="text-sm text-zinc-500 mb-3">{sub.description}</p>
                      )}
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-zinc-600 mb-1">
                            Cumplimiento (%) *
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={200}
                            value={evalData.percentage}
                            onChange={(e) => {
                              setSubObjectivesEvalData(prev => 
                                prev.map(item => 
                                  item.id === sub.id 
                                    ? { ...item, percentage: e.target.value }
                                    : item
                                )
                              );
                            }}
                            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-zinc-600 mb-1">
                            Notas
                          </label>
                          <input
                            type="text"
                            value={evalData.notes}
                            onChange={(e) => {
                              setSubObjectivesEvalData(prev => 
                                prev.map(item => 
                                  item.id === sub.id 
                                    ? { ...item, notes: e.target.value }
                                    : item
                                )
                              );
                            }}
                            placeholder="Comentarios..."
                            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600 bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {/* Calculated total */}
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-emerald-800">Cumplimiento promedio calculado:</span>
                    <span className="text-xl font-bold text-emerald-700">
                      {Math.round(
                        subObjectivesEvalData.reduce((sum, e) => sum + (parseFloat(e.percentage) || 0), 0) / 
                        (subObjectivesEvalData.length || 1)
                      )}%
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 border-t border-zinc-200 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setShowSubObjectivesEvalModal(false)}
                  className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveAllSubObjectivesAchievements}
                  disabled={saving}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : 'Guardar todas las evaluaciones'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Objective Card Component
function ObjectiveCard({
  objective,
  onEdit,
  onDelete,
  onUpdateProgress,
  onEvaluate,
  onEvaluateSubObjective,
  canEdit = false,
  canEvaluate = false,
}: {
  objective: Objective;
  onEdit?: () => void;
  onDelete?: () => void;
  onUpdateProgress?: (obj: Objective, progress: number, status: ObjectiveStatus) => void;
  onEvaluate?: () => void;
  onEvaluateSubObjective?: (subObjective: Objective) => void;
  canEdit?: boolean;
  canEvaluate?: boolean;
}) {
  const statusColor = STATUS_COLORS[objective.status];
  const hasAchievement = objective.achievement_percentage !== null && objective.achievement_percentage !== undefined;
  const hasSubObjectives = objective.sub_objectives && objective.sub_objectives.length > 0;
  const requiredSubObjectives = SUB_OBJECTIVES_COUNT[objective.periodicity] || 0;
  const actualSubObjectives = objective.sub_objectives?.length || 0;
  const subObjectivesComplete = actualSubObjectives >= requiredSubObjectives;
  
  // Use calculated_progress for objectives with sub-objectives
  const displayProgress = objective.calculated_progress ?? objective.progress_percentage;

  return (
    <div className="rounded-lg border border-zinc-200 p-4 hover:border-zinc-300 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {/* Objective Number */}
            {objective.objective_number && (
              <span className="text-xs font-bold text-white bg-purple-600 px-2 py-0.5 rounded">
                #{objective.objective_number}
              </span>
            )}
            <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
              {objective.year}
            </span>
            {/* Periodicity badge */}
            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
              {PERIODICITY_LABELS[objective.periodicity]?.split(' ')[0] || 'Anual'}
            </span>
            {/* Weight badge */}
            <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
              Peso: {objective.weight_pct ?? 50}%
            </span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${statusColor.bg} ${statusColor.text}`}>
              {STATUS_LABELS[objective.status]}
            </span>
            {hasAchievement && (
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">
                Evaluado: {objective.achievement_percentage}%
              </span>
            )}
            {objective.is_locked && (
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-zinc-100 text-zinc-500">
                Bloqueado
              </span>
            )}
          </div>
          <h4 className="font-medium text-zinc-900">{objective.title}</h4>
          {objective.description && (
            <p className="mt-1 text-sm text-zinc-500">{objective.description}</p>
          )}
          
          {/* Progress Bar */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
              <span>Progreso {hasSubObjectives ? '(calculado)' : ''}</span>
              <span>{displayProgress}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-zinc-100">
              <div
                className={`h-2 rounded-full transition-all ${
                  displayProgress === 100 ? 'bg-green-500' :
                  displayProgress >= 50 ? 'bg-purple-500' :
                  'bg-yellow-500'
                }`}
                style={{ width: `${Math.min(displayProgress, 100)}%` }}
              />
            </div>
          </div>

          {/* Sub-objectives section */}
          {requiredSubObjectives > 0 && (
            <div className="mt-4 border-t border-zinc-100 pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-zinc-700">
                  Sub-objetivos ({actualSubObjectives}/{requiredSubObjectives})
                </span>
                {!subObjectivesComplete && (
                  <span className="text-xs text-amber-600">
                    Faltan {requiredSubObjectives - actualSubObjectives} sub-objetivo(s)
                  </span>
                )}
              </div>
              
              {hasSubObjectives ? (
                <div className="space-y-2">
                  {objective.sub_objectives!.map((sub, idx) => {
                    const subHasAchievement = sub.achievement_percentage !== null && sub.achievement_percentage !== undefined;
                    return (
                    <div key={sub.id} className="rounded-lg bg-zinc-50 p-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-purple-600 bg-purple-100 px-2 py-0.5 rounded">
                          {SUB_OBJECTIVE_LABELS[objective.periodicity]?.[idx] || `#${idx + 1}`}
                        </span>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-zinc-700">{sub.title}</p>
                          {sub.description && (
                            <p className="text-xs text-zinc-500 mt-0.5">{sub.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          {subHasAchievement ? (
                            <span className="text-xs font-medium px-2 py-1 rounded bg-emerald-100 text-emerald-700">
                              {sub.achievement_percentage}%
                            </span>
                          ) : (
                            <>
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 rounded-full bg-zinc-200">
                                  <div 
                                    className="h-1.5 rounded-full bg-purple-500"
                                    style={{ width: `${sub.progress_percentage}%` }}
                                  />
                                </div>
                                <span className="text-xs text-zinc-500">{sub.progress_percentage}%</span>
                              </div>
                            </>
                          )}
                          {canEvaluate && onEvaluateSubObjective && (
                            <button
                              onClick={() => onEvaluateSubObjective(sub)}
                              className="text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
                            >
                              {subHasAchievement ? 'Editar' : 'Evaluar'}
                            </button>
                          )}
                        </div>
                      </div>
                      {subHasAchievement && sub.achievement_notes && (
                        <div className="mt-2 text-xs text-emerald-600 bg-emerald-50 rounded p-2">
                          {sub.achievement_notes}
                        </div>
                      )}
                    </div>
                  );})}
                </div>
              ) : (
                <p className="text-sm text-zinc-400 italic">
                  Agrega sub-objetivos para este objetivo {objective.periodicity}
                </p>
              )}
            </div>
          )}

          {/* Achievement Notes */}
          {hasAchievement && objective.achievement_notes && (
            <div className="mt-3 rounded-lg bg-emerald-50 p-3">
              <p className="text-xs font-medium text-emerald-700 mb-1">Notas de evaluación:</p>
              <p className="text-sm text-emerald-600">{objective.achievement_notes}</p>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          {canEvaluate && (
            <button
              onClick={onEvaluate}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Evaluar
            </button>
          )}
          {canEdit && (
            <div className="flex items-center gap-1">
              <button
                onClick={onEdit}
                className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                title="Editar"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={onDelete}
                className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                title="Eliminar"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
