// ====================================================================
// ITSM (IT Support Management & Service Desk) Domain Types
// Supports Triage Desk, Dual Mon-Fri 09:00-18:00 SLA Stopwatches & CSAT
// ====================================================================

import type { Customer, CompanySettings } from './invoice';
import type { CustomerContact } from './customerContact';
import type { Contract } from './contract';
import type { CustomerSubscription } from './subscription';
import type { Policy } from './policy';

export type TicketType = 'incident' | 'service_request' | 'problem';
export type TicketPriority = 'P1_critical' | 'P2_high' | 'P3_medium' | 'P4_low';
export type TicketStatus = 'new' | 'assigned' | 'in_progress' | 'pending_customer' | 'resolved' | 'closed' | 'canceled';
export type AttachmentScanStatus = 'pending' | 'clean' | 'quarantined';

export interface ITSMTicketCategory {
  id: string;
  company_settings_id?: string | null;
  name: string;
  code: string;
  description?: string | null;
  parent_id?: string | null;
  default_priority: TicketPriority;
  sla_response_hours_p1: number;
  sla_resolution_hours_p1: number;
  sla_response_hours_p2: number;
  sla_resolution_hours_p2: number;
  sla_response_hours_p3: number;
  sla_resolution_hours_p3: number;
  sla_response_hours_p4: number;
  sla_resolution_hours_p4: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ITSMAttachment {
  id: string;
  ticket_id: string;
  comment_id?: string | null;
  file_name: string;
  storage_path: string;
  file_size: number;
  mime_type: string;
  scan_status: AttachmentScanStatus;
  uploaded_by?: string | null;
  uploader_name?: string;
  created_at: string;
  public_url?: string;
}

export interface ITSMComment {
  id: string;
  ticket_id: string;
  author_id: string;
  author_name?: string;
  author_email?: string;
  author_role?: string;
  is_internal: boolean; // true = private agent note; false = public comment
  content: string;
  mentions?: string[]; // Array of agent IDs or names
  created_at: string;
  updated_at?: string;
  attachments?: ITSMAttachment[];
}

export interface ITSMAuditLog {
  id: string;
  ticket_id: string;
  actor_id?: string | null;
  actor_name?: string;
  action: string;
  changes_json: Record<string, any>;
  created_at: string;
}

export interface ITSMCsatQuestion {
  id: string;
  question_text: string;
  description?: string;
}

export interface ITSMCsatQuestionResponse {
  question_id: string;
  question_text: string;
  rating: number; // 1 to 5 stars
  comment?: string;
}

export const DEFAULT_CSAT_QUESTIONS: ITSMCsatQuestion[] = [
  {
    id: 'q1_overall',
    question_text: '1. Overall Support Experience',
    description: 'How satisfied are you with the overall resolution provided for this support ticket?',
  },
  {
    id: 'q2_response_time',
    question_text: '2. Initial Response Speed & SLA',
    description: 'How satisfied are you with our initial response time and turnaround speed?',
  },
  {
    id: 'q3_agent_support',
    question_text: '3. Agent Expertise & Communication',
    description: 'How clear, helpful, professional, and knowledgeable was the support agent?',
  },
  {
    id: 'q4_tech_quality',
    question_text: '4. Resolution Quality & Effectiveness',
    description: 'How effectively did our fix or solution resolve your underlying technical problem?',
  },
  {
    id: 'q5_portal_experience',
    question_text: '5. Customer Support Portal & Ease of Use',
    description: 'How easy and convenient was it to submit, track, and manage your request in our portal?',
  },
];

export interface ITSMCsatSurvey {
  id: string;
  ticket_id: string;
  customer_id: string;
  contact_id?: string | null;
  rating: number; // 1 to 5 overall average rating
  feedback_text?: string | null;
  responses?: ITSMCsatQuestionResponse[];
  submitted_at: string;
}

export interface ITSMTicket {
  id: string;
  ticket_number: string; // e.g. INC-20260903-0001
  ticket_type: TicketType;
  company_settings_id?: string | null;
  customer_id: string;
  contact_id?: string | null;
  contract_id?: string | null;
  subscription_id?: string | null;
  product_id?: string | null;
  category_id?: string | null;
  title: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  assigned_agent_id?: string | null;
  assigned_group?: string | null;
  
  // Dual SLA Stopwatches (Mon-Fri 09:00 - 18:00 Business Hours)
  sla_target_response_at?: string | null;   // TTO Deadline
  sla_target_resolution_at?: string | null; // TTR Deadline
  tto_elapsed_business_minutes?: number;
  ttr_elapsed_business_minutes?: number;
  is_sla_paused?: boolean;
  
  first_responded_at?: string | null;
  resolved_at?: string | null;
  closed_at?: string | null;
  canceled_at?: string | null;
  cancellation_reason?: string | null;
  resolution_notes?: string | null;
  linked_kb_policy_id?: string | null;
  reopen_count?: number;
  is_escalated?: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;

  // Joined Relational Data
  customer?: Customer | null;
  contact?: CustomerContact | null;
  contract?: Contract | null;
  subscription?: CustomerSubscription | null;
  category?: ITSMTicketCategory | null;
  company_settings?: CompanySettings | null;
  assigned_agent?: {
    id: string;
    email: string;
    full_name?: string;
  } | null;
  linked_kb_policy?: Policy | null;
  csat_survey?: ITSMCsatSurvey | null;
  comments?: ITSMComment[];
  attachments?: ITSMAttachment[];
  audit_logs?: ITSMAuditLog[];
}

export interface TicketFormData {
  ticket_type: TicketType;
  company_settings_id?: string | null;
  customer_id: string;
  contact_id?: string | null;
  contract_id?: string | null;
  subscription_id?: string | null;
  product_id?: string | null;
  category_id?: string | null;
  title: string;
  description: string;
  priority: TicketPriority;
  impact?: 'organization' | 'team' | 'user';
  urgency?: 'stopped' | 'degraded' | 'inquiry';
  initial_attachments?: File[];
}

export interface TicketFilters {
  searchQuery?: string;
  status?: TicketStatus | 'all' | 'open' | 'breached';
  priority?: TicketPriority | 'all';
  category_id?: string | 'all';
  assigned_agent_id?: string | 'all' | 'unassigned' | 'my_assigned';
  customer_id?: string | 'all';
  company_settings_id?: string | null | 'all';
  ticket_type?: TicketType | 'all';
  contract_id?: string | 'all';
  is_escalated?: boolean;
}

export interface BulkActionData {
  ticket_ids: string[];
  action: 'assign_agent' | 'reassign_category' | 'override_priority' | 'transition_status';
  assigned_agent_id?: string;
  assigned_group?: string;
  category_id?: string;
  priority?: TicketPriority;
  status?: TicketStatus;
  reason?: string;
}

export interface TriageDeskMetrics {
  total_open: number;
  unassigned_count: number;
  sla_breached_count: number;
  sla_warning_count: number;
  avg_csat: number;
  csat_total_surveys: number;
}

export interface SlaStopwatchStatus {
  ttoRemainingMinutes: number;
  ttrRemainingMinutes: number;
  ttoBadgeColor: 'green' | 'yellow' | 'red' | 'paused' | 'completed';
  ttrBadgeColor: 'green' | 'yellow' | 'red' | 'paused' | 'completed';
  ttoLabel: string;
  ttrLabel: string;
  isPaused: boolean;
}

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  P1_critical: 'P1 - Critical',
  P2_high: 'P2 - High',
  P3_medium: 'P3 - Medium',
  P4_low: 'P4 - Low',
};

export const TICKET_PRIORITY_BADGES: Record<TicketPriority, string> = {
  P1_critical: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-300 dark:border-red-700 animate-pulse font-bold',
  P2_high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 border-orange-300 dark:border-orange-700 font-semibold',
  P3_medium: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-300 dark:border-blue-700',
  P4_low: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600',
};

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  new: 'New / Unassigned',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  pending_customer: 'Pending Customer',
  resolved: 'Resolved',
  closed: 'Closed',
  canceled: 'Canceled',
};

export const TICKET_STATUS_BADGES: Record<TicketStatus, string> = {
  new: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-300 dark:border-purple-700 font-bold',
  assigned: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-300 dark:border-blue-700',
  pending_customer: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300 dark:border-amber-700',
  resolved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700',
  closed: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 border-gray-300 dark:border-gray-700',
  canceled: 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400 border-red-200 dark:border-red-800',
};
