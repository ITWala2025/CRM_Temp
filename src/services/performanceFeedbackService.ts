import { supabase } from '../config/supabase';

export interface PerformanceFeedback {
  id: string;
  employee_id: string;
  feedback_type: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  period_start: string;
  period_end: string;
  overall_rating: number;
  quality_of_work?: number;
  productivity?: number;
  punctuality?: number;
  teamwork?: number;
  communication?: number;
  initiative?: number;
  strengths?: string;
  areas_for_improvement?: string;
  goals_for_next_period?: string;
  manager_comments?: string;
  employee_comments?: string;
  acknowledged_at?: string;
  acknowledged: boolean;
  status: 'draft' | 'published' | 'acknowledged';
  created_by?: string;
  reviewed_by?: string;
  created_at: string;
  updated_at: string;
  published_at?: string;
  // Joined fields
  employees?: {
    id: string;
    first_name: string;
    last_name: string;
    full_name: string;
    employee_number: string;
    designation: string;
    department: string;
  };
  goals?: PerformanceGoal[];
}

export interface PerformanceGoal {
  id: string;
  feedback_id: string;
  goal_title: string;
  goal_description?: string;
  target_date?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed' | 'not_achieved';
  completion_percentage: number;
  created_at: string;
  updated_at: string;
}

export interface CreateFeedbackData {
  employee_id: string;
  feedback_type: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  period_start: string;
  period_end: string;
  overall_rating: number;
  quality_of_work?: number;
  productivity?: number;
  punctuality?: number;
  teamwork?: number;
  communication?: number;
  initiative?: number;
  strengths?: string;
  areas_for_improvement?: string;
  goals_for_next_period?: string;
  manager_comments?: string;
  status?: 'draft' | 'published';
  created_by?: string;
}

export interface FeedbackFilters {
  employee_id?: string;
  feedback_type?: string;
  status?: string;
  year?: number;
}

export const performanceFeedbackService = {
  // Get all feedback with optional filters
  async getFeedback(filters?: FeedbackFilters): Promise<PerformanceFeedback[]> {
    let query = supabase
      .from('performance_feedback')
      .select(`
        *,
        employees (
          id,
          first_name,
          last_name,
          full_name,
          employee_number,
          designation,
          department
        )
      `)
      .order('created_at', { ascending: false });

    if (filters?.employee_id) {
      query = query.eq('employee_id', filters.employee_id);
    }
    if (filters?.feedback_type) {
      query = query.eq('feedback_type', filters.feedback_type);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.year) {
      const startOfYear = `${filters.year}-01-01`;
      const endOfYear = `${filters.year}-12-31`;
      query = query.gte('period_start', startOfYear).lte('period_end', endOfYear);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching feedback:', error);
      throw error;
    }

    return data || [];
  },

  // Get feedback by ID with goals
  async getFeedbackById(id: string): Promise<PerformanceFeedback | null> {
    const { data, error } = await supabase
      .from('performance_feedback')
      .select(`
        *,
        employees (
          id,
          first_name,
          last_name,
          full_name,
          employee_number,
          designation,
          department
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching feedback:', error);
      throw error;
    }

    // Fetch goals separately
    if (data) {
      const { data: goals } = await supabase
        .from('performance_goals')
        .select('*')
        .eq('feedback_id', id)
        .order('created_at', { ascending: true });
      
      data.goals = goals || [];
    }

    return data;
  },

  // Get employee's feedback (for employee portal)
  async getEmployeeFeedback(employeeId: string, status?: string): Promise<PerformanceFeedback[]> {
    let query = supabase
      .from('performance_feedback')
      .select('*')
      .eq('employee_id', employeeId)
      .order('period_end', { ascending: false });

    // For employee view, only show published or acknowledged feedback
    if (status) {
      query = query.eq('status', status);
    } else {
      query = query.in('status', ['published', 'acknowledged']);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching employee feedback:', error);
      throw error;
    }

    return data || [];
  },

  // Create new feedback
  async createFeedback(feedbackData: CreateFeedbackData): Promise<PerformanceFeedback> {
    const { data, error } = await supabase
      .from('performance_feedback')
      .insert({
        ...feedbackData,
        published_at: feedbackData.status === 'published' ? new Date().toISOString() : null
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating feedback:', error);
      throw error;
    }

    return data;
  },

  // Update feedback
  async updateFeedback(id: string, feedbackData: Partial<CreateFeedbackData>): Promise<PerformanceFeedback> {
    const updateData: any = { ...feedbackData };
    
    // Set published_at when publishing
    if (feedbackData.status === 'published') {
      updateData.published_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('performance_feedback')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating feedback:', error);
      throw error;
    }

    return data;
  },

  // Delete feedback
  async deleteFeedback(id: string): Promise<void> {
    const { error } = await supabase
      .from('performance_feedback')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting feedback:', error);
      throw error;
    }
  },

  // Acknowledge feedback (employee action)
  async acknowledgeFeedback(id: string, employeeComments?: string): Promise<PerformanceFeedback> {
    const { data, error } = await supabase
      .from('performance_feedback')
      .update({
        acknowledged: true,
        acknowledged_at: new Date().toISOString(),
        employee_comments: employeeComments,
        status: 'acknowledged'
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error acknowledging feedback:', error);
      throw error;
    }

    return data;
  },

  // Add goal to feedback
  async addGoal(feedbackId: string, goal: Partial<PerformanceGoal>): Promise<PerformanceGoal> {
    const { data, error } = await supabase
      .from('performance_goals')
      .insert({
        feedback_id: feedbackId,
        goal_title: goal.goal_title,
        goal_description: goal.goal_description,
        target_date: goal.target_date,
        priority: goal.priority || 'medium',
        status: goal.status || 'pending',
        completion_percentage: goal.completion_percentage || 0
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding goal:', error);
      throw error;
    }

    return data;
  },

  // Update goal
  async updateGoal(goalId: string, goalData: Partial<PerformanceGoal>): Promise<PerformanceGoal> {
    const { data, error } = await supabase
      .from('performance_goals')
      .update(goalData)
      .eq('id', goalId)
      .select()
      .single();

    if (error) {
      console.error('Error updating goal:', error);
      throw error;
    }

    return data;
  },

  // Delete goal
  async deleteGoal(goalId: string): Promise<void> {
    const { error } = await supabase
      .from('performance_goals')
      .delete()
      .eq('id', goalId);

    if (error) {
      console.error('Error deleting goal:', error);
      throw error;
    }
  },

  // Get feedback stats for an employee
  async getEmployeeFeedbackStats(employeeId: string) {
    const { data, error } = await supabase
      .from('performance_feedback')
      .select('overall_rating, feedback_type, period_end')
      .eq('employee_id', employeeId)
      .in('status', ['published', 'acknowledged'])
      .order('period_end', { ascending: false })
      .limit(12);

    if (error) {
      console.error('Error fetching feedback stats:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      return {
        averageRating: 0,
        totalFeedbacks: 0,
        latestRating: 0,
        ratingTrend: []
      };
    }

    const avgRating = data.reduce((sum, f) => sum + f.overall_rating, 0) / data.length;

    return {
      averageRating: Math.round(avgRating * 10) / 10,
      totalFeedbacks: data.length,
      latestRating: data[0]?.overall_rating || 0,
      ratingTrend: data.slice(0, 6).reverse().map(f => ({
        rating: f.overall_rating,
        type: f.feedback_type,
        date: f.period_end
      }))
    };
  },

  // Get pending acknowledgments count for employee
  async getPendingAcknowledgmentsCount(employeeId: string): Promise<number> {
    const { count, error } = await supabase
      .from('performance_feedback')
      .select('id', { count: 'exact', head: true })
      .eq('employee_id', employeeId)
      .eq('status', 'published')
      .eq('acknowledged', false);

    if (error) {
      console.error('Error fetching pending count:', error);
      return 0;
    }

    return count || 0;
  }
};
