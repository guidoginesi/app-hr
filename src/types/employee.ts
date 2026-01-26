// Employee module types

export type UserRole = 'admin' | 'employee' | 'leader';

export type EmployeeStatus = 'active' | 'inactive' | 'terminated';

export interface LegalEntity {
  id: string;
  name: string;
  country: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  name: string;
  legal_entity_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  legal_entity_name?: string;
}

export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed' | 'other';
export type EducationLevel = 'primary' | 'secondary' | 'tertiary' | 'university' | 'postgraduate';

export interface Employee {
  id: string;
  user_id: string | null;
  
  // Personal details
  first_name: string;
  last_name: string;
  personal_email: string;
  work_email: string | null;
  nationality: string | null;
  birth_date: string | null;
  phone: string | null;
  marital_status: MaritalStatus | null;
  photo_url: string | null;
  
  // Identity documents
  cuil: string | null;
  dni: string | null;
  
  // Address
  address: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
  
  // Education
  education_level: EducationLevel | null;
  education_title: string | null;
  languages: string | null;
  
  // Emergency contact
  emergency_contact_relationship: string | null;
  emergency_contact_first_name: string | null;
  emergency_contact_last_name: string | null;
  emergency_contact_address: string | null;
  emergency_contact_phone: string | null;
  
  // Organization
  legal_entity_id: string | null;
  department_id: string | null;
  manager_id: string | null;
  job_title: string | null;
  seniority_level: string | null; // Format: "1.1" to "5.4" (Jr, Ssr, Sr, Líder, C-Level)
  
  // From recruiting
  application_id: string | null;
  
  // Employment info
  status: EmployeeStatus;
  hire_date: string | null;
  termination_date: string | null;
  
  // Time-off related
  is_studying: boolean;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface EmployeeWithDetails extends Employee {
  legal_entity_name: string | null;
  department_name: string | null;
  manager_name: string | null;
  manager_employee_id: string | null;
}

export interface EmployeeFormData {
  first_name: string;
  last_name: string;
  personal_email: string;
  work_email?: string;
  nationality?: string;
  birth_date?: string;
  phone?: string;
  marital_status?: MaritalStatus;
  photo_url?: string;
  cuil?: string;
  dni?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  education_level?: EducationLevel;
  education_title?: string;
  languages?: string;
  emergency_contact_relationship?: string;
  emergency_contact_first_name?: string;
  emergency_contact_last_name?: string;
  emergency_contact_address?: string;
  emergency_contact_phone?: string;
  legal_entity_id?: string;
  department_id?: string;
  manager_id?: string;
  job_title?: string;
  seniority_level?: string;
  status: EmployeeStatus;
  hire_date?: string;
  is_studying?: boolean;
}

export interface CreateEmployeeFromCandidateData {
  application_id: string;
  candidate_id: string;
  legal_entity_id?: string;
  department_id?: string;
  manager_id?: string;
  hire_date?: string;
  work_email?: string;
}

// User role management
export interface UserRoleRecord {
  id: string;
  user_id: string;
  role: UserRole;
  created_at: string;
}

export interface AuthResult {
  user: {
    id: string;
    email?: string;
  } | null;
  roles: UserRole[];
  isAdmin: boolean;
  isEmployee: boolean;
  isLeader: boolean;
  employee: Employee | null;
}
