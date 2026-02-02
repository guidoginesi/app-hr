'use client';

import { useState, useRef } from 'react';
import type { LegalEntity, Department, EmployeeStatus } from '@/types/employee';
import { getSupabaseBrowser } from '@/lib/supabaseClient';
import { SENIORITY_LEVELS, SENIORITY_CATEGORY_LABELS, getSeniorityCategory, SeniorityCategory } from '@/types/corporate-objectives';

type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed' | 'other';
type EducationLevel = 'primary' | 'secondary' | 'tertiary' | 'university' | 'postgraduate';

type EmployeeWithRelations = {
  id: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  personal_email: string;
  work_email: string | null;
  nationality: string | null;
  birth_date: string | null;
  phone: string | null;
  marital_status: MaritalStatus | null;
  photo_url: string | null;
  cuil: string | null;
  dni: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
  education_level: EducationLevel | null;
  education_title: string | null;
  languages: string | null;
  emergency_contact_relationship: string | null;
  emergency_contact_first_name: string | null;
  emergency_contact_last_name: string | null;
  emergency_contact_address: string | null;
  emergency_contact_phone: string | null;
  legal_entity_id: string | null;
  department_id: string | null;
  manager_id: string | null;
  job_title: string | null;
  seniority_level: string | null;
  application_id: string | null;
  status: EmployeeStatus;
  hire_date: string | null;
  termination_date: string | null;
  employment_type: string | null;
  created_at: string;
  updated_at: string;
  legal_entity: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  manager: { id: string; first_name: string; last_name: string } | null;
};

type DepartmentWithEntity = Department & {
  legal_entity: { id: string; name: string } | null;
};

type ManagerOption = {
  id: string;
  first_name: string;
  last_name: string;
};

type EmployeeFormModalProps = {
  employee: EmployeeWithRelations | null;
  legalEntities: LegalEntity[];
  departments: DepartmentWithEntity[];
  managers: ManagerOption[];
  onClose: () => void;
  onSave: (employee: EmployeeWithRelations) => void;
};

export function EmployeeFormModal({
  employee,
  legalEntities,
  departments,
  managers,
  onClose,
  onSave,
}: EmployeeFormModalProps) {
  const isEditing = !!employee;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    first_name: employee?.first_name || '',
    last_name: employee?.last_name || '',
    personal_email: employee?.personal_email || '',
    work_email: employee?.work_email || '',
    nationality: employee?.nationality || '',
    birth_date: employee?.birth_date || '',
    phone: employee?.phone || '',
    marital_status: employee?.marital_status || '',
    photo_url: employee?.photo_url || '',
    cuil: employee?.cuil || '',
    dni: employee?.dni || '',
    address: employee?.address || '',
    city: employee?.city || '',
    postal_code: employee?.postal_code || '',
    country: employee?.country || '',
    education_level: employee?.education_level || '',
    education_title: employee?.education_title || '',
    languages: employee?.languages || '',
    emergency_contact_relationship: employee?.emergency_contact_relationship || '',
    emergency_contact_first_name: employee?.emergency_contact_first_name || '',
    emergency_contact_last_name: employee?.emergency_contact_last_name || '',
    emergency_contact_address: employee?.emergency_contact_address || '',
    emergency_contact_phone: employee?.emergency_contact_phone || '',
    legal_entity_id: employee?.legal_entity_id || '',
    department_id: employee?.department_id || '',
    manager_id: employee?.manager_id || '',
    job_title: employee?.job_title || '',
    seniority_level: employee?.seniority_level || '',
    status: employee?.status || 'active',
    hire_date: employee?.hire_date || '',
    employment_type: employee?.employment_type || '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter departments based on selected legal entity
  const filteredDepartments = formData.legal_entity_id
    ? departments.filter(
        (d) => !d.legal_entity_id || d.legal_entity_id === formData.legal_entity_id
      )
    : departments;

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Reset department if legal entity changes and current department doesn't match
    if (name === 'legal_entity_id' && formData.department_id) {
      const currentDept = departments.find((d) => d.id === formData.department_id);
      if (currentDept?.legal_entity_id && currentDept.legal_entity_id !== value) {
        setFormData((prev) => ({ ...prev, department_id: '' }));
      }
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Por favor selecciona una imagen válida');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen debe ser menor a 5MB');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const supabase = getSupabaseBrowser();
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `employee-photos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('employee-photos')
        .upload(filePath, file);

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data: { publicUrl } } = supabase.storage
        .from('employee-photos')
        .getPublicUrl(filePath);

      setFormData((prev) => ({ ...prev, photo_url: publicUrl }));
    } catch (err: any) {
      setError(`Error al subir la foto: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemovePhoto = () => {
    setFormData((prev) => ({ ...prev, photo_url: '' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Helper to validate UUID format
  const isValidUuid = (val: string | null | undefined): boolean => {
    if (!val) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const url = isEditing
        ? `/api/admin/employees/${employee.id}`
        : '/api/admin/employees';
      const method = isEditing ? 'PUT' : 'POST';

      // Clean UUID fields - only send if valid UUID, otherwise null
      const cleanUuid = (val: string) => isValidUuid(val) ? val : null;

      const payload = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        personal_email: formData.personal_email,
        work_email: formData.work_email || null,
        nationality: formData.nationality || null,
        birth_date: formData.birth_date || null,
        phone: formData.phone || null,
        marital_status: formData.marital_status || null,
        photo_url: formData.photo_url || null,
        cuil: formData.cuil || null,
        dni: formData.dni || null,
        address: formData.address || null,
        city: formData.city || null,
        postal_code: formData.postal_code || null,
        country: formData.country || null,
        education_level: formData.education_level || null,
        education_title: formData.education_title || null,
        languages: formData.languages || null,
        emergency_contact_relationship: formData.emergency_contact_relationship || null,
        emergency_contact_first_name: formData.emergency_contact_first_name || null,
        emergency_contact_last_name: formData.emergency_contact_last_name || null,
        emergency_contact_address: formData.emergency_contact_address || null,
        emergency_contact_phone: formData.emergency_contact_phone || null,
        legal_entity_id: cleanUuid(formData.legal_entity_id),
        department_id: cleanUuid(formData.department_id),
        manager_id: cleanUuid(formData.manager_id),
        job_title: formData.job_title || null,
        seniority_level: formData.seniority_level || null,
        status: formData.status,
        hire_date: formData.hire_date || null,
        employment_type: formData.employment_type || null,
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al guardar el empleado');
      }

      const savedEmployee = await response.json();
      onSave(savedEmployee);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />

        <div className="relative w-full max-w-3xl rounded-xl bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
            <h2 className="text-xl font-semibold text-zinc-900">
              {isEditing ? 'Editar empleado' : 'Nuevo empleado'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {error && (
                <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">{error}</div>
              )}

              {/* Photo Upload */}
              <div className="flex items-start gap-6">
                <div className="flex-shrink-0">
                  <div className="relative">
                    {formData.photo_url ? (
                      <img
                        src={formData.photo_url}
                        alt="Foto del empleado"
                        className="h-24 w-24 rounded-full object-cover border-2 border-zinc-200"
                      />
                    ) : (
                      <div className="h-24 w-24 rounded-full bg-zinc-100 flex items-center justify-center border-2 border-dashed border-zinc-300">
                        <svg className="h-8 w-8 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    )}
                    {isUploading && (
                      <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                        <svg className="h-6 w-6 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-zinc-900 mb-2">Foto del empleado</label>
                  <div className="flex items-center gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                    >
                      {formData.photo_url ? 'Cambiar foto' : 'Subir foto'}
                    </button>
                    {formData.photo_url && (
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">JPG, PNG o GIF. Máximo 5MB.</p>
                </div>
              </div>

              {/* Personal Information */}
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 mb-3">Información Personal</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Nombre *</label>
                    <input
                      type="text"
                      name="first_name"
                      value={formData.first_name}
                      onChange={handleInputChange}
                      required
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Apellido *</label>
                    <input
                      type="text"
                      name="last_name"
                      value={formData.last_name}
                      onChange={handleInputChange}
                      required
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">DNI</label>
                    <input
                      type="text"
                      name="dni"
                      value={formData.dni}
                      onChange={handleInputChange}
                      placeholder="12345678"
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">CUIL</label>
                    <input
                      type="text"
                      name="cuil"
                      value={formData.cuil}
                      onChange={handleInputChange}
                      placeholder="20-12345678-9"
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Fecha de nacimiento</label>
                    <input
                      type="date"
                      name="birth_date"
                      value={formData.birth_date}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Nacionalidad</label>
                    <input
                      type="text"
                      name="nationality"
                      value={formData.nationality}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Estado civil</label>
                    <select
                      name="marital_status"
                      value={formData.marital_status}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    >
                      <option value="">Seleccionar...</option>
                      <option value="single">Soltero/a</option>
                      <option value="married">Casado/a</option>
                      <option value="divorced">Divorciado/a</option>
                      <option value="widowed">Viudo/a</option>
                      <option value="other">Otro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Teléfono</label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="+54 11 1234-5678"
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Email personal *</label>
                    <input
                      type="email"
                      name="personal_email"
                      value={formData.personal_email}
                      onChange={handleInputChange}
                      required
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Email de trabajo</label>
                    <input
                      type="email"
                      name="work_email"
                      value={formData.work_email}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </div>
                </div>
              </div>

              {/* Address */}
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 mb-3">Domicilio</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Dirección</label>
                    <input
                      type="text"
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Ciudad</label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Código Postal</label>
                    <input
                      type="text"
                      name="postal_code"
                      value={formData.postal_code}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">País</label>
                    <input
                      type="text"
                      name="country"
                      value={formData.country}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </div>
                </div>
              </div>

              {/* Education */}
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 mb-3">Formación Académica</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Nivel académico</label>
                    <select
                      name="education_level"
                      value={formData.education_level}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    >
                      <option value="">Seleccionar...</option>
                      <option value="primary">Primario</option>
                      <option value="secondary">Secundario</option>
                      <option value="tertiary">Terciario</option>
                      <option value="university">Universitario</option>
                      <option value="postgraduate">Posgrado</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Título</label>
                    <input
                      type="text"
                      name="education_title"
                      value={formData.education_title}
                      onChange={handleInputChange}
                      placeholder="Ej: Licenciatura en Administración"
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Idiomas</label>
                    <input
                      type="text"
                      name="languages"
                      value={formData.languages}
                      onChange={handleInputChange}
                      placeholder="Ej: Español (nativo), Inglés (avanzado), Portugués (intermedio)"
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 mb-3">Contacto de Emergencia</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Parentesco</label>
                    <select
                      name="emergency_contact_relationship"
                      value={formData.emergency_contact_relationship}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    >
                      <option value="">Seleccionar...</option>
                      <option value="spouse">Cónyuge</option>
                      <option value="parent">Padre/Madre</option>
                      <option value="sibling">Hermano/a</option>
                      <option value="child">Hijo/a</option>
                      <option value="friend">Amigo/a</option>
                      <option value="other">Otro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Teléfono</label>
                    <input
                      type="tel"
                      name="emergency_contact_phone"
                      value={formData.emergency_contact_phone}
                      onChange={handleInputChange}
                      placeholder="+54 11 1234-5678"
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Nombre</label>
                    <input
                      type="text"
                      name="emergency_contact_first_name"
                      value={formData.emergency_contact_first_name}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Apellido</label>
                    <input
                      type="text"
                      name="emergency_contact_last_name"
                      value={formData.emergency_contact_last_name}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Domicilio</label>
                    <input
                      type="text"
                      name="emergency_contact_address"
                      value={formData.emergency_contact_address}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </div>
                </div>
              </div>

              {/* Work Information */}
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 mb-3">Información Laboral</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Fecha de ingreso</label>
                    <input
                      type="date"
                      name="hire_date"
                      value={formData.hire_date}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Rol / Puesto</label>
                    <input
                      type="text"
                      name="job_title"
                      value={formData.job_title}
                      onChange={handleInputChange}
                      placeholder="Ej: Desarrollador Senior"
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Nivel de Seniority</label>
                    <select
                      name="seniority_level"
                      value={formData.seniority_level}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    >
                      <option value="">Seleccionar...</option>
                      {([1, 2, 3, 4, 5] as SeniorityCategory[]).map(cat => (
                        <optgroup key={cat} label={SENIORITY_CATEGORY_LABELS[cat]}>
                          {[1, 2, 3, 4].map(sub => {
                            const level = `${cat}.${sub}`;
                            return (
                              <option key={level} value={level}>
                                Lev. {level} - {SENIORITY_CATEGORY_LABELS[cat]}
                              </option>
                            );
                          })}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Condición laboral</label>
                    <select
                      name="employment_type"
                      value={formData.employment_type}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    >
                      <option value="">Seleccionar...</option>
                      <option value="dependency">Relación de dependencia</option>
                      <option value="monotributista">Monotributista</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Sociedad</label>
                    <select
                      name="legal_entity_id"
                      value={formData.legal_entity_id}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    >
                      <option value="">Seleccionar...</option>
                      {legalEntities.map((entity) => (
                        <option key={entity.id} value={entity.id}>
                          {entity.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Departamento</label>
                    <select
                      name="department_id"
                      value={formData.department_id}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    >
                      <option value="">Seleccionar...</option>
                      {filteredDepartments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Manager</label>
                    <select
                      name="manager_id"
                      value={formData.manager_id}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    >
                      <option value="">Seleccionar...</option>
                      {managers.map((mgr) => (
                        <option key={mgr.id} value={mgr.id}>
                          {mgr.first_name} {mgr.last_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Estado</label>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    >
                      <option value="active">Activo</option>
                      <option value="inactive">Inactivo</option>
                      <option value="terminated">Desvinculado</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 border-t border-zinc-200 px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isUploading}
                className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {isSubmitting ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear empleado'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
