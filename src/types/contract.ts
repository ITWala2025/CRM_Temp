/**
 * Contract Management TypeScript Definitions
 * Comprehensive type system for IT service contracts
 */

// =====================================================
// ENUMS & CONSTANTS
// =====================================================

export type ContractType = 
  | 'MSA'              // Master Service Agreement
  | 'SOW'              // Statement of Work
  | 'NDA'              // Non-Disclosure Agreement
  | 'SLA'              // Service Level Agreement
  | 'WORK_ORDER'       // Work Order
  | 'MAINTENANCE'      // Maintenance Contract
  | 'CONSULTING'       // Consulting Agreement
  | 'LICENSE'          // Software License Agreement
  | 'OTHER';

export type ContractStatus = 
  | 'draft' 
  | 'sent'
  | 'accepted'
  | 'rejected'
  | 'active' 
  | 'expired' 
  | 'terminated' 
  | 'renewed';

export type MilestoneStatus = 
  | 'pending' 
  | 'in_progress' 
  | 'completed' 
  | 'delayed';

export type TemplateType = 
  | 'service_agreement' 
  | 'confidentiality' 
  | 'work_order' 
  | 'license' 
  | 'consulting';

// =====================================================
// CONTRACT PARTY INTERFACE
// =====================================================

export interface ContractParty {
  name: string;
  address?: string;
  contact?: string;
  gstin?: string;
  pan?: string;
}

// =====================================================
// CONTRACT TEMPLATE INTERFACES
// =====================================================

export interface ContractTemplate {
  id: string;
  template_name: string;
  contract_type: ContractType;
  contract_title?: string;
  description?: string;
  entity_law?: 'IRL' | 'IND' | 'ALL';
  currency_code?: string;
  preamble?: string;
  is_active: boolean;
  is_custom?: boolean;
  created_at: string;
  updated_at: string;
}

export interface ContractTemplateSection {
  id: string;
  template_id: string;
  section_number: number;
  section_title: string;
  section_content: string;
  is_required: boolean;
  is_editable: boolean;
  is_locked?: boolean;
  page_break_before?: boolean;
  created_at: string;
  updated_at: string;
}

export interface ContractTemplateWithSections extends ContractTemplate {
  sections: ContractTemplateSection[];
}

// =====================================================
// CONTRACT SECTION INTERFACE
// =====================================================

export interface ContractSection {
  id: string;
  contract_id: string;
  section_number: number;
  section_title: string;
  section_content: string;
  is_required: boolean;
  is_locked?: boolean;
  page_break_before: boolean;
  created_at: string;
  updated_at: string;
}

// =====================================================
// CONTRACT MILESTONE INTERFACE (for SOW/Work Orders)
// =====================================================

export interface ContractMilestone {
  id: string;
  contract_id: string;
  milestone_number: number;
  milestone_title: string;
  description?: string;
  deliverables?: string;
  due_date?: string;
  completion_date?: string;
  payment_amount?: number;
  status: MilestoneStatus;
  created_at: string;
  updated_at: string;
}

// =====================================================
// CONTRACT ATTACHMENT INTERFACE
// =====================================================

export interface ContractAttachment {
  id: string;
  contract_id: string;
  file_name: string;
  file_url: string;
  file_type?: string;
  file_size?: number;
  uploaded_at: string;
}

// =====================================================
// CONTRACT AMENDMENT INTERFACE
// =====================================================

export interface ContractAmendment {
  id: string;
  contract_id: string;
  amendment_number: number;
  amendment_date: string;
  amendment_description: string;
  amended_by?: string;
  created_at: string;
}

// =====================================================
// MAIN CONTRACT INTERFACE
// =====================================================

export interface Contract {
  id: string;
  contract_number: string;
  company_settings_id?: string;
  template_id?: string;
  
  // Parties
  party_a_name: string;
  party_a_address?: string;
  party_a_contact?: string;
  party_a_gstin?: string;
  party_a_pan?: string;
  party_a_vat_number?: string;
  party_a_cro_number?: string;
  
  party_b_name: string;
  party_b_address?: string;
  party_b_contact?: string;
  party_b_gstin?: string;
  party_b_pan?: string;
  party_b_vat_number?: string;
  party_b_cro_number?: string;
  
  // Contract Details
  contract_type: ContractType;
  contract_title: string;
  contract_date: string;
  effective_date: string;
  expiry_date?: string;
  preamble?: string;  // Introductory text before sections
  
  // Financial
  contract_value?: number;
  currency_code: string;
  payment_terms?: string;
  
  // Status
  status: ContractStatus;
  signed_by_party_a: boolean;
  signed_by_party_b: boolean;
  signed_date?: string;
  
  // Metadata
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// =====================================================
// EXTENDED CONTRACT WITH RELATIONS
// =====================================================

export interface ContractWithDetails extends Contract {
  sections: ContractSection[];
  milestones?: ContractMilestone[];
  attachments?: ContractAttachment[];
  amendments?: ContractAmendment[];
  template?: ContractTemplate;
}

// =====================================================
// CREATE/UPDATE DATA TYPES (for forms)
// =====================================================

export interface CreateContractData {
  template_id?: string;
  company_settings_id?: string;
  customer_id?: string;
  
  // Parties
  party_a_name: string;
  party_a_address?: string;
  party_a_contact?: string;
  party_a_gstin?: string;
  party_a_pan?: string;
  party_a_vat_number?: string;
  party_a_cro_number?: string;
  
  party_b_name: string;
  party_b_address?: string;
  party_b_contact?: string;
  party_b_gstin?: string;
  party_b_pan?: string;
  party_b_vat_number?: string;
  party_b_cro_number?: string;
  
  // Contract Details
  contract_type: ContractType;
  contract_title: string;
  contract_date: string;
  effective_date: string;
  expiry_date?: string;
  preamble?: string;  // Introductory text before sections
  
  // Financial
  contract_value?: number;
  currency_code?: string;
  payment_terms?: string;
  
  // Initial sections
  sections: CreateContractSectionData[];
  
  // Optional milestones
  milestones?: CreateContractMilestoneData[];
  
  notes?: string;
  
  // Entity prefix for contract number generation (IND / IRL)
  entity_prefix?: string;
}

export interface CreateContractSectionData {
  id?: string; // Temporary ID for editing
  section_number: number;
  section_title: string;
  section_content: string;
  is_required: boolean;
  is_locked?: boolean;     // true = compliance clause, protected from user edits
  page_break_before: boolean;
}

export interface CreateContractMilestoneData {
  id?: string; // Temporary ID for editing
  milestone_number: number;
  milestone_title: string;
  description?: string;
  deliverables?: string;
  due_date?: string;
  payment_amount?: number;
}

export interface UpdateContractData extends Partial<CreateContractData> {
  id: string;
  status?: ContractStatus;
  signed_by_party_a?: boolean;
  signed_by_party_b?: boolean;
  signed_date?: string;
}

// =====================================================
// FILTERS & PAGINATION
// =====================================================

export interface ContractFilters {
  search?: string;
  contract_type?: ContractType;
  status?: ContractStatus;
  party_b_name?: string;
  date_from?: string;
  date_to?: string;
  company_settings_id?: string;
}

export interface ContractSortOptions {
  field: 'contract_date' | 'contract_number' | 'party_b_name' | 'contract_value' | 'status';
  direction: 'asc' | 'desc';
}

// =====================================================
// PDF GENERATION OPTIONS
// =====================================================

export interface ContractPDFOptions {
  includePageNumbers: boolean;
  includeTableOfContents: boolean;
  includeSignatureBlocks: boolean;
  includeMilestones: boolean;
  includeParties?: boolean;
  watermark?: string; // "DRAFT", "CONFIDENTIAL", etc.
  headerText?: string;
  footerText?: string;
}

// =====================================================
// STATISTICS & DASHBOARD
// =====================================================

export interface ContractStatistics {
  total_contracts: number;
  active_contracts: number;
  draft_contracts: number;
  expired_contracts: number;
  expiring_soon: number; // Within 30 days
  total_contract_value: number;
  active_contract_value: number;
  contracts_by_type: Record<ContractType, number>;
}

// =====================================================
// AUDIT TRAIL
// =====================================================

export interface ContractAuditLog {
  id: string;
  contract_id: string;
  user_id?: string;
  user_email?: string;
  action: 'create' | 'edit' | 'status_change' | 'section_edit' | 'delete';
  field_name?: string;
  old_value?: string;
  new_value?: string;
  changed_at: string;
}

// =====================================================
// FORM VALIDATION
// =====================================================

export interface ContractValidationErrors {
  party_a_name?: string;
  party_b_name?: string;
  contract_type?: string;
  contract_title?: string;
  contract_date?: string;
  effective_date?: string;
  sections?: string;
  [key: string]: string | undefined;
}

// =====================================================
// EXPORT
// =====================================================
// Note: All types are already exported with 'export type' declarations above
