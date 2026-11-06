import { supabase, isSupabaseConfigured } from '../config/supabase';
import { simpleAuth } from '../utils/simpleAuth';
import type {
  LeadFollowUpTask,
  CreateLeadFollowUpTaskData,
  UpdateLeadFollowUpTaskData,
  LeadFollowUpTaskFilters,
  LeadFollowUpTaskStats,
  PaginatedResponse,
  FollowUpTaskStatus,
  FollowUpTaskPriority,
  Lead
} from '../types/lead';

class LeadFollowUpTaskService {
  async getFollowUpTasks(filters?: LeadFollowUpTaskFilters, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<LeadFollowUpTask>> {
    let query = supabase
      .from('lead_follow_up_tasks')
      .select(`
        *,
        lead:leads(*),
        opportunity:opportunities(*)
      `, { count: 'exact' });

    if (filters) {
      if (filters.company_settings_id) {
        query = query.eq('company_settings_id', filters.company_settings_id);
      }
      if (filters.lead_id) {
        query = query.eq('lead_id', filters.lead_id);
      }
      if (filters.opportunity_id) {
        query = query.eq('opportunity_id', filters.opportunity_id);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.priority) {
        query = query.eq('priority', filters.priority);
      }
      if (filters.assigned_to) {
        query = query.eq('assigned_to', filters.assigned_to);
      }
      if (filters.due_date_from) {
        query = query.gte('due_date', filters.due_date_from);
      }
      if (filters.due_date_to) {
        query = query.lte('due_date', filters.due_date_to);
      }
      if (filters.overdue_only) {
        const now = new Date().toISOString();
        query = query.lt('due_date', now).neq('status', 'completed').neq('status', 'cancelled');
      }
    }

    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    const { data, error, count } = await query
      .order('due_date', { ascending: true })
      .range(from, to);

    if (error) throw error;

    return {
      data: data || [],
      count: count || 0,
      page,
      per_page: perPage,
      total_pages: Math.ceil((count || 0) / perPage)
    };
  }

  async getFollowUpTaskById(id: string): Promise<LeadFollowUpTask | null> {
    const { data, error } = await supabase
      .from('lead_follow_up_tasks')
      .select(`
        *,
        lead:leads(*),
        opportunity:opportunities(*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  async createFollowUpTask(taskData: CreateLeadFollowUpTaskData): Promise<LeadFollowUpTask> {
    if (!isSupabaseConfigured) {
      throw new Error('Database is not configured');
    }

    const currentUser = await simpleAuth.getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('lead_follow_up_tasks')
      .insert({
        ...taskData,
        created_by: currentUser.id,
        status: 'open',
        priority: taskData.priority || 'medium',
        recurrence: taskData.recurrence || 'none'
      })
      .select(`
        *,
        lead:leads(*),
        opportunity:opportunities(*)
      `)
      .single();

    if (error) throw error;
    return data;
  }

  async updateFollowUpTask(id: string, taskData: UpdateLeadFollowUpTaskData): Promise<LeadFollowUpTask> {
    const updateData: any = {
      ...taskData,
      updated_at: new Date().toISOString()
    };

    if (taskData.status === 'completed' && !taskData.completed_at) {
      updateData.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('lead_follow_up_tasks')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        lead:leads(*),
        opportunity:opportunities(*)
      `)
      .single();

    if (error) throw error;
    return data;
  }

  async completeFollowUpTask(id: string, notes?: string): Promise<LeadFollowUpTask> {
    const currentUser = await simpleAuth.getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('lead_follow_up_tasks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completed_by: currentUser.id,
        completion_notes: notes || undefined,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        lead:leads(*),
        opportunity:opportunities(*)
      `)
      .single();

    if (error) throw error;

    // Log activity record in lead_activities for activity timeline
    if (data && data.lead_id) {
      try {
        await supabase
          .from('lead_activities')
          .insert({
            lead_id: data.lead_id,
            opportunity_id: data.opportunity_id || null,
            activity_type: data.task_type || 'task',
            subject: `Completed Task: ${data.title}`,
            description: notes ? (data.description ? `Notes: ${notes} | Task: ${data.description}` : `Notes: ${notes}`) : (data.description || 'Task completed.'),
            completed_at: new Date().toISOString(),
            created_by: currentUser.id
          });
      } catch (actErr) {
        console.warn('Failed to log lead activity for completed task:', actErr);
      }
    }

    return data;
  }

  async cancelFollowUpTask(id: string, reason?: string): Promise<LeadFollowUpTask> {
    const currentUser = await simpleAuth.getCurrentUser();
    const { data, error } = await supabase
      .from('lead_follow_up_tasks')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason || 'Cancelled by user',
        completion_notes: reason || undefined,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        lead:leads(*),
        opportunity:opportunities(*)
      `)
      .single();

    if (error) throw error;

    // Log activity record
    if (data && data.lead_id) {
      try {
        await supabase
          .from('lead_activities')
          .insert({
            lead_id: data.lead_id,
            opportunity_id: data.opportunity_id || null,
            activity_type: 'note',
            subject: `Cancelled Task: ${data.title}`,
            description: `Cancellation Reason: ${reason || 'Cancelled by user'}`,
            created_by: currentUser?.id || null
          });
      } catch (actErr) {
        console.warn('Failed to log lead activity for cancelled task:', actErr);
      }
    }

    return data;
  }

  async actionFollowUpTask(
    id: string,
    action: 'complete' | 'in_progress' | 'cancel',
    notes?: string,
    nextTask?: CreateLeadFollowUpTaskData
  ): Promise<{ task: LeadFollowUpTask; nextTask?: LeadFollowUpTask }> {
    let updatedTask: LeadFollowUpTask;
    if (action === 'complete') {
      updatedTask = await this.completeFollowUpTask(id, notes);
    } else if (action === 'cancel') {
      updatedTask = await this.cancelFollowUpTask(id, notes);
    } else {
      updatedTask = await this.updateFollowUpTask(id, {
        status: 'in_progress',
        completion_notes: notes
      } as any);

      if (notes && updatedTask.lead_id) {
        const currentUser = await simpleAuth.getCurrentUser();
        try {
          await supabase
            .from('lead_activities')
            .insert({
              lead_id: updatedTask.lead_id,
              opportunity_id: updatedTask.opportunity_id || null,
              activity_type: 'note',
              subject: `Updated Task: ${updatedTask.title}`,
              description: `Follow-up Notes: ${notes}`,
              created_by: currentUser?.id || null
            });
        } catch (actErr) {
          console.warn('Failed to log lead activity for in-progress task notes:', actErr);
        }
      }
    }

    let createdNextTask: LeadFollowUpTask | undefined = undefined;
    if (nextTask && nextTask.title && nextTask.due_date) {
      createdNextTask = await this.createFollowUpTask(nextTask);
    }

    return { task: updatedTask, nextTask: createdNextTask };
  }

  async deleteFollowUpTask(id: string): Promise<void> {
    const { error } = await supabase
      .from('lead_follow_up_tasks')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async getFollowUpTasksForLead(leadId: string): Promise<LeadFollowUpTask[]> {
    const { data, error } = await supabase
      .from('lead_follow_up_tasks')
      .select(`
        *,
        lead:leads(*),
        opportunity:opportunities(*)
      `)
      .eq('lead_id', leadId)
      .order('due_date', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async getFollowUpTasksForOpportunity(opportunityId: string): Promise<LeadFollowUpTask[]> {
    const { data, error } = await supabase
      .from('lead_follow_up_tasks')
      .select(`
        *,
        lead:leads(*),
        opportunity:opportunities(*)
      `)
      .eq('opportunity_id', opportunityId)
      .order('due_date', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async getFollowUpTaskStats(companySettingsId?: string): Promise<LeadFollowUpTaskStats> {
    let query = supabase
      .from('lead_follow_up_tasks')
      .select('status, priority, due_date');

    if (companySettingsId) {
      query = query.eq('company_settings_id', companySettingsId);
    }

    const { data, error } = await query;

    if (error) throw error;

    const tasks = data || [];
    const now = new Date().toISOString();

    return {
      total_tasks: tasks.length,
      open_tasks: tasks.filter(t => t.status === 'open').length,
      in_progress_tasks: tasks.filter(t => t.status === 'in_progress').length,
      completed_tasks: tasks.filter(t => t.status === 'completed').length,
      overdue_tasks: tasks.filter(t => t.status === 'overdue' || (t.due_date < now && t.status !== 'completed' && t.status !== 'cancelled')).length,
      cancelled_tasks: tasks.filter(t => t.status === 'cancelled').length,
      high_priority_tasks: tasks.filter(t => t.priority === 'high').length,
      urgent_tasks: tasks.filter(t => t.priority === 'urgent').length,
      upcoming_tasks: tasks.filter(t => t.due_date >= now && t.status !== 'completed' && t.status !== 'cancelled').length
    };
  }

  async getOverdueFollowUpTasks(companySettingsId?: string): Promise<LeadFollowUpTask[]> {
    let query = supabase
      .from('lead_follow_up_tasks')
      .select(`
        *,
        lead:leads(*),
        opportunity:opportunities(*)
      `)
      .lt('due_date', new Date().toISOString())
      .neq('status', 'completed')
      .neq('status', 'cancelled')
      .order('due_date', { ascending: true });

    if (companySettingsId) {
      query = query.eq('company_settings_id', companySettingsId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  async getStaleLeads(companySettingsId?: string, staleDays: number = 14): Promise<Lead[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - staleDays);

    let query = supabase
      .from('leads')
      .select(`
        *,
        customer:customers(*),
        company_settings:company_settings(*)
      `)
      .in('status', ['new', 'contacted', 'qualified'])
      .lt('updated_at', cutoffDate.toISOString())
      .order('updated_at', { ascending: true });

    if (companySettingsId) {
      query = query.eq('company_settings_id', companySettingsId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  async getUpcomingFollowUpTasks(companySettingsId?: string, daysAhead: number = 7): Promise<LeadFollowUpTask[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    let query = supabase
      .from('lead_follow_up_tasks')
      .select(`
        *,
        lead:leads(*),
        opportunity:opportunities(*)
      `)
      .gte('due_date', new Date().toISOString())
      .lte('due_date', futureDate.toISOString())
      .neq('status', 'completed')
      .neq('status', 'cancelled')
      .order('due_date', { ascending: true });

    if (companySettingsId) {
      query = query.eq('company_settings_id', companySettingsId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }
}

export const leadFollowUpTaskService = new LeadFollowUpTaskService();
