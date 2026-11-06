import { supabase, isSupabaseConfigured } from '../config/supabase';
import { simpleAuth } from '../utils/simpleAuth';
import type {
  Lead,
  LeadStatus,
  LeadSource,
  CreateLeadData,
  UpdateLeadData,
  LeadFilters,
  LeadStats,
  PaginatedResponse
} from '../types/lead';

class LeadService {
  private calculateFinancialYear(fyStartMonth: number = 4, currentDate: Date = new Date()): string {
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    
    if (currentMonth >= fyStartMonth) {
      return `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
    } else {
      return `${currentYear - 1}-${currentYear.toString().slice(-2)}`;
    }
  }

  async getLeadStats(companySettingsId?: string): Promise<LeadStats> {
    if (companySettingsId) {
      const { data, error } = await supabase
        .from('leads')
        .select('status, source, created_at')
        .eq('company_settings_id', companySettingsId);
      
      if (error) throw error;
      
      const now = new Date();
      
      return {
        total_leads: data?.length || 0,
        new_leads: data?.filter(l => l.status === 'new').length || 0,
        contacted_leads: data?.filter(l => l.status === 'contacted').length || 0,
        qualified_leads: data?.filter(l => l.status === 'qualified').length || 0,
        disqualified_leads: data?.filter(l => l.status === 'disqualified').length || 0,
        converted_leads: data?.filter(l => l.status === 'converted').length || 0,
        website_leads: data?.filter(l => l.source === 'website').length || 0,
        referral_leads: data?.filter(l => l.source === 'referral').length || 0,
        campaign_leads: data?.filter(l => l.source === 'campaign').length || 0,
        this_month_leads: data?.filter(l => {
          const d = new Date(l.created_at);
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }).length || 0,
        this_year_leads: data?.filter(l => {
          const d = new Date(l.created_at);
          return d.getFullYear() === now.getFullYear();
        }).length || 0
      };
    }
    
    const { data, error } = await supabase
      .from('lead_stats_view')
      .select('*')
      .single();
    
    if (error) throw error;
    
    return {
      total_leads: data?.total_leads || 0,
      new_leads: data?.new_leads || 0,
      contacted_leads: data?.contacted_leads || 0,
      qualified_leads: data?.qualified_leads || 0,
      disqualified_leads: data?.disqualified_leads || 0,
      converted_leads: data?.converted_leads || 0,
      website_leads: data?.website_leads || 0,
      referral_leads: data?.referral_leads || 0,
      campaign_leads: data?.campaign_leads || 0,
      this_month_leads: data?.this_month_leads || 0,
      this_year_leads: data?.this_year_leads || 0
    };
  }

  async getLeads(filters?: LeadFilters, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<Lead>> {
    let query = supabase
      .from('leads')
      .select(`
        *,
        customer:customers(*),
        company_settings:company_settings(*)
      `, { count: 'exact' });

    if (filters) {
      if (filters.search) {
        query = query.or(`lead_number.ilike.%${filters.search}%,first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,company_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,submitter_name.ilike.%${filters.search}%,assigned_person_name.ilike.%${filters.search}%`);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.source) {
        query = query.eq('source', filters.source);
      }
      if (filters.customer_id) {
        query = query.eq('customer_id', filters.customer_id);
      }
      if (filters.company_settings_id) {
        query = query.eq('company_settings_id', filters.company_settings_id);
      }
      if (filters.assigned_to) {
        query = query.eq('assigned_to', filters.assigned_to);
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

  async getLeadById(id: string): Promise<Lead | null> {
    const { data, error } = await supabase
      .from('leads')
      .select(`
        *,
        customer:customers(*),
        company_settings:company_settings(*)
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  }

  async getLeadByNumber(leadNumber: string): Promise<Lead | null> {
    const { data, error } = await supabase
      .from('leads')
      .select(`
        *,
        customer:customers(*),
        company_settings:company_settings(*)
      `)
      .eq('lead_number', leadNumber)
      .single();
    
    if (error) throw error;
    return data;
  }

  private isColumnMissingError(error: any): boolean {
    if (!error) return false;
    const msg = (error.message || error.details || JSON.stringify(error)).toLowerCase();
    return msg.includes('column') && (msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('pgrst204'));
  }

  async createLead(leadData: CreateLeadData): Promise<Lead> {
    if (!isSupabaseConfigured) {
      throw new Error('Database is not configured');
    }

    const currentUser = await simpleAuth.getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const leadNumber = await this.generateLeadNumber();

    const insertPayload: any = {
      ...leadData,
      lead_number: leadNumber,
      created_by: currentUser.id,
      status: 'new',
      probability: 0
    };

    let { data, error } = await supabase
      .from('leads')
      .insert(insertPayload)
      .select(`
        *,
        customer:customers(*),
        company_settings:company_settings(*)
      `)
      .single();
    
    if (error && this.isColumnMissingError(error)) {
      delete insertPayload.submitter_name;
      delete insertPayload.assigned_person_name;

      const fallback = await supabase
        .from('leads')
        .insert(insertPayload)
        .select(`
          *,
          customer:customers(*),
          company_settings:company_settings(*)
        `)
        .single();

      if (fallback.error) throw fallback.error;
      return fallback.data;
    }

    if (error) throw error;
    return data;
  }

  async updateLead(id: string, leadData: UpdateLeadData): Promise<Lead> {
    const updatePayload: any = {
      ...leadData,
      updated_at: new Date().toISOString()
    };

    let { data, error } = await supabase
      .from('leads')
      .update(updatePayload)
      .eq('id', id)
      .select(`
        *,
        customer:customers(*),
        company_settings:company_settings(*)
      `)
      .single();

    if (error && this.isColumnMissingError(error)) {
      delete updatePayload.submitter_name;
      delete updatePayload.assigned_person_name;

      const fallback = await supabase
        .from('leads')
        .update(updatePayload)
        .eq('id', id)
        .select(`
          *,
          customer:customers(*),
          company_settings:company_settings(*)
        `)
        .single();

      if (fallback.error) throw fallback.error;
      return fallback.data;
    }
    
    if (error) throw error;
    return data;
  }

  async updateLeadStatus(id: string, status: LeadStatus, metadata?: {
    qualified_at?: string;
    disqualified_at?: string;
    disqualified_reason?: string;
    converted_at?: string;
  }): Promise<Lead> {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    };

    if (metadata) {
      Object.assign(updateData, metadata);
    }

    const { data, error } = await supabase
      .from('leads')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        customer:customers(*),
        company_settings:company_settings(*)
      `)
      .single();
    
    if (error) throw error;
    return data;
  }

  async deleteLead(id: string): Promise<void> {
    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }

  async generateLeadNumber(): Promise<string> {
    if (!isSupabaseConfigured) {
      throw new Error('Database is not configured');
    }

    const { data, error } = await supabase
      .rpc('get_next_lead_opportunity_number', { p_record_type: 'lead' });
    
    if (error) throw error;
    if (!data || typeof data !== 'string') {
      throw new Error('Failed to generate lead number');
    }
    
    return data;
  }

  async assignLead(id: string, assignedTo: string): Promise<Lead> {
    const { data, error } = await supabase
      .from('leads')
      .update({
        assigned_to: assignedTo,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        customer:customers(*),
        company_settings:company_settings(*)
      `)
      .single();
    
    if (error) throw error;
    return data;
  }

  async bulkUpdateStatus(ids: string[], status: LeadStatus): Promise<void> {
    const { error } = await supabase
      .from('leads')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .in('id', ids);
    
    if (error) throw error;
  }

  async getLeadsForEntity(companySettingsId: string): Promise<Lead[]> {
    const { data, error } = await supabase
      .from('leads')
      .select(`
        *,
        customer:customers(*),
        company_settings:company_settings(*)
      `)
      .eq('company_settings_id', companySettingsId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }
}

export const leadService = new LeadService();
