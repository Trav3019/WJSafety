export type UserRole = 'admin' | 'safety_officer' | 'worker'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export interface Profile {
  id: string
  full_name: string
  role: UserRole
  status: ApprovalStatus
  created_at: string
}

export interface Category {
  id: string
  name: string
  sort_order: number
}

export interface SafetyDocument {
  id: string
  category_id: string
  title: string
  description: string | null
  storage_path: string
  file_type: string | null
  file_size_bytes: number | null
  uploaded_by: string | null
  created_at: string
}

export type FieldType = 'text' | 'textarea' | 'checkbox' | 'date' | 'select'

export interface FormField {
  id: string
  label: string
  type: FieldType
  required: boolean
  options?: string[]
}

export interface FormTemplate {
  id: string
  title: string
  description: string | null
  fields: FormField[]
  requires_signature: boolean
  created_by: string | null
  created_at: string
}

export type AssignmentStatus = 'assigned' | 'submitted'

export interface FormAssignment {
  id: string
  form_id: string
  assigned_to: string
  assigned_by: string | null
  status: AssignmentStatus
  due_date: string | null
  created_at: string
  form_templates?: FormTemplate
  profiles?: Profile
}

export interface FormSubmission {
  id: string
  assignment_id: string | null
  form_id: string
  submitted_by: string
  answers: Record<string, string | boolean>
  signature_data_url: string | null
  signed_at: string | null
  submitted_at: string
}

export interface NewsPost {
  id: string
  title: string | null
  body: string
  posted_by: string | null
  pinned: boolean
  image_path: string | null
  created_at: string
  profiles?: { full_name: string } | null
}
