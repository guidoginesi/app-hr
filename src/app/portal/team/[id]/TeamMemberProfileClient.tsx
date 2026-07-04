'use client';


import { Spinner } from '@/components/Spinner';
import { SelectMenu } from '@pow/ui/components/ui/select-menu';
import { Button } from '@pow/ui/components/ui/button';
import { Dialog } from '@pow/ui/components/ui/dialog';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import type { Employee } from '@/types/employee';
import type { Objective } from '@/types/objective';
import { ObjectiveCard } from '@/components/ObjectiveCard';
import { 
  getSeniorityLabel, 
  getSeniorityCategory, 
  SENIORITY_CATEGORY_COLORS,
  SENIORITY_CATEGORY_LABELS,
  SeniorityCategory
} from '@/types/corporate-objectives';

// Types for evaluation detail modal
type EvaluationItem = {
  id: string;
  dimension_id: string;
  statement: string;
  order_index: number;
};

type EvaluationDimension = {
  id: string;
  name: string;
  description: string | null;
  order_index: number;
  items: EvaluationItem[];
};

type EvaluationResponse = {
  id: string;
  item_id: string;
  score: number | null;
  explanation: string | null;
};

type EvaluationOpenQuestion = {
  id: string;
  question_key: string;
  response: string | null;
};

type EvaluationDetail = {
  evaluation: any;
  dimensions: EvaluationDimension[];
  responses: EvaluationResponse[];
  openQuestions: EvaluationOpenQuestion[];
  objectives?: any[];
  recategorization?: any;
  selfEvaluationSummary?: any;
};

const OPEN_QUESTION_LABELS: Record<string, { self: string; leader: string }> = {
  strengths: {
    self: '¿Cuáles consideras que son tus principales fortalezas?',
    leader: '¿Cuáles consideras que son las principales fortalezas del colaborador?',
  },
  growth_areas: {
    self: '¿En qué aspectos consideras que deberías crecer o mejorar?',
    leader: '¿En qué debería enfocarse para crecer o mejorar?',
  },
  leader_support: {
    self: '¿Qué necesitás de tu líder para cumplir tus objetivos?',
    leader: '¿Qué necesita de vos como líder para cumplir sus objetivos?',
  },
};

type Evaluation = {
  id: string;
  employee_id: string;
  evaluator_id: string;
  type: 'self' | 'leader';
  status: string;
  created_at: string;
  submitted_at: string | null;
  total_score: number | null;
  dimension_scores: Record<string, number> | null;
  period?: {
    id: string;
    name: string;
    year: number;
    status: string;
  } | null;
  evaluator?: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
};

type SeniorityHistoryItem = {
  id: string;
  previous_level: string | null;
  new_level: string;
  effective_date: string;
  notes: string | null;
  created_at: string;
};

type BonusData = {
  member: { 
    id: string; 
    name: string; 
    seniority_level: string | null; 
    effective_seniority_level: string | null; // Level used for this bonus calculation
    hire_date: string | null;
  };
  year: number;
  isCurrentYear: boolean;
  weights: {
    company: number;
    area: number;
    billing: number;
    nps: number;
    area1: number;
    area2: number;
  };
  proRata: {
    applies: boolean;
    factor: number;
    months: number;
    percentage: number;
  };
  corporate: {
    billing: {
      target: number | null;
      actual: number | null;
      gatePercentage: number;
      gateMet: boolean;
      rawCompletion: number; // Actual % achieved
      completion: number; // % that counts for bonus (0 if gate not met)
    };
    nps: {
      quarters: { quarter: string; score: number | null; met: boolean; actual: number | null; target: number | null }[];
      averageCompletion: number;
    };
    totalCompletion: number;
  };
  personal: {
    objectives: { title: string; achievement: number | null }[];
    averageCompletion: number;
    evaluatedCount: number;
    totalCount: number;
  };
  bonus: {
    companyComponent: number;
    personalComponent: number;
    totalPercentage: number; // Before pro-rata
    gateMet: boolean;
    finalPercentage: number; // After pro-rata
  };
};

type RecategorizationData = {
  canRecategorize: boolean;
  reason: string | null;
  member: any;
  period: any;
  evaluation: {
    id: string;
    total_score: number | null;
    submitted_at: string;
  } | null;
  objectives: {
    total: number;
    evaluated: number;
    completion: number;
  } | null;
  eligibility: {
    withinLevel: boolean;
    levelChange: boolean;
    leaderScore: number;
    objectivesCompletion: number;
  } | null;
  recategorization: {
    id: string;
    level_recategorization: 'approved' | 'not_approved' | null;
    position_recategorization: 'approved' | 'not_approved' | null;
    recommended_level: string | null;
    notes: string | null;
  } | null;
};

// Helper function to get available sub-levels for recategorization
function getAvailableSubLevels(currentLevel: string | null, isLevelChange: boolean): string[] {
  if (!currentLevel) return [];
  
  const match = currentLevel.match(/^(\d)\.(\d)$/);
  if (!match) return [];
  
  const majorLevel = parseInt(match[1]);
  const minorLevel = parseInt(match[2]);
  
  if (isLevelChange) {
    // For level change: next major level, all sub-levels
    const nextMajor = majorLevel + 1;
    if (nextMajor > 5) return [];
    return ['1', '2', '3', '4'].map(sub => `${nextMajor}.${sub}`);
  } else {
    // For within level: same major, higher sub-levels
    const availableSubs: string[] = [];
    for (let sub = minorLevel + 1; sub <= 4; sub++) {
      availableSubs.push(`${majorLevel}.${sub}`);
    }
    return availableSubs;
  }
}

type TeamMemberProfileClientProps = {
  member: Employee & {
    department?: { id: string; name: string } | null;
    legal_entity?: { id: string; name: string } | null;
  };
  evaluations: Evaluation[];
  objectives: Objective[];
  seniorityHistory: SeniorityHistoryItem[];
  availableBonusYears: number[];
};

export function TeamMemberProfileClient({
  member,
  evaluations,
  objectives,
  seniorityHistory,
  availableBonusYears,
}: TeamMemberProfileClientProps) {
  const [activeTab, setActiveTab] = useState<'objectives' | 'evaluations' | 'recategorization' | 'bonus' | 'history'>('objectives');
  const [showEvaluationModal, setShowEvaluationModal] = useState(false);
  const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(null);
  const [evaluationDetail, setEvaluationDetail] = useState<EvaluationDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  
  // Recategorization state
  const [recatData, setRecatData] = useState<RecategorizationData | null>(null);
  const [loadingRecat, setLoadingRecat] = useState(false);
  const [savingRecat, setSavingRecat] = useState(false);
  const [recatSaveError, setRecatSaveError] = useState<string | null>(null);
  const [isEditingRecat, setIsEditingRecat] = useState(false);
  // Note for the "not available" case (evaluation exists but canRecategorize = false)
  const [notAvailableNote, setNotAvailableNote] = useState('');
  const [savingNotAvailableNote, setSavingNotAvailableNote] = useState(false);
  const [recatForm, setRecatForm] = useState({
    level_recategorization: '' as 'approved' | 'not_approved' | '',
    position_recategorization: '' as 'approved' | 'not_approved' | '',
    recommended_level: '',
    notes: '',
  });

  // Bonus state
  const currentYear = new Date().getFullYear();
  const [bonusData, setBonusData] = useState<BonusData | null>(null);
  const [loadingBonus, setLoadingBonus] = useState(false);
  // Default to most recent year with corporate objectives, or current year if none
  const [bonusYear, setBonusYear] = useState(availableBonusYears[0] || currentYear);

  // Load recategorization data when tab is selected
  useEffect(() => {
    if (activeTab === 'recategorization' && !recatData) {
      loadRecategorizationData();
    }
    if (activeTab === 'bonus') {
      loadBonusData(bonusYear);
    }
  }, [activeTab, bonusYear]);

  const loadBonusData = async (year: number) => {
    setLoadingBonus(true);
    try {
      const res = await fetch(`/api/portal/team/${member.id}/bonus?year=${year}`);
      if (res.ok) {
        const data = await res.json();
        setBonusData(data);
      }
    } catch (error) {
      console.error('Error loading bonus data:', error);
    } finally {
      setLoadingBonus(false);
    }
  };

  const loadRecategorizationData = async () => {
    setLoadingRecat(true);
    try {
      const res = await fetch(`/api/portal/team/${member.id}/recategorization`);
      if (res.ok) {
        const data = await res.json();
        setRecatData(data);
        // Pre-fill form if there's existing recategorization
        if (data.recategorization) {
          setRecatForm({
            level_recategorization: data.recategorization.level_recategorization || '',
            position_recategorization: data.recategorization.position_recategorization || '',
            recommended_level: data.recategorization.recommended_level || '',
            notes: data.recategorization.notes || '',
          });
        }
      }
    } catch (error) {
      console.error('Error loading recategorization data:', error);
    } finally {
      setLoadingRecat(false);
    }
  };

  const handleSaveRecategorization = async () => {
    setRecatSaveError(null);

    if (!recatData?.evaluation?.id) {
      setRecatSaveError('No se encontró la evaluación vinculada. Recargá la página e intentá de nuevo.');
      return;
    }

    // Determine final values - if not eligible, automatically set to not_approved
    const finalLevelRecat = recatData.eligibility?.withinLevel 
      ? recatForm.level_recategorization 
      : 'not_approved';
    const finalPositionRecat = recatData.eligibility?.levelChange 
      ? recatForm.position_recategorization 
      : 'not_approved';

    // Validate that eligible items have a selection
    if (recatData.eligibility?.withinLevel && !recatForm.level_recategorization) {
      return;
    }
    if (recatData.eligibility?.levelChange && !recatForm.position_recategorization) {
      return;
    }

    // Validate that recommended_level is selected if any recategorization is approved
    const needsRecommendedLevel = finalLevelRecat === 'approved' || finalPositionRecat === 'approved';
    if (needsRecommendedLevel && !recatForm.recommended_level) {
      return;
    }

    setSavingRecat(true);
    try {
      const res = await fetch(`/api/portal/team/${member.id}/recategorization`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evaluation_id: recatData.evaluation.id,
          level_recategorization: finalLevelRecat,
          position_recategorization: finalPositionRecat,
          recommended_level: recatForm.recommended_level || null,
          notes: recatForm.notes || null,
        }),
      });

      if (res.ok) {
        const saved = await res.json();
        setIsEditingRecat(false);
        // Update recategorization in state immediately from the POST response
        setRecatData(prev => prev ? { ...prev, recategorization: saved } : prev);
        // Also sync form fields with saved values
        setRecatForm({
          level_recategorization: saved.level_recategorization || '',
          position_recategorization: saved.position_recategorization || '',
          recommended_level: saved.recommended_level || '',
          notes: saved.notes || '',
        });
      } else {
        const err = await res.json().catch(() => ({}));
        setRecatSaveError(err.error || `Error ${res.status} al guardar. Intentá de nuevo.`);
        console.error('Error saving recategorization:', res.status, err);
      }
    } catch (error) {
      setRecatSaveError('Error de red al guardar. Intentá de nuevo.');
      console.error('Error saving recategorization:', error);
    } finally {
      setSavingRecat(false);
    }
  };

  const handleSaveNotAvailableNote = async () => {
    if (!recatData?.period?.id && !recatData?.evaluation?.id) return;

    setSavingNotAvailableNote(true);
    try {
      const payload: Record<string, unknown> = {
        level_recategorization: 'not_approved',
        position_recategorization: 'not_approved',
        recommended_level: null,
        notes: notAvailableNote.trim() || null,
      };
      if (recatData.evaluation?.id) {
        payload.evaluation_id = recatData.evaluation.id;
      } else {
        payload.period_id = recatData.period!.id;
      }

      const res = await fetch(`/api/portal/team/${member.id}/recategorization`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const saved = await res.json();
        setNotAvailableNote('');
        setRecatData(prev => prev ? { ...prev, recategorization: saved } : prev);
      }
    } catch (error) {
      console.error('Error saving HR note:', error);
    } finally {
      setSavingNotAvailableNote(false);
    }
  };

  const handleViewEvaluation = async (evaluation: Evaluation) => {
    setSelectedEvaluation(evaluation);
    setShowEvaluationModal(true);
    setLoadingDetail(true);
    
    try {
      const res = await fetch(`/api/portal/evaluations/${evaluation.id}`);
      if (res.ok) {
        const data = await res.json();
        setEvaluationDetail(data);
      } else {
        const err = await res.json().catch(() => ({}));
        console.error('Error fetching evaluation details:', res.status, err);
      }
    } catch (error) {
      console.error('Error fetching evaluation details:', error);
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeEvaluationModal = () => {
    setShowEvaluationModal(false);
    setSelectedEvaluation(null);
    setEvaluationDetail(null);
  };

  // Calculate dimension average from responses
  const getDimensionAverage = (dimensionId: string): number | null => {
    if (!evaluationDetail) return null;
    const dimension = evaluationDetail.dimensions.find(d => d.id === dimensionId);
    if (!dimension) return null;
    
    const itemIds = dimension.items.map(i => i.id);
    const responses = evaluationDetail.responses.filter(r => itemIds.includes(r.item_id) && r.score !== null);
    
    if (responses.length === 0) return null;
    const sum = responses.reduce((acc, r) => acc + (r.score || 0), 0);
    return sum / responses.length;
  };
  const initials = `${member.first_name?.charAt(0) || ''}${member.last_name?.charAt(0) || ''}`.toUpperCase();

  // Group objectives by year
  const objectivesByYear = objectives.reduce((acc, obj) => {
    if (!acc[obj.year]) acc[obj.year] = [];
    acc[obj.year].push(obj);
    return acc;
  }, {} as Record<number, Objective[]>);

  const years = Object.keys(objectivesByYear).map(Number).sort((a, b) => b - a);

  const seniorityCategory = getSeniorityCategory(member.seniority_level);
  const seniorityColors = seniorityCategory ? SENIORITY_CATEGORY_COLORS[seniorityCategory] : null;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link
        href="/portal/team"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Volver a Mi Equipo
      </Link>

      {/* Header with member info */}
      <div className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <div className="flex items-start gap-6">
          {member.photo_url ? (
            <img
              src={member.photo_url}
              alt={`${member.first_name} ${member.last_name}`}
              className="h-20 w-20 rounded-full object-cover ring-2 ring-[var(--border)]"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary ring-2 ring-[var(--border)]">
              <span className="text-2xl font-bold text-secondary-foreground">{initials}</span>
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-foreground">
                  {member.first_name} {member.last_name}
                </h1>
                <p className="mt-1 text-muted-foreground">{member.job_title || 'Sin puesto definido'}</p>
              </div>
              {member.seniority_level && seniorityColors && (
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${seniorityColors.bg} ${seniorityColors.text}`}>
                  {getSeniorityLabel(member.seniority_level)}
                </span>
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Email</p>
                <p className="mt-1 text-sm text-foreground">{member.work_email || member.personal_email}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Departamento</p>
                <p className="mt-1 text-sm text-foreground">{member.department?.name || '-'}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Fecha de ingreso</p>
                <p className="mt-1 text-sm text-foreground">
                  {member.hire_date 
                    ? new Date(member.hire_date + 'T00:00:00').toLocaleDateString('es-AR', { 
                        day: 'numeric', 
                        month: 'long', 
                        year: 'numeric' 
                      })
                    : '-'}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Estado</p>
                <p className="mt-1">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    member.status === 'active' ? 'bg-success-subtle text-[var(--green-700)]' : 'bg-secondary text-muted-foreground'
                  }`}>
                    {member.status === 'active' ? 'Activo' : member.status}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[var(--border)]">
        <nav className="flex gap-6">
          <button
            onClick={() => setActiveTab('objectives')}
            className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
              activeTab === 'objectives'
                ? 'border-brand text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Objetivos ({objectives.length})
          </button>
          <button
            onClick={() => setActiveTab('evaluations')}
            className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
              activeTab === 'evaluations'
                ? 'border-brand text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Evaluaciones ({evaluations.length})
          </button>
          <button
            onClick={() => setActiveTab('recategorization')}
            className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
              activeTab === 'recategorization'
                ? 'border-brand text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Recategorización
          </button>
          <button
            onClick={() => setActiveTab('bonus')}
            className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
              activeTab === 'bonus'
                ? 'border-brand text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Bono
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
              activeTab === 'history'
                ? 'border-brand text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Historial de Seniority
          </button>
        </nav>
      </div>

      {/* Objectives Tab */}
      {activeTab === 'objectives' && (
        <div className="space-y-6">
          {years.length === 0 ? (
            <div className="rounded-xl border border-[var(--border)] bg-white p-12 text-center">
              <svg className="mx-auto h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <p className="mt-4 text-muted-foreground">No hay objetivos registrados</p>
              <Link
                href="/portal/objetivos"
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-[var(--primary-hover)]"
              >
                Ir a Objetivos
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          ) : (
            years.map(year => (
              <div key={year} className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
                <div className="border-b border-[var(--border)] px-6 py-4">
                  <h3 className="text-lg font-semibold text-foreground">Objetivos {year}</h3>
                </div>
                <div className="p-4 space-y-3">
                  {objectivesByYear[year].map(obj => (
                    <ObjectiveCard
                      key={obj.id}
                      objective={obj}
                      readOnly={true}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Evaluations Tab */}
      {activeTab === 'evaluations' && (
        <div className="space-y-4">
          {evaluations.length === 0 ? (
            <div className="rounded-xl border border-[var(--border)] bg-white p-12 text-center">
              <svg className="mx-auto h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="mt-4 text-muted-foreground">No hay evaluaciones registradas</p>
            </div>
          ) : (
            <>
              {/* Group by period */}
              {(() => {
                const groupedByPeriod = evaluations.reduce((acc, ev) => {
                  const periodKey = ev.period?.id || 'sin-periodo';
                  if (!acc[periodKey]) {
                    acc[periodKey] = {
                      period: ev.period,
                      evaluations: []
                    };
                  }
                  acc[periodKey].evaluations.push(ev);
                  return acc;
                }, {} as Record<string, { period: Evaluation['period']; evaluations: Evaluation[] }>);

                return Object.values(groupedByPeriod).map(({ period, evaluations: periodEvals }) => (
                  <div key={period?.id || 'sin-periodo'} className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
                    <div className="border-b border-[var(--border)] px-6 py-4">
                      <h3 className="text-lg font-semibold text-foreground">
                        {period?.name || 'Evaluación'}
                      </h3>
                      {period?.year && (
                        <p className="text-sm text-muted-foreground">Año {period.year}</p>
                      )}
                    </div>
                    <div className="divide-y divide-[var(--border)]">
                      {periodEvals.map(evaluation => {
                        const isLeaderEval = evaluation.type === 'leader';
                        return (
                          <div key={evaluation.id} className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                                    isLeaderEval ? 'bg-secondary text-foreground' : 'bg-secondary text-foreground'
                                  }`}>
                                    {isLeaderEval ? 'Evaluación del líder' : 'Autoevaluación'}
                                  </span>
                                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                                    evaluation.status === 'submitted' ? 'bg-success-subtle text-[var(--green-700)]' :
                                    evaluation.status === 'in_progress' ? 'bg-warning-subtle text-[var(--amber-600)]' :
                                    'bg-secondary text-muted-foreground'
                                  }`}>
                                    {evaluation.status === 'submitted' ? 'Enviada' :
                                     evaluation.status === 'in_progress' ? 'En progreso' :
                                     evaluation.status === 'draft' ? 'Borrador' : evaluation.status}
                                  </span>
                                </div>
                                {isLeaderEval && evaluation.evaluator && (
                                  <p className="text-sm text-muted-foreground">
                                    Evaluado por: <span className="font-medium">{evaluation.evaluator.first_name} {evaluation.evaluator.last_name}</span>
                                  </p>
                                )}
                                {evaluation.submitted_at && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Enviada el {new Date(evaluation.submitted_at).toLocaleDateString('es-AR', {
                                      day: 'numeric',
                                      month: 'long',
                                      year: 'numeric'
                                    })}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-4">
                                {evaluation.total_score !== null && (
                                  <div className="text-right">
                                    <span className={`text-2xl font-bold ${
                                      evaluation.total_score >= 8 ? 'text-[var(--green-700)]' :
                                      evaluation.total_score >= 6 ? 'text-[var(--amber-600)]' :
                                      evaluation.total_score >= 4 ? 'text-[var(--amber-600)]' :
                                      'text-[var(--red-600)]'
                                    }`}>
                                      {evaluation.total_score.toFixed(1)}
                                    </span>
                                    <span className="text-sm text-muted-foreground">/10</span>
                                  </div>
                                )}
                                {evaluation.status === 'submitted' && (
                                  <button
                                    onClick={() => handleViewEvaluation(evaluation)}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-medium text-secondary-foreground shadow-sm transition-colors hover:bg-muted"
                                  >
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                    Ver detalle
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ));
              })()}
            </>
          )}
        </div>
      )}

      {/* Recategorization Tab */}
      {activeTab === 'recategorization' && (
        <div className="space-y-6">
          {loadingRecat ? (
            <div className="rounded-xl border border-[var(--border)] bg-white p-12">
              <div className="flex items-center justify-center">
                <Spinner className="h-8 w-8 text-muted-foreground" />
              </div>
            </div>
          ) : !recatData?.canRecategorize ? (
            <div className="rounded-xl border border-[var(--border)] bg-white p-8">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                  <svg className="h-6 w-6 text-secondary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Recategorización no disponible</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {recatData?.reason || 'Para habilitar la recategorización, primero debe completarse la evaluación de desempeño y la evaluación de objetivos.'}
                  </p>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className={`rounded-lg border p-4 ${recatData?.evaluation ? 'border-brand bg-success-subtle' : 'border-[var(--border)] bg-muted'}`}>
                  <div className="flex items-center gap-2">
                    {recatData?.evaluation ? (
                      <svg className="h-5 w-5 text-[var(--green-700)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    <span className={`text-sm font-medium ${recatData?.evaluation ? 'text-[var(--green-700)]' : 'text-muted-foreground'}`}>
                      Evaluación de desempeño
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {recatData?.evaluation ? 'Completada' : 'Pendiente'}
                  </p>
                </div>
                <div className={`rounded-lg border p-4 ${recatData?.objectives?.evaluated === recatData?.objectives?.total && (recatData?.objectives?.total ?? 0) > 0 ? 'border-brand bg-success-subtle' : 'border-[var(--border)] bg-muted'}`}>
                  <div className="flex items-center gap-2">
                    {recatData?.objectives?.evaluated === recatData?.objectives?.total && (recatData?.objectives?.total ?? 0) > 0 ? (
                      <svg className="h-5 w-5 text-[var(--green-700)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    <span className={`text-sm font-medium ${recatData?.objectives?.evaluated === recatData?.objectives?.total && (recatData?.objectives?.total ?? 0) > 0 ? 'text-[var(--green-700)]' : 'text-muted-foreground'}`}>
                      Evaluación de objetivos
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {recatData?.objectives ? `${recatData.objectives.evaluated}/${recatData.objectives.total} evaluados` : 'Sin objetivos'}
                  </p>
                </div>
              </div>

              {/* HR note — available whenever there is an active period (with or without evaluation) */}
              {recatData?.period?.id && (
                <div className="mt-6 border-t border-[var(--border)] pt-6">
                  {recatData.recategorization ? (
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success-subtle">
                        <svg className="h-4 w-4 text-[var(--green-700)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-secondary-foreground">Comentario enviado a HR</p>
                        {recatData.recategorization.notes ? (
                          <p className="mt-1 text-sm text-muted-foreground rounded-lg bg-muted border border-[var(--border)] px-3 py-2">
                            {recatData.recategorization.notes}
                          </p>
                        ) : (
                          <p className="mt-1 text-sm text-muted-foreground italic">Sin comentario adicional</p>
                        )}
                        <button
                          onClick={() => {
                            setNotAvailableNote(recatData.recategorization?.notes || '');
                            // Clear the saved recategorization from local state to re-show the form
                            setRecatData({ ...recatData, recategorization: null });
                          }}
                          className="mt-2 text-xs font-medium text-muted-foreground hover:text-foreground underline"
                        >
                          Modificar comentario
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-secondary-foreground mb-1">Comentario para HR</p>
                      <p className="text-xs text-muted-foreground mb-3">
                        Podés registrar contexto adicional sobre este colaborador. El comentario quedará visible para RRHH aunque no haya recategorización.
                      </p>
                      <textarea
                        value={notAvailableNote}
                        onChange={(e) => setNotAvailableNote(e.target.value)}
                        rows={3}
                        className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
                        placeholder="Ej: El colaborador tiene un desempeño sólido, se recomienda seguimiento para el próximo período..."
                      />
                      <div className="flex justify-end mt-3">
                        <Button onClick={handleSaveNotAvailableNote} loading={savingNotAvailableNote}>
                          Enviar a HR
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Leader Evaluation Score */}
                <div className="rounded-xl border border-[var(--border)] bg-white p-6">
                  <p className="text-sm font-medium text-muted-foreground">Evaluación del líder</p>
                  <p className={`text-3xl font-bold mt-2 ${
                    (recatData.eligibility?.leaderScore || 0) > 9 ? 'text-[var(--green-700)]' :
                    (recatData.eligibility?.leaderScore || 0) > 8 ? 'text-[var(--amber-600)]' :
                    'text-[var(--amber-600)]'
                  }`}>
                    {recatData.eligibility?.leaderScore?.toFixed(1) || '-'}
                    <span className="text-sm text-muted-foreground font-normal">/10</span>
                  </p>
                </div>

                {/* Objectives Completion */}
                <div className="rounded-xl border border-[var(--border)] bg-white p-6">
                  <p className="text-sm font-medium text-muted-foreground">Cumplimiento de objetivos</p>
                  <p className={`text-3xl font-bold mt-2 ${
                    (recatData.eligibility?.objectivesCompletion || 0) >= 90 ? 'text-[var(--green-700)]' :
                    (recatData.eligibility?.objectivesCompletion || 0) >= 75 ? 'text-[var(--amber-600)]' :
                    'text-[var(--amber-600)]'
                  }`}>
                    {recatData.eligibility?.objectivesCompletion || 0}%
                  </p>
                </div>

                {/* Current Seniority */}
                <div className="rounded-xl border border-[var(--border)] bg-white p-6">
                  <p className="text-sm font-medium text-muted-foreground">Nivel actual</p>
                  <p className="text-xl font-semibold mt-2 text-foreground">
                    {member.seniority_level ? getSeniorityLabel(member.seniority_level) : 'Sin asignar'}
                  </p>
                </div>
              </div>

              {/* Eligibility Rules */}
              <div className="rounded-xl border border-[var(--border)] bg-white p-6">
                <h3 className="text-base font-semibold text-foreground mb-4">Elegibilidad para recategorización</h3>
                <div className="space-y-4">
                  {/* Within Level */}
                  <div className={`rounded-lg border p-4 ${recatData.eligibility?.withinLevel ? 'border-brand bg-success-subtle' : 'border-[var(--border)] bg-muted'}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${recatData.eligibility?.withinLevel ? 'bg-success-subtle' : 'bg-secondary'}`}>
                          {recatData.eligibility?.withinLevel ? (
                            <svg className="h-5 w-5 text-[var(--green-700)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <h4 className={`font-medium ${recatData.eligibility?.withinLevel ? 'text-[var(--green-700)]' : 'text-secondary-foreground'}`}>
                            Recategorización dentro del nivel
                          </h4>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            Ej: De 3.1 a 3.2 (avance dentro del mismo nivel de seniority)
                          </p>
                        </div>
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded ${recatData.eligibility?.withinLevel ? 'bg-success-subtle text-[var(--green-700)]' : 'bg-secondary text-muted-foreground'}`}>
                        {recatData.eligibility?.withinLevel ? 'Elegible' : 'No elegible'}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-4 text-sm">
                      <span className={`flex items-center gap-1.5 ${(recatData.eligibility?.leaderScore || 0) > 8 ? 'text-[var(--green-700)]' : 'text-muted-foreground'}`}>
                        {(recatData.eligibility?.leaderScore || 0) > 8 ? (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                        Evaluación {'>'} 8 ({recatData.eligibility?.leaderScore?.toFixed(1)})
                      </span>
                      <span className={`flex items-center gap-1.5 ${(recatData.eligibility?.objectivesCompletion || 0) >= 75 ? 'text-[var(--green-700)]' : 'text-muted-foreground'}`}>
                        {(recatData.eligibility?.objectivesCompletion || 0) >= 75 ? (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                        Objetivos ≥ 75% ({recatData.eligibility?.objectivesCompletion}%)
                      </span>
                    </div>
                  </div>

                  {/* Level Change */}
                  <div className={`rounded-lg border p-4 ${recatData.eligibility?.levelChange ? 'border-[var(--border)] bg-secondary' : 'border-[var(--border)] bg-muted'}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${recatData.eligibility?.levelChange ? 'bg-secondary' : 'bg-secondary'}`}>
                          {recatData.eligibility?.levelChange ? (
                            <svg className="h-5 w-5 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <h4 className={`font-medium ${recatData.eligibility?.levelChange ? 'text-foreground' : 'text-secondary-foreground'}`}>
                            Recategorización de nivel (Ascenso)
                          </h4>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            Ej: De 3.4 a 4.1 (cambio de nivel de seniority)
                          </p>
                        </div>
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded ${recatData.eligibility?.levelChange ? 'bg-secondary text-foreground' : 'bg-secondary text-muted-foreground'}`}>
                        {recatData.eligibility?.levelChange ? 'Elegible' : 'No elegible'}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-4 text-sm">
                      <span className={`flex items-center gap-1.5 ${(recatData.eligibility?.leaderScore || 0) > 9 ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {(recatData.eligibility?.leaderScore || 0) > 9 ? (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                        Evaluación {'>'} 9 ({recatData.eligibility?.leaderScore?.toFixed(1)})
                      </span>
                      <span className={`flex items-center gap-1.5 ${(recatData.eligibility?.objectivesCompletion || 0) >= 90 ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {(recatData.eligibility?.objectivesCompletion || 0) >= 90 ? (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                        Objetivos ≥ 90% ({recatData.eligibility?.objectivesCompletion}%)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Decision Form */}
              <div className="rounded-xl border border-[var(--border)] bg-white p-6">
                <h3 className="text-base font-semibold text-foreground mb-4">Decisión de recategorización</h3>
                
                {recatData.recategorization?.level_recategorization && recatData.recategorization?.position_recategorization && !isEditingRecat ? (
                  // Show saved decision
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <p className="text-sm text-muted-foreground">Recategorización dentro del nivel</p>
                        <p className={`font-semibold mt-1 ${recatData.recategorization.level_recategorization === 'approved' ? 'text-[var(--green-700)]' : 'text-[var(--red-600)]'}`}>
                          {recatData.recategorization.level_recategorization === 'approved' ? 'Aprobada' : 'No aprobada'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Recategorización de nivel</p>
                        <p className={`font-semibold mt-1 ${recatData.recategorization.position_recategorization === 'approved' ? 'text-[var(--green-700)]' : 'text-[var(--red-600)]'}`}>
                          {recatData.recategorization.position_recategorization === 'approved' ? 'Aprobada' : 'No aprobada'}
                        </p>
                      </div>
                      {recatData.recategorization.recommended_level && (
                        <div>
                          <p className="text-sm text-muted-foreground">Nuevo nivel recomendado</p>
                          <p className="font-semibold mt-1 text-foreground">
                            {getSeniorityLabel(recatData.recategorization.recommended_level)}
                          </p>
                        </div>
                      )}
                    </div>
                    {recatData.recategorization.notes && (
                      <div className="pt-4 border-t border-[var(--border)]">
                        <p className="text-sm text-muted-foreground">Notas</p>
                        <p className="mt-1 text-sm text-secondary-foreground">{recatData.recategorization.notes}</p>
                      </div>
                    )}
                    <button
                      onClick={() => {
                        setRecatForm({
                          level_recategorization: recatData.recategorization?.level_recategorization || '',
                          position_recategorization: recatData.recategorization?.position_recategorization || '',
                          recommended_level: recatData.recategorization?.recommended_level || '',
                          notes: recatData.recategorization?.notes || '',
                        });
                        setIsEditingRecat(true);
                      }}
                      className="mt-4 text-sm font-medium text-foreground hover:text-[var(--primary-hover)]"
                    >
                      Modificar decisión
                    </button>
                  </div>
                ) : (
                  // Show form
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Within Level Decision */}
                      <div>
                        <label className="block text-sm font-medium text-secondary-foreground mb-2">
                          Recategorización dentro del nivel
                          {!recatData.eligibility?.withinLevel && (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">(No elegible)</span>
                          )}
                        </label>
                        {recatData.eligibility?.withinLevel ? (
                          <div className="space-y-2">
                            <label className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                              recatForm.level_recategorization === 'approved' 
                                ? 'border-brand bg-success-subtle' 
                                : 'border-[var(--border)] hover:border-[var(--border)]'
                            }`}>
                              <input
                                type="radio"
                                name="level_recategorization"
                                value="approved"
                                checked={recatForm.level_recategorization === 'approved'}
                                onChange={(e) => setRecatForm({ ...recatForm, level_recategorization: e.target.value as 'approved' })}
                                className="h-4 w-4 text-[var(--green-700)] focus:ring-ring"
                              />
                              <span className="text-sm font-medium text-foreground">Aprobar</span>
                            </label>
                            <label className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                              recatForm.level_recategorization === 'not_approved' 
                                ? 'border-danger/20 bg-danger-subtle' 
                                : 'border-[var(--border)] hover:border-[var(--border)]'
                            }`}>
                              <input
                                type="radio"
                                name="level_recategorization"
                                value="not_approved"
                                checked={recatForm.level_recategorization === 'not_approved'}
                                onChange={(e) => setRecatForm({ ...recatForm, level_recategorization: e.target.value as 'not_approved' })}
                                className="h-4 w-4 text-[var(--red-600)] focus:ring-ring"
                              />
                              <span className="text-sm font-medium text-foreground">No aprobar</span>
                            </label>
                          </div>
                        ) : (
                          <div className="rounded-lg border border-[var(--border)] bg-muted p-3">
                            <p className="text-sm text-muted-foreground">
                              No cumple los requisitos (Evaluación {'>'} 8 y objetivos ≥ 75%)
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Level Change Decision */}
                      <div>
                        <label className="block text-sm font-medium text-secondary-foreground mb-2">
                          Recategorización de nivel (Ascenso)
                          {!recatData.eligibility?.levelChange && (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">(No elegible)</span>
                          )}
                        </label>
                        {recatData.eligibility?.levelChange ? (
                          <div className="space-y-2">
                            <label className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                              recatForm.position_recategorization === 'approved' 
                                ? 'border-[var(--border)] bg-secondary' 
                                : 'border-[var(--border)] hover:border-[var(--border)]'
                            }`}>
                              <input
                                type="radio"
                                name="position_recategorization"
                                value="approved"
                                checked={recatForm.position_recategorization === 'approved'}
                                onChange={(e) => setRecatForm({ ...recatForm, position_recategorization: e.target.value as 'approved' })}
                                className="h-4 w-4 text-foreground focus:ring-[var(--ring)]"
                              />
                              <span className="text-sm font-medium text-foreground">Aprobar</span>
                            </label>
                            <label className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                              recatForm.position_recategorization === 'not_approved' 
                                ? 'border-danger/20 bg-danger-subtle' 
                                : 'border-[var(--border)] hover:border-[var(--border)]'
                            }`}>
                              <input
                                type="radio"
                                name="position_recategorization"
                                value="not_approved"
                                checked={recatForm.position_recategorization === 'not_approved'}
                                onChange={(e) => setRecatForm({ ...recatForm, position_recategorization: e.target.value as 'not_approved' })}
                                className="h-4 w-4 text-[var(--red-600)] focus:ring-ring"
                              />
                              <span className="text-sm font-medium text-foreground">No aprobar</span>
                            </label>
                          </div>
                        ) : (
                          <div className="rounded-lg border border-[var(--border)] bg-muted p-3">
                            <p className="text-sm text-muted-foreground">
                              No cumple los requisitos para ascenso (Evaluación {'>'} 9 y objetivos ≥ 90%)
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Recommended Level Selector - Only show if any recategorization is approved */}
                    {(recatForm.level_recategorization === 'approved' || recatForm.position_recategorization === 'approved') && (
                      <div>
                        <label className="block text-sm font-medium text-secondary-foreground mb-2">
                          Nuevo nivel recomendado
                        </label>
                        <div className="space-y-3">
                          {recatForm.level_recategorization === 'approved' && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-2">Opciones dentro del nivel actual:</p>
                              <div className="flex flex-wrap gap-2">
                                {getAvailableSubLevels(member.seniority_level, false).map(level => (
                                  <button
                                    key={level}
                                    type="button"
                                    onClick={() => setRecatForm({ ...recatForm, recommended_level: level })}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                      recatForm.recommended_level === level
                                        ? 'bg-primary text-white'
                                        : 'bg-secondary text-secondary-foreground hover:bg-secondary'
                                    }`}
                                  >
                                    {getSeniorityLabel(level)}
                                  </button>
                                ))}
                                {getAvailableSubLevels(member.seniority_level, false).length === 0 && (
                                  <p className="text-sm text-muted-foreground italic">Ya está en el máximo sub-nivel de su categoría</p>
                                )}
                              </div>
                            </div>
                          )}
                          {recatForm.position_recategorization === 'approved' && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-2">Opciones de cambio de nivel (ascenso):</p>
                              <div className="flex flex-wrap gap-2">
                                {getAvailableSubLevels(member.seniority_level, true).map(level => (
                                  <button
                                    key={level}
                                    type="button"
                                    onClick={() => setRecatForm({ ...recatForm, recommended_level: level })}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                      recatForm.recommended_level === level
                                        ? 'bg-primary text-white'
                                        : 'bg-secondary text-secondary-foreground hover:bg-secondary'
                                    }`}
                                  >
                                    {getSeniorityLabel(level)}
                                  </button>
                                ))}
                                {getAvailableSubLevels(member.seniority_level, true).length === 0 && (
                                  <p className="text-sm text-muted-foreground italic">Ya está en el nivel máximo</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        {recatForm.recommended_level && (
                          <p className="mt-3 text-sm text-muted-foreground">
                            Nivel seleccionado: <span className="font-semibold text-foreground">{getSeniorityLabel(recatForm.recommended_level)}</span>
                          </p>
                        )}
                      </div>
                    )}

                    {/* Notes */}
                    <div>
                      <label className="block text-sm font-medium text-secondary-foreground mb-2">
                        Notas (opcional)
                      </label>
                      <textarea
                        value={recatForm.notes}
                        onChange={(e) => setRecatForm({ ...recatForm, notes: e.target.value })}
                        rows={3}
                        className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
                        placeholder="Agregar comentarios o justificación..."
                      />
                    </div>

                    {/* Save error */}
                    {recatSaveError && (
                      <div className="rounded-lg border border-danger/20 bg-danger-subtle px-4 py-3">
                        <p className="text-sm text-[var(--red-600)]">{recatSaveError}</p>
                      </div>
                    )}

                    {/* Submit Button */}
                    <div className="flex items-center justify-end gap-3">
                      {isEditingRecat && recatData.recategorization && (
                        <button
                          type="button"
                          onClick={() => setIsEditingRecat(false)}
                          disabled={savingRecat}
                          className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-muted disabled:opacity-50"
                        >
                          Cancelar
                        </button>
                      )}
                      <Button
                        onClick={handleSaveRecategorization}
                        loading={savingRecat}
                        disabled={
                          (recatData?.eligibility?.withinLevel && !recatForm.level_recategorization) ||
                          (recatData?.eligibility?.levelChange && !recatForm.position_recategorization) ||
                          ((recatForm.level_recategorization === 'approved' || recatForm.position_recategorization === 'approved') && !recatForm.recommended_level)
                        }
                      >
                        Guardar decisión
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Bonus Tab */}
      {activeTab === 'bonus' && (
        <div className="space-y-6">
          {/* Year Selector */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Cálculo de Bono</h3>
              <p className="text-sm text-muted-foreground">Seleccioná el año para ver el bono correspondiente</p>
            </div>
            {availableBonusYears.length > 0 ? (
              <SelectMenu
                value={String(bonusYear)}
                onChange={(v) => setBonusYear(Number(v))}
                ariaLabel="Año del bono"
                align="end"
                options={availableBonusYears.map((year) => ({
                  value: String(year),
                  label: `${year}${year === currentYear ? ' (en curso)' : ''}`,
                }))}
              />
            ) : (
              <span className="text-sm text-muted-foreground">Sin objetivos corporativos configurados</span>
            )}
          </div>

          {loadingBonus ? (
            <div className="rounded-xl border border-[var(--border)] bg-white p-12">
              <div className="flex items-center justify-center">
                <Spinner className="h-8 w-8 text-muted-foreground" />
              </div>
            </div>
          ) : bonusData ? (
            <>
              {/* No Corporate Objectives Banner */}
              {!bonusData.corporate.billing.target && bonusData.corporate.nps.quarters.length === 0 && (
                <div className="rounded-xl border border-[var(--border)] bg-muted p-4">
                  <div className="flex items-center gap-3">
                    <svg className="h-5 w-5 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="font-medium text-foreground">Sin objetivos corporativos configurados para {bonusData.year}</p>
                      <p className="text-sm text-foreground">
                        Los objetivos corporativos (Facturación y NPS) deben configurarse desde la sección de Objetivos en el panel de administración.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Pro-rata Info Banner */}
              {bonusData.proRata.applies && (
                <div className="rounded-xl border border-warning/30 bg-warning-subtle p-4">
                  <div className="flex items-center gap-3">
                    <svg className="h-5 w-5 text-[var(--amber-600)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <div>
                      <p className="font-medium text-[var(--amber-600)]">Bono proporcional</p>
                      <p className="text-sm text-[var(--amber-600)]">
                        El empleado ingresó durante {bonusData.year}, por lo que el bono se calcula proporcionalmente ({bonusData.proRata.months} meses trabajados).
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Seniority Level Info - Show when using historical level */}
              {bonusData.member.effective_seniority_level && 
               bonusData.member.effective_seniority_level !== bonusData.member.seniority_level && (
                <div className="rounded-xl border border-[var(--border)] bg-muted p-4">
                  <div className="flex items-center gap-3">
                    <svg className="h-5 w-5 text-foreground flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="font-medium text-foreground">Nivel de seniority histórico</p>
                      <p className="text-sm text-foreground">
                        El bono de {bonusData.year} se calcula con el nivel <strong>{bonusData.member.effective_seniority_level}</strong> (vigente al cierre del período).
                        El nivel actual es <strong>{bonusData.member.seniority_level}</strong>.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Weights Info - Single combined bar with centered labels */}
              <div className="flex h-8 rounded-lg overflow-hidden">
                <div 
                  className="bg-primary flex items-center justify-center"
                  style={{ width: `${bonusData.weights.company}%` }}
                >
                  <span className="text-xs font-semibold text-white">Corporativo {bonusData.weights.company}%</span>
                </div>
                <div 
                  className="bg-primary flex items-center justify-center"
                  style={{ width: `${bonusData.weights.area}%` }}
                >
                  <span className="text-xs font-semibold text-white">Personal {bonusData.weights.area}%</span>
                </div>
              </div>

              {/* Corporate Objectives */}
              <div className="rounded-xl border border-[var(--border)] bg-white p-6">
                <h3 className="text-base font-semibold text-foreground mb-4">
                  Objetivos corporativos
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({bonusData.corporate.totalCompletion.toFixed(1)}% promedio)
                  </span>
                </h3>
                <div className="space-y-4">
                  {/* Billing */}
                  <div className={`rounded-lg border p-4 ${bonusData.bonus.gateMet ? 'border-brand bg-success-subtle' : 'border-[var(--border)] bg-muted'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">Facturación (Anual)</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-secondary text-foreground">
                          Peso: {bonusData.weights.billing}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {bonusData.bonus.gateMet ? (
                          <>
                            <span className="text-xs px-2 py-0.5 rounded bg-success-subtle text-[var(--green-700)] flex items-center gap-1">
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Gate alcanzado
                            </span>
                            <span className={`font-semibold ${bonusData.corporate.billing.completion >= 100 ? 'text-[var(--green-700)]' : 'text-[var(--amber-600)]'}`}>
                              {bonusData.corporate.billing.completion.toFixed(1)}%
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-xs px-2 py-0.5 rounded bg-danger-subtle text-[var(--red-600)]">
                              Gate no alcanzado ({bonusData.corporate.billing.gatePercentage}% req.)
                            </span>
                            <span className="text-xs text-muted-foreground">
                              ({bonusData.corporate.billing.rawCompletion.toFixed(1)}% logrado)
                            </span>
                            <span className="font-semibold text-[var(--red-600)]">
                              0%
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    {bonusData.corporate.billing.target && (
                      <p className="text-xs text-muted-foreground">
                        Objetivo: ${bonusData.corporate.billing.target.toLocaleString()} | 
                        Actual: ${(bonusData.corporate.billing.actual || 0).toLocaleString()}
                      </p>
                    )}
                  </div>

                  {/* NPS */}
                  <div className="rounded-lg border border-[var(--border)] bg-muted p-4">
                    {(() => {
                      const quartersWithData = bonusData.corporate.nps.quarters.filter(q => q.score !== null);
                      const quartersMet = quartersWithData.filter(q => q.met).length;
                      const totalQuarters = quartersWithData.length;
                      return (
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground">NPS (Trimestral)</span>
                            <span className="text-xs px-2 py-0.5 rounded bg-secondary text-foreground">
                              Peso: {bonusData.weights.nps}%
                            </span>
                          </div>
                          <div className="text-right">
                            <span className={`font-semibold ${quartersMet === totalQuarters && totalQuarters > 0 ? 'text-[var(--green-700)]' : 'text-[var(--amber-600)]'}`}>
                              {bonusData.corporate.nps.averageCompletion.toFixed(0)}%
                            </span>
                            {totalQuarters > 0 && (
                              <span className="text-xs text-muted-foreground ml-2">
                                ({quartersMet}/{totalQuarters} cumplidos)
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                    <div className="grid grid-cols-4 gap-2">
                      {['q1', 'q2', 'q3', 'q4'].map(quarter => {
                        const npsQ = bonusData.corporate.nps.quarters.find(q => q.quarter === quarter);
                        const hasData = npsQ && npsQ.score !== null;
                        return (
                          <div key={quarter} className="text-center p-2 bg-white rounded border border-[var(--border)]">
                            <p className="text-xs text-muted-foreground uppercase">{quarter}</p>
                            {hasData ? (
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                npsQ.met ? 'bg-success-subtle text-[var(--green-700)]' : 'bg-danger-subtle text-[var(--red-600)]'
                              }`}>
                                {npsQ.met ? 'Cumplido' : 'No cumplido'}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                            {npsQ && npsQ.actual !== null && npsQ.target !== null && (
                              <p className="text-xs text-muted-foreground mt-1">{npsQ.actual} / {npsQ.target}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Personal Objectives */}
              <div className="rounded-xl border border-[var(--border)] bg-white p-6">
                <h3 className="text-base font-semibold text-foreground mb-4">
                  Objetivos personales
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({bonusData.personal.averageCompletion.toFixed(1)}% promedio - {bonusData.personal.evaluatedCount}/{bonusData.personal.totalCount} evaluados)
                  </span>
                </h3>
                {bonusData.personal.objectives.length > 0 ? (
                  <div className="space-y-2">
                    {bonusData.personal.objectives.map((obj: any, index: number) => (
                      <div key={index} className="py-2 border-b border-[var(--border)] last:border-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-secondary-foreground">{obj.title}</span>
                          <span className={`font-semibold ${
                            obj.achievement === null ? 'text-muted-foreground' :
                            obj.achievement >= 100 ? 'text-[var(--green-700)]' :
                            obj.achievement >= 75 ? 'text-[var(--amber-600)]' :
                            'text-[var(--amber-600)]'
                          }`}>
                            {obj.achievement !== null ? `${obj.achievement}%` : 'Sin evaluar'}
                          </span>
                        </div>
                        {obj.subObjectives && obj.subObjectives.length > 0 && (
                          <div className="mt-2 ml-4 space-y-1">
                            {obj.subObjectives.map((sub: any, subIdx: number) => (
                              <div key={subIdx} className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">{sub.title}</span>
                                <span className={
                                  sub.achievement === null ? 'text-muted-foreground' :
                                  sub.achievement >= 100 ? 'text-[var(--green-700)]' :
                                  'text-muted-foreground'
                                }>
                                  {sub.achievement !== null ? `${sub.achievement}%` : '-'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No hay objetivos personales registrados</p>
                )}
              </div>

              {/* Calculation Breakdown */}
              <div className="rounded-xl border border-[var(--border)] bg-white p-6">
                <h3 className="text-base font-semibold text-foreground mb-4">Desglose del cálculo</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-[var(--border)]">
                    <span className="text-sm text-muted-foreground">
                      Componente corporativo ({bonusData.corporate.totalCompletion.toFixed(1)}% × {bonusData.weights.company}%)
                    </span>
                    <span className="font-semibold text-foreground">
                      {bonusData.bonus.companyComponent.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-[var(--border)]">
                    <span className="text-sm text-muted-foreground">
                      Componente personal ({bonusData.personal.averageCompletion.toFixed(1)}% × {bonusData.weights.area}%)
                    </span>
                    <span className="font-semibold text-[var(--amber-600)]">
                      {bonusData.bonus.personalComponent.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-[var(--border)]">
                    <span className="text-sm font-medium text-foreground">
                      Subtotal
                    </span>
                    <span className="font-bold text-foreground">
                      {bonusData.bonus.totalPercentage.toFixed(2)}%
                    </span>
                  </div>
                  {bonusData.proRata.applies && (
                    <div className="flex items-center justify-between py-2 border-b border-[var(--border)] bg-warning-subtle rounded px-2 -mx-2">
                      <span className="text-sm text-[var(--amber-600)]">
                        Proporcionalidad ({bonusData.proRata.months}/12 meses trabajados = {bonusData.proRata.percentage.toFixed(1)}%)
                      </span>
                      <span className="font-semibold text-[var(--amber-600)]">
                        × {bonusData.proRata.factor.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between py-3 rounded-lg px-3 bg-success-subtle">
                    <span className="font-semibold text-[var(--green-700)]">
                      Bono a pagar
                    </span>
                    <span className="text-xl font-bold text-[var(--green-700)]">
                      {bonusData.bonus.finalPercentage.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-[var(--border)] bg-white p-12 text-center">
              <p className="text-muted-foreground">No se pudo cargar la información del bono</p>
            </div>
          )}
        </div>
      )}

      {/* Seniority History Tab */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {seniorityHistory.length === 0 ? (
            <div className="rounded-xl border border-[var(--border)] bg-white p-12 text-center">
              <svg className="mx-auto h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <p className="mt-4 text-muted-foreground">No hay historial de cambios de seniority</p>
              {member.seniority_level && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Nivel actual: {getSeniorityLabel(member.seniority_level)}
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
              <div className="border-b border-[var(--border)] px-6 py-4">
                <h3 className="text-lg font-semibold text-foreground">Evolución de Seniority</h3>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {seniorityHistory.map((item, index) => {
                  const newCategory = getSeniorityCategory(item.new_level);
                  const newColors = newCategory ? SENIORITY_CATEGORY_COLORS[newCategory] : null;
                  return (
                    <div key={item.id} className="p-4">
                      <div className="flex items-center gap-4">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${newColors?.bg || 'bg-secondary'}`}>
                          <svg className={`h-5 w-5 ${newColors?.text || 'text-muted-foreground'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {item.previous_level && (
                              <>
                                <span className="text-sm text-muted-foreground">{getSeniorityLabel(item.previous_level)}</span>
                                <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                </svg>
                              </>
                            )}
                            <span className={`text-sm font-medium ${newColors?.text || 'text-foreground'}`}>
                              {getSeniorityLabel(item.new_level)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {new Date(item.effective_date + 'T00:00:00').toLocaleDateString('es-AR', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            })}
                          </p>
                          {item.notes && (
                            <p className="mt-1 text-sm text-muted-foreground">{item.notes}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Evaluation Detail Modal */}
      <Dialog
        open={showEvaluationModal && !!selectedEvaluation}
        onClose={closeEvaluationModal}
        title={selectedEvaluation ? (selectedEvaluation.type === 'leader' ? 'Evaluación del líder' : 'Autoevaluación') : ''}
        description={selectedEvaluation ? `${selectedEvaluation.period?.name ?? ''} - ${member.first_name} ${member.last_name}` : undefined}
        size="2xl"
      >
        {selectedEvaluation && (
          <>
            {selectedEvaluation.total_score !== null && (
              <div className="mb-4 flex items-center justify-between rounded-lg bg-muted px-4 py-3">
                <span className="text-sm text-muted-foreground">Puntaje total</span>
                <p className={`text-2xl font-bold ${
                  selectedEvaluation.total_score >= 8 ? 'text-[var(--green-700)]' :
                  selectedEvaluation.total_score >= 4 ? 'text-[var(--amber-600)]' :
                  'text-[var(--red-600)]'
                }`}>
                  {selectedEvaluation.total_score.toFixed(1)}<span className="text-sm text-muted-foreground">/10</span>
                </p>
              </div>
            )}
            <div>
                {loadingDetail ? (
                  <div className="flex items-center justify-center py-12">
                    <Spinner className="h-8 w-8 text-muted-foreground" />
                  </div>
                ) : evaluationDetail ? (
                  <div className="space-y-8">
                    {/* Dimensions and Scores */}
                    <div>
                      <h3 className="text-base font-semibold text-foreground mb-4">Puntajes por dimensión</h3>
                      <div className="space-y-6">
                        {evaluationDetail.dimensions.map((dimension) => {
                          const dimensionAvg = getDimensionAverage(dimension.id);
                          return (
                            <div key={dimension.id} className="rounded-lg border border-[var(--border)] bg-muted overflow-hidden">
                              <div className="flex items-center justify-between bg-white px-4 py-3 border-b border-[var(--border)]">
                                <div>
                                  <h4 className="font-medium text-foreground">{dimension.name}</h4>
                                  {dimension.description && (
                                    <p className="text-xs text-muted-foreground mt-0.5">{dimension.description}</p>
                                  )}
                                </div>
                                {dimensionAvg !== null && (
                                  <span className={`text-lg font-bold ${
                                    dimensionAvg >= 8 ? 'text-[var(--green-700)]' :
                                    dimensionAvg >= 6 ? 'text-[var(--amber-600)]' :
                                    dimensionAvg >= 4 ? 'text-[var(--amber-600)]' :
                                    'text-[var(--red-600)]'
                                  }`}>
                                    {dimensionAvg.toFixed(1)}
                                  </span>
                                )}
                              </div>
                              <div className="divide-y divide-[var(--border)]">
                                {dimension.items.map((item) => {
                                  const response = evaluationDetail.responses.find(r => r.item_id === item.id);
                                  return (
                                    <div key={item.id} className="px-4 py-3 bg-white">
                                      <div className="flex items-start justify-between gap-4">
                                        <p className="text-sm text-secondary-foreground flex-1">{item.statement}</p>
                                        <span className={`font-semibold min-w-[2rem] text-right ${
                                          (response?.score || 0) >= 8 ? 'text-[var(--green-700)]' :
                                          (response?.score || 0) >= 6 ? 'text-[var(--amber-600)]' :
                                          (response?.score || 0) >= 4 ? 'text-[var(--amber-600)]' :
                                          'text-[var(--red-600)]'
                                        }`}>
                                          {response?.score || '-'}
                                        </span>
                                      </div>
                                      {response?.explanation && (
                                        <div className="mt-2 rounded-md bg-muted px-3 py-2">
                                          <p className="text-xs text-muted-foreground font-medium mb-1">Comentario:</p>
                                          <p className="text-sm text-muted-foreground">{response.explanation}</p>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Open Questions */}
                    {evaluationDetail.openQuestions.length > 0 && (
                      <div>
                        <h3 className="text-base font-semibold text-foreground mb-4">Preguntas abiertas</h3>
                        <div className="space-y-4">
                          {evaluationDetail.openQuestions.map((oq) => {
                            const labels = OPEN_QUESTION_LABELS[oq.question_key];
                            const label = labels 
                              ? (selectedEvaluation.type === 'leader' ? labels.leader : labels.self)
                              : oq.question_key;
                            return (
                              <div key={oq.id} className="rounded-lg border border-[var(--border)] bg-white p-4">
                                <p className="text-sm font-medium text-secondary-foreground mb-2">{label}</p>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                  {oq.response || <span className="text-muted-foreground italic">Sin respuesta</span>}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Objectives (for leader evaluations) */}
                    {selectedEvaluation.type === 'leader' && evaluationDetail.objectives && evaluationDetail.objectives.length > 0 && (
                      <div>
                        <h3 className="text-base font-semibold text-foreground mb-4">Objetivos trimestrales</h3>
                        <div className="grid grid-cols-2 gap-4">
                          {evaluationDetail.objectives.map((obj: any) => (
                            <div key={obj.id} className="rounded-lg border border-[var(--border)] bg-white p-4">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-secondary-foreground">Q{obj.quarter}</span>
                                {obj.completion_percentage !== null && (
                                  <span className={`text-sm font-semibold ${
                                    obj.completion_percentage >= 80 ? 'text-[var(--green-700)]' :
                                    obj.completion_percentage >= 50 ? 'text-[var(--amber-600)]' :
                                    'text-[var(--red-600)]'
                                  }`}>
                                    {obj.completion_percentage}%
                                  </span>
                                )}
                              </div>
                              {obj.objectives_description && (
                                <p className="text-sm text-muted-foreground">{obj.objectives_description}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Self-evaluation comparison (for leader evaluations) */}
                    {selectedEvaluation.type === 'leader' && evaluationDetail.selfEvaluationSummary && (
                      <div>
                        <h3 className="text-base font-semibold text-foreground mb-4">Comparación con autoevaluación</h3>
                        <div className="rounded-lg border border-[var(--border)] bg-white p-4">
                          <div className="flex items-center justify-around">
                            <div className="text-center">
                              <p className="text-sm text-muted-foreground mb-1">Autoevaluación</p>
                              <p className="text-2xl font-bold text-[var(--amber-600)]">
                                {evaluationDetail.selfEvaluationSummary.total_score?.toFixed(1) || '-'}
                              </p>
                            </div>
                            <div className="text-center">
                              <p className="text-sm text-muted-foreground mb-1">Evaluación del líder</p>
                              <p className="text-2xl font-bold text-foreground">
                                {selectedEvaluation.total_score?.toFixed(1) || '-'}
                              </p>
                            </div>
                            {evaluationDetail.selfEvaluationSummary.total_score && selectedEvaluation.total_score && (
                              <div className="text-center">
                                <p className="text-sm text-muted-foreground mb-1">Gap</p>
                                <p className={`text-2xl font-bold ${
                                  Math.abs(selectedEvaluation.total_score - evaluationDetail.selfEvaluationSummary.total_score) <= 1 
                                    ? 'text-[var(--green-700)]' 
                                    : 'text-[var(--amber-600)]'
                                }`}>
                                  {(selectedEvaluation.total_score - evaluationDetail.selfEvaluationSummary.total_score).toFixed(1)}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground">No se pudo cargar el detalle de la evaluación</p>
                )}
            </div>
          </>
        )}
      </Dialog>
    </div>
  );
}
