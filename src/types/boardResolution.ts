export type BoardResolutionStatus = 'draft' | 'passed' | 'rejected';
export type BoardResolutionPassedBy = 'unanimous' | 'majority' | 'not_voted';

export const BOARD_ACTIONS = [
  'Appointment of Statutory Auditors',
  'Appointment of Internal Auditors',
  'Appointment of Director',
  'Resignation of Director',
  'Opening of Bank Account',
  'Authorization of Signing Authority',
  'Approval of Annual Budget',
  'Approval of Financial Statements',
  'Declaration of Dividend',
  'Change of Registered Office',
  'Allotment of Shares',
  'Issuance of Share Certificate',
  'Approval of Related Party Transaction',
  'Appointment of Company Secretary',
  'Approval of Loan/Borrowing',
  'Authorization for Filing of Returns',
  'Other',
] as const;

export interface BoardResolution {
  id: string;
  resolution_number: string;
  resolution_date: string;
  board_action: string;
  title: string;
  preamble?: string;
  resolution_text: string;
  directors_present: string[];
  directors_absent: string[];
  chairperson?: string;
  company_settings_id?: string;
  status: BoardResolutionStatus;
  passed_by: BoardResolutionPassedBy;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateBoardResolutionData {
  resolution_date: string;
  board_action: string;
  title: string;
  preamble?: string;
  resolution_text: string;
  directors_present: string[];
  directors_absent: string[];
  chairperson?: string;
  company_settings_id?: string;
  status: BoardResolutionStatus;
  passed_by: BoardResolutionPassedBy;
  notes?: string;
}

export interface UpdateBoardResolutionData extends Partial<CreateBoardResolutionData> {}

export interface BoardResolutionFilters {
  status?: BoardResolutionStatus;
  search?: string;
  company_settings_id?: string;
}

export interface BoardResolutionStats {
  total: number;
  draft: number;
  passed: number;
  rejected: number;
}
