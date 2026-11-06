import { supabase } from '../config/supabase';
import type {
  Announcement,
  AnnouncementRead,
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
  AnnouncementFilter
} from '../types/announcement';

export const announcementService = {
  /**
   * Create a new announcement
   */
  async createAnnouncement(input: CreateAnnouncementInput): Promise<Announcement> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('announcements')
        .insert({
          ...input,
          created_by: user?.id,
          priority: input.priority || 'normal',
          target_audience: input.target_audience || 'all',
          is_pinned: input.is_pinned || false,
          show_on_dashboard: input.show_on_dashboard !== false
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create announcement: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Create announcement error:', error);
      throw error;
    }
  },

  /**
   * Get all announcements (admin view with filters)
   */
  async getAllAnnouncements(filter?: AnnouncementFilter): Promise<Announcement[]> {
    try {
      let query = supabase
        .from('announcements')
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (filter?.is_active !== undefined) {
        query = query.eq('is_active', filter.is_active);
      }

      if (filter?.priority) {
        query = query.eq('priority', filter.priority);
      }

      if (filter?.target_audience) {
        query = query.eq('target_audience', filter.target_audience);
      }

      // Filter out expired announcements unless explicitly requested
      if (!filter?.include_expired) {
        query = query.or(`end_date.is.null,end_date.gte.${new Date().toISOString()}`);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch announcements: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Get all announcements error:', error);
      throw error;
    }
  },

  /**
   * Get active announcements for employees (respects targeting)
   */
  async getEmployeeAnnouncements(employeeId: string): Promise<Announcement[]> {
    try {
      const now = new Date().toISOString();

      let query = supabase
        .from('announcements')
        .select('*')
        .eq('is_active', true)
        .eq('show_on_dashboard', true)
        .lte('start_date', now)
        .or(`end_date.is.null,end_date.gte.${now}`)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch employee announcements: ${error.message}`);
      }

      // Client-side filtering for targeted announcements
      const filtered = (data || []).filter(announcement => {
        if (announcement.target_audience === 'all') {
          return true;
        }

        if (announcement.target_audience === 'specific') {
          return announcement.target_employee_ids?.includes(employeeId);
        }

        return false;
      });

      // Check read status for each announcement
      const { data: reads } = await supabase
        .from('announcement_reads')
        .select('announcement_id')
        .eq('employee_id', employeeId);

      const readIds = new Set(reads?.map(r => r.announcement_id) || []);

      return filtered.map(announcement => ({
        ...announcement,
        is_read: readIds.has(announcement.id)
      }));
    } catch (error) {
      console.error('Get employee announcements error:', error);
      throw error;
    }
  },

  /**
   * Get a single announcement by ID
   */
  async getAnnouncementById(id: string): Promise<Announcement> {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        throw new Error(`Failed to fetch announcement: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Get announcement by ID error:', error);
      throw error;
    }
  },

  /**
   * Update an announcement
   */
  async updateAnnouncement(id: string, input: UpdateAnnouncementInput): Promise<Announcement> {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update announcement: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Update announcement error:', error);
      throw error;
    }
  },

  /**
   * Delete an announcement
   */
  async deleteAnnouncement(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(`Failed to delete announcement: ${error.message}`);
      }
    } catch (error) {
      console.error('Delete announcement error:', error);
      throw error;
    }
  },

  /**
   * Mark announcement as read by employee
   */
  async markAsRead(announcementId: string, employeeId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('announcement_reads')
        .upsert({
          announcement_id: announcementId,
          employee_id: employeeId
        }, {
          onConflict: 'announcement_id,employee_id'
        });

      if (error) {
        throw new Error(`Failed to mark announcement as read: ${error.message}`);
      }
    } catch (error) {
      console.error('Mark announcement as read error:', error);
      throw error;
    }
  },

  /**
   * Get read statistics for an announcement
   */
  async getAnnouncementStats(announcementId: string): Promise<{ total_reads: number; unread_count: number }> {
    try {
      // Get total reads
      const { count: totalReads, error: readsError } = await supabase
        .from('announcement_reads')
        .select('*', { count: 'exact', head: true })
        .eq('announcement_id', announcementId);

      if (readsError) {
        throw new Error(`Failed to fetch read stats: ${readsError.message}`);
      }

      // Get announcement to determine potential audience
      const announcement = await this.getAnnouncementById(announcementId);
      let potentialAudience = 0;

      if (announcement.target_audience === 'all') {
        const { count, error } = await supabase
          .from('employees')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active');

        if (!error) potentialAudience = count || 0;
      } else if (announcement.target_audience === 'specific') {
        potentialAudience = announcement.target_employee_ids?.length || 0;
      }

      return {
        total_reads: totalReads || 0,
        unread_count: Math.max(0, potentialAudience - (totalReads || 0))
      };
    } catch (error) {
      console.error('Get announcement stats error:', error);
      throw error;
    }
  },

  /**
   * Toggle announcement active status
   */
  async toggleActive(id: string): Promise<Announcement> {
    try {
      const announcement = await this.getAnnouncementById(id);
      return await this.updateAnnouncement(id, { is_active: !announcement.is_active });
    } catch (error) {
      console.error('Toggle active error:', error);
      throw error;
    }
  },

  /**
   * Toggle announcement pinned status
   */
  async togglePinned(id: string): Promise<Announcement> {
    try {
      const announcement = await this.getAnnouncementById(id);
      return await this.updateAnnouncement(id, { is_pinned: !announcement.is_pinned });
    } catch (error) {
      console.error('Toggle pinned error:', error);
      throw error;
    }
  }
};
