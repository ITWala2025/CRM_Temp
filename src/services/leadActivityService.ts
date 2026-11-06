import { supabase, isSupabaseConfigured } from '../config/supabase';
import { simpleAuth } from '../utils/simpleAuth';
import type {
  LeadActivity,
  ActivityType,
  CreateLeadActivityData,
  LeadActivityFilters,
  LeadTimelineEntry
} from '../types/lead';

class LeadActivityService {
  async getActivities(filters?: LeadActivityFilters, page: number = 1, perPage: number = 20) {
    let query = supabase
      .from('lead_activities')
      .select(`
        *,
        lead:leads(*),
        opportunity:opportunities(*)
      `, { count: 'exact' });

    if (filters) {
      if (filters.lead_id) {
        query = query.eq('lead_id', filters.lead_id);
      }
      if (filters.opportunity_id) {
        query = query.eq('opportunity_id', filters.opportunity_id);
      }
      if (filters.activity_type) {
        query = query.eq('activity_type', filters.activity_type);
      }
      if (filters.created_by) {
        query = query.eq('created_by', filters.created_by);
      }
      if (filters.date_from) {
        query = query.gte('created_at', filters.date_from);
      }
      if (filters.date_to) {
        query = query.lte('created_at', filters.date_to);
      }
    }

    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
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

  async getActivityById(id: string): Promise<LeadActivity | null> {
    const { data, error } = await supabase
      .from('lead_activities')
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

  async createActivity(activityData: CreateLeadActivityData): Promise<LeadActivity> {
    if (!isSupabaseConfigured) {
      throw new Error('Database is not configured');
    }

    const currentUser = await simpleAuth.getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('lead_activities')
      .insert({
        ...activityData,
        created_by: currentUser.id
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

  async updateActivity(id: string, activityData: Partial<CreateLeadActivityData>): Promise<LeadActivity> {
    const { data, error } = await supabase
      .from('lead_activities')
      .update({
        ...activityData,
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
    return data;
  }

  async completeActivity(id: string): Promise<LeadActivity> {
    const { data, error } = await supabase
      .from('lead_activities')
      .update({
        completed_at: new Date().toISOString(),
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
    return data;
  }

  async deleteActivity(id: string): Promise<void> {
    const { error } = await supabase
      .from('lead_activities')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }

  async getActivitiesForLead(leadId: string): Promise<LeadActivity[]> {
    const { data, error } = await supabase
      .from('lead_activities')
      .select(`
        *,
        lead:leads(*),
        opportunity:opportunities(*)
      `)
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }

  async getActivitiesForOpportunity(opportunityId: string): Promise<LeadActivity[]> {
    const { data, error } = await supabase
      .from('lead_activities')
      .select(`
        *,
        lead:leads(*),
        opportunity:opportunities(*)
      `)
      .eq('opportunity_id', opportunityId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }

  async getLeadTimeline(leadId: string): Promise<LeadTimelineEntry[]> {
    const [activitiesResult, tasksResult, statusChangesResult] = await Promise.all([
      supabase
        .from('lead_activities')
        .select(`
          id,
          activity_type,
          subject,
          description,
          created_at,
          completed_at,
          created_by
        `)
        .eq('lead_id', leadId)
        .order('created_at', { ascending: true }),
      
      supabase
        .from('lead_follow_up_tasks')
        .select(`
          id,
          title,
          description,
          status,
          priority,
          due_date,
          completed_at,
          cancelled_at,
          cancellation_reason,
          completion_notes,
          created_by,
          completed_by,
          assigned_to,
          created_at,
          updated_at
        `)
        .eq('lead_id', leadId)
        .order('created_at', { ascending: true }),
      
      supabase
        .from('leads')
        .select('status, updated_at, converted_at, qualified_at, disqualified_at, probability')
        .eq('id', leadId)
        .single()
    ]);

    if (activitiesResult.error) throw activitiesResult.error;
    if (tasksResult.error) throw tasksResult.error;
    if (statusChangesResult.error) throw statusChangesResult.error;

    const timeline: LeadTimelineEntry[] = [];

    const activities = activitiesResult.data || [];
    for (const activity of activities) {
      timeline.push({
        id: activity.id,
        entry_type: 'activity',
        occurred_at: activity.completed_at || activity.created_at,
        title: activity.subject,
        description: activity.description,
        metadata: { activity_type: activity.activity_type, completed: !!activity.completed_at },
        actor_id: activity.created_by
      });
    }

    const tasks = tasksResult.data || [];
    for (const task of tasks) {
      if (task.status === 'completed' && task.completed_at) {
        const desc = task.completion_notes 
          ? (task.description ? `${task.completion_notes} (Task: ${task.description})` : task.completion_notes)
          : task.description;
        timeline.push({
          id: task.id,
          entry_type: 'follow_up_task',
          occurred_at: task.completed_at,
          title: `Completed: ${task.title}`,
          description: desc,
          metadata: { 
            task_status: task.status, 
            priority: task.priority, 
            completed: true,
            completion_notes: task.completion_notes 
          },
          actor_id: task.completed_by || task.created_by
        });
      } else if (task.status === 'cancelled' && task.cancelled_at) {
        const desc = task.completion_notes || task.cancellation_reason || task.description;
        timeline.push({
          id: task.id,
          entry_type: 'follow_up_task',
          occurred_at: task.cancelled_at,
          title: `Cancelled: ${task.title}`,
          description: desc,
          metadata: { 
            task_status: task.status, 
            priority: task.priority,
            cancellation_reason: task.cancellation_reason,
            completion_notes: task.completion_notes
          },
          actor_id: task.created_by
        });
      } else {
        const desc = task.completion_notes 
          ? (task.description ? `${task.completion_notes} (Task: ${task.description})` : task.completion_notes)
          : task.description;
        timeline.push({
          id: task.id,
          entry_type: 'follow_up_task',
          occurred_at: task.created_at,
          title: `Task created: ${task.title}`,
          description: desc,
          metadata: { 
            task_status: task.status, 
            priority: task.priority, 
            due_date: task.due_date,
            completion_notes: task.completion_notes
          },
          actor_id: task.created_by
        });

        if (task.updated_at !== task.created_at && task.status !== 'open') {
          timeline.push({
            id: `${task.id}-status-update`,
            entry_type: 'follow_up_task',
            occurred_at: task.updated_at,
            title: `Task updated: ${task.title}`,
            description: task.completion_notes ? `Notes: ${task.completion_notes}` : `Status changed to ${task.status}`,
            metadata: { 
              task_status: task.status, 
              priority: task.priority,
              completion_notes: task.completion_notes
            },
            actor_id: task.assigned_to || task.created_by
          });
        }
      }
    }

    const statusChanges = [];
    if (statusChangesResult.data) {
      const lead = statusChangesResult.data;
      if (lead.converted_at) {
        statusChanges.push({ occurred_at: lead.converted_at, title: 'Lead converted', status: 'converted' });
      }
      if (lead.qualified_at) {
        statusChanges.push({ occurred_at: lead.qualified_at, title: 'Lead qualified', status: 'qualified' });
      }
      if (lead.disqualified_at) {
        statusChanges.push({ occurred_at: lead.disqualified_at, title: 'Lead disqualified', status: 'disqualified' });
      }
    }

    for (const change of statusChanges) {
      timeline.push({
        id: `status-${change.occurred_at}`,
        entry_type: 'status_change',
        occurred_at: change.occurred_at,
        title: change.title,
        metadata: { new_status: change.status }
      });
    }

    timeline.sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());

    return timeline;
  }

  async getOpportunityTimeline(opportunityId: string): Promise<LeadTimelineEntry[]> {
    const [activitiesResult, tasksResult] = await Promise.all([
      supabase
        .from('lead_activities')
        .select(`
          id,
          activity_type,
          subject,
          description,
          created_at,
          completed_at,
          created_by
        `)
        .eq('opportunity_id', opportunityId)
        .order('created_at', { ascending: true }),
      
      supabase
        .from('lead_follow_up_tasks')
        .select(`
          id,
          title,
          description,
          status,
          priority,
          due_date,
          completed_at,
          cancelled_at,
          cancellation_reason,
          completion_notes,
          created_by,
          completed_by,
          assigned_to,
          created_at,
          updated_at
        `)
        .eq('opportunity_id', opportunityId)
        .order('created_at', { ascending: true })
    ]);

    if (activitiesResult.error) throw activitiesResult.error;
    if (tasksResult.error) throw tasksResult.error;

    const timeline: LeadTimelineEntry[] = [];

    const activities = activitiesResult.data || [];
    for (const activity of activities) {
      timeline.push({
        id: activity.id,
        entry_type: 'activity',
        occurred_at: activity.completed_at || activity.created_at,
        title: activity.subject,
        description: activity.description,
        metadata: { activity_type: activity.activity_type, completed: !!activity.completed_at },
        actor_id: activity.created_by
      });
    }

    const tasks = tasksResult.data || [];
    for (const task of tasks) {
      if (task.status === 'completed' && task.completed_at) {
        const desc = task.completion_notes 
          ? (task.description ? `${task.completion_notes} (Task: ${task.description})` : task.completion_notes)
          : task.description;
        timeline.push({
          id: task.id,
          entry_type: 'follow_up_task',
          occurred_at: task.completed_at,
          title: `Completed: ${task.title}`,
          description: desc,
          metadata: { 
            task_status: task.status, 
            priority: task.priority, 
            completed: true,
            completion_notes: task.completion_notes
          },
          actor_id: task.completed_by || task.created_by
        });
      } else if (task.status === 'cancelled' && task.cancelled_at) {
        const desc = task.completion_notes || task.cancellation_reason || task.description;
        timeline.push({
          id: task.id,
          entry_type: 'follow_up_task',
          occurred_at: task.cancelled_at,
          title: `Cancelled: ${task.title}`,
          description: desc,
          metadata: { 
            task_status: task.status, 
            priority: task.priority,
            cancellation_reason: task.cancellation_reason,
            completion_notes: task.completion_notes
          },
          actor_id: task.created_by
        });
      } else {
        const desc = task.completion_notes 
          ? (task.description ? `${task.completion_notes} (Task: ${task.description})` : task.completion_notes)
          : task.description;
        timeline.push({
          id: task.id,
          entry_type: 'follow_up_task',
          occurred_at: task.created_at,
          title: `Task created: ${task.title}`,
          description: desc,
          metadata: { 
            task_status: task.status, 
            priority: task.priority, 
            due_date: task.due_date,
            completion_notes: task.completion_notes 
          },
          actor_id: task.created_by
        });
      }
    }

    timeline.sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());

    return timeline;
  }
}

export const leadActivityService = new LeadActivityService();

