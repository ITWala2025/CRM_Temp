/**
 * HR Policy & SOP Management Types
 */

export type PolicyCategory = 'policy' | 'sop';

export type PolicyJurisdiction = 'IN' | 'IE' | 'US' | 'GB' | 'AE' | 'SG' | 'GLOBAL';

export type PolicyStatus = 'draft' | 'published' | 'archived';

export interface PolicySection {
  id?: string;
  section_number: string;
  title: string;
  content: string;
}

export interface Policy {
  id: string;
  company_settings_id: string | null;
  policy_code: string;
  title: string;
  category: PolicyCategory;
  policy_type: string;
  jurisdiction: PolicyJurisdiction;
  jurisdiction_name: string;
  version: string;
  status: PolicyStatus;
  effective_date: string;
  review_date?: string;
  target_audience: string;
  enforcement_level: string; // 'Mandatory' | 'Advisory' | 'Informational'
  summary?: string;
  sections: PolicySection[];
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
  // Joined relation option
  company_settings?: {
    id: string;
    company_name: string;
    logo_url?: string;
    header_image_data?: string;
    footer_image_data?: string;
    logo_image_data?: string;
  };
}

export interface PolicyFormData {
  company_settings_id: string | null;
  policy_code: string;
  title: string;
  category: PolicyCategory;
  policy_type: string;
  jurisdiction: PolicyJurisdiction;
  jurisdiction_name: string;
  version: string;
  status: PolicyStatus;
  effective_date: string;
  review_date?: string;
  target_audience: string;
  enforcement_level: string;
  summary: string;
  sections: PolicySection[];
}

export interface PolicyFilters {
  category?: PolicyCategory | 'all';
  jurisdiction?: PolicyJurisdiction | 'all';
  status?: PolicyStatus | 'all';
  searchQuery?: string;
  company_settings_id?: string | null;
}

export interface PolicyTemplate {
  id: string;
  title: string;
  category: PolicyCategory;
  policy_type: string;
  jurisdiction: PolicyJurisdiction;
  jurisdiction_name: string;
  suggested_code: string;
  target_audience: string;
  enforcement_level: string;
  summary: string;
  sections: PolicySection[];
}

export const JURISDICTION_OPTIONS: { value: PolicyJurisdiction; label: string; flag: string; countryCode: string }[] = [
  { value: 'IN', label: 'India', flag: '🇮🇳', countryCode: 'IND' },
  { value: 'IE', label: 'Ireland', flag: '🇮🇪', countryCode: 'IRL' },
  { value: 'US', label: 'United States', flag: '🇺🇸', countryCode: 'USA' },
  { value: 'GB', label: 'United Kingdom', flag: '🇬🇧', countryCode: 'GBR' },
  { value: 'AE', label: 'United Arab Emirates', flag: '🇦🇪', countryCode: 'ARE' },
  { value: 'SG', label: 'Singapore', flag: '🇸🇬', countryCode: 'SGP' },
  { value: 'GLOBAL', label: 'Global / EU Standard', flag: '🌐', countryCode: 'GLOBAL' },
];

export const CATEGORY_LABELS: Record<PolicyCategory, string> = {
  policy: 'Policy',
  sop: 'Standard Operating Procedure (SOP)',
};

export const ENFORCEMENT_LEVELS = [
  'Mandatory',
  'Advisory',
  'Informational',
  'Strict Compliance',
];

export const TARGET_AUDIENCE_OPTIONS = [
  'All Employees',
  'Full-Time Employees',
  'Part-Time & Contract Employees',
  'Managers & Team Leads',
  'Executive & Board Members',
  'IT & Security Personnel',
  'HR & Operations Staff',
];
