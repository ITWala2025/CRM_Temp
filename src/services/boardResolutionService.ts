import { supabase, isSupabaseConfigured } from '../config/supabase';
import type {
  BoardResolution,
  CreateBoardResolutionData,
  UpdateBoardResolutionData,
  BoardResolutionFilters,
  BoardResolutionStats,
} from '../types/boardResolution';

class BoardResolutionService {

  async generateResolutionNumber(): Promise<string> {
    if (!isSupabaseConfigured) throw new Error('Database is not configured');

    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const prefix = `KDADKS/BR/${year}/${month}/`;

    const { data, error } = await supabase
      .from('board_resolutions')
      .select('resolution_number')
      .like('resolution_number', `${prefix}%`)
      .order('resolution_number', { ascending: false })
      .limit(1);

    if (error) throw error;

    let nextNumber = 1;
    if (data && data.length > 0) {
      const lastNum = data[0].resolution_number.split('/').pop();
      nextNumber = parseInt(lastNum || '0', 10) + 1;
    }

    return `${prefix}${nextNumber.toString().padStart(3, '0')}`;
  }

  async getResolutions(
    page = 1,
    pageSize = 20,
    filters: BoardResolutionFilters = {}
  ): Promise<{ data: BoardResolution[]; total: number }> {
    if (!isSupabaseConfigured) throw new Error('Database is not configured');

    let query = supabase
      .from('board_resolutions')
      .select('*', { count: 'exact' })
      .order('resolution_date', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.company_settings_id) {
      query = query.eq('company_settings_id', filters.company_settings_id);
    }

    if (filters.search) {
      query = query.or(
        `resolution_number.ilike.%${filters.search}%,title.ilike.%${filters.search}%,board_action.ilike.%${filters.search}%`
      );
    }

    const { data, error, count } = await query;
    if (error) throw error;

    return { data: (data as BoardResolution[]) || [], total: count || 0 };
  }

  async getResolutionById(id: string): Promise<BoardResolution> {
    if (!isSupabaseConfigured) throw new Error('Database is not configured');

    const { data, error } = await supabase
      .from('board_resolutions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as BoardResolution;
  }

  async createResolution(formData: CreateBoardResolutionData): Promise<BoardResolution> {
    if (!isSupabaseConfigured) throw new Error('Database is not configured');

    const resolution_number = await this.generateResolutionNumber();

    const { data, error } = await supabase
      .from('board_resolutions')
      .insert({ ...formData, resolution_number })
      .select()
      .single();

    if (error) throw error;
    return data as BoardResolution;
  }

  async updateResolution(id: string, updates: UpdateBoardResolutionData): Promise<BoardResolution> {
    if (!isSupabaseConfigured) throw new Error('Database is not configured');

    const { data, error } = await supabase
      .from('board_resolutions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as BoardResolution;
  }

  async deleteResolution(id: string): Promise<void> {
    if (!isSupabaseConfigured) throw new Error('Database is not configured');

    const { error } = await supabase.from('board_resolutions').delete().eq('id', id);
    if (error) throw error;
  }

  async getStats(): Promise<BoardResolutionStats> {
    if (!isSupabaseConfigured) throw new Error('Database is not configured');

    const { data, error } = await supabase.from('board_resolutions').select('status');
    if (error) throw error;

    const rows = (data as { status: string }[]) || [];
    return {
      total: rows.length,
      draft: rows.filter(r => r.status === 'draft').length,
      passed: rows.filter(r => r.status === 'passed').length,
      rejected: rows.filter(r => r.status === 'rejected').length,
    };
  }
}

export const boardResolutionService = new BoardResolutionService();
