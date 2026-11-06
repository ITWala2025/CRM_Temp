// Announcement Types

export type AnnouncementPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TargetAudience = 'all' | 'specific';

export interface Announcement {
  id: string;
  title: string;
  message: string;
  priority: AnnouncementPriority;
  target_audience: TargetAudience;
  target_employee_ids?: string[];
  start_date: string;
  end_date?: string;
  is_active: boolean;
  is_pinned: boolean;
  show_on_dashboard: boolean;
  created_by?: string;
  created_at?: string;
  updated_at?: string;

  // Additional fields for display
  unread_count?: number;
  total_reads?: number;
  is_read?: boolean;
}

export interface AnnouncementRead {
  id: string;
  announcement_id: string;
  employee_id: string;
  read_at: string;
}

export interface CreateAnnouncementInput {
  title: string;
  message: string;
  priority?: AnnouncementPriority;
  target_audience?: TargetAudience;
  target_employee_ids?: string[];
  start_date?: string;
  end_date?: string;
  is_pinned?: boolean;
  show_on_dashboard?: boolean;
}

export interface UpdateAnnouncementInput {
  title?: string;
  message?: string;
  priority?: AnnouncementPriority;
  target_audience?: TargetAudience;
  target_employee_ids?: string[];
  start_date?: string;
  end_date?: string;
  is_active?: boolean;
  is_pinned?: boolean;
  show_on_dashboard?: boolean;
}

export interface AnnouncementFilter {
  is_active?: boolean;
  priority?: AnnouncementPriority;
  target_audience?: TargetAudience;
  include_expired?: boolean;
}
