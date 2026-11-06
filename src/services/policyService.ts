import { supabase, isSupabaseConfigured } from '../config/supabase';
import {
  Policy,
  PolicyFormData,
  PolicyFilters,
  PolicyTemplate,
  PolicyJurisdiction,
  PolicyCategory,
} from '../types/policy';
import { JURISDICTION_POLICY_TEMPLATES } from '../data/jurisdictionPolicyTemplates';

/**
 * Service layer for HR Policies and Standard Operating Procedures (SOPs)
 */
export class PolicyService {
  /**
   * Fetch policies matching filters and entity context
   */
  static async getPolicies(filters?: PolicyFilters): Promise<Policy[]> {
    if (!isSupabaseConfigured) {
      console.warn('Supabase not configured, returning mock/template policies');
      return [];
    }

    try {
      let query = supabase
        .from('policies')
        .select(`
          *,
          company_settings:company_settings_id (
            id,
            company_name,
            logo_url,
            header_image_data,
            footer_image_data,
            logo_image_data
          )
        `)
        .order('created_at', { ascending: false });

      if (filters) {
        if (filters.category && filters.category !== 'all') {
          query = query.eq('category', filters.category);
        }

        if (filters.jurisdiction && filters.jurisdiction !== 'all') {
          query = query.eq('jurisdiction', filters.jurisdiction);
        }

        if (filters.status && filters.status !== 'all') {
          query = query.eq('status', filters.status);
        }

        if (filters.company_settings_id !== undefined) {
          if (filters.company_settings_id === null) {
            query = query.is('company_settings_id', null);
          } else {
            query = query.or(`company_settings_id.eq.${filters.company_settings_id},company_settings_id.is.null`);
          }
        }

        if (filters.searchQuery && filters.searchQuery.trim() !== '') {
          const q = `%${filters.searchQuery.trim()}%`;
          query = query.or(`title.ilike.${q},policy_code.ilike.${q},summary.ilike.${q}`);
        }
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching policies:', error);
        throw error;
      }

      return (data || []) as Policy[];
    } catch (err) {
      console.error('PolicyService.getPolicies failed:', err);
      return [];
    }
  }

  /**
   * Fetch a single policy by ID
   */
  static async getPolicyById(id: string): Promise<Policy | null> {
    if (!isSupabaseConfigured) return null;

    try {
      const { data, error } = await supabase
        .from('policies')
        .select(`
          *,
          company_settings:company_settings_id (
            id,
            company_name,
            logo_url,
            header_image_data,
            footer_image_data,
            logo_image_data
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as Policy;
    } catch (err) {
      console.error('PolicyService.getPolicyById error:', err);
      return null;
    }
  }

  /**
   * Create a new policy or SOP record
   */
  static async createPolicy(formData: PolicyFormData): Promise<Policy> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured. Cannot save policy.');
    }

    const payload = {
      company_settings_id: formData.company_settings_id || null,
      policy_code: formData.policy_code,
      title: formData.title,
      category: formData.category,
      policy_type: formData.policy_type,
      jurisdiction: formData.jurisdiction,
      jurisdiction_name: formData.jurisdiction_name,
      version: formData.version || '1.0',
      status: formData.status || 'draft',
      effective_date: formData.effective_date,
      review_date: formData.review_date || null,
      target_audience: formData.target_audience || 'All Employees',
      enforcement_level: formData.enforcement_level || 'Mandatory',
      summary: formData.summary || '',
      sections: formData.sections || [],
    };

    const { data, error } = await supabase
      .from('policies')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Failed to create policy:', error);
      throw error;
    }

    return data as Policy;
  }

  /**
   * Update an existing policy or SOP
   */
  static async updatePolicy(id: string, formData: Partial<PolicyFormData>): Promise<Policy> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured. Cannot update policy.');
    }

    const { data, error } = await supabase
      .from('policies')
      .update({
        ...formData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update policy:', error);
      throw error;
    }

    return data as Policy;
  }

  /**
   * Delete a policy by ID
   */
  static async deletePolicy(id: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;

    const { error } = await supabase
      .from('policies')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Failed to delete policy:', error);
      throw error;
    }

    return true;
  }

  /**
   * Duplicate a policy across entities or as a new draft version
   */
  static async duplicatePolicy(id: string, targetCompanyId?: string | null): Promise<Policy> {
    const existing = await this.getPolicyById(id);
    if (!existing) {
      throw new Error('Original policy not found');
    }

    const newCode = `${existing.policy_code}-COPY`;
    const newTitle = `${existing.title} (Copy)`;

    const formData: PolicyFormData = {
      company_settings_id: targetCompanyId !== undefined ? targetCompanyId : existing.company_settings_id,
      policy_code: newCode,
      title: newTitle,
      category: existing.category,
      policy_type: existing.policy_type,
      jurisdiction: existing.jurisdiction,
      jurisdiction_name: existing.jurisdiction_name,
      version: '1.0',
      status: 'draft',
      effective_date: new Date().toISOString().split('T')[0],
      review_date: existing.review_date,
      target_audience: existing.target_audience,
      enforcement_level: existing.enforcement_level,
      summary: existing.summary || '',
      sections: existing.sections || [],
    };

    return await this.createPolicy(formData);
  }

  /**
   * Change policy status to published
   */
  static async publishPolicy(id: string): Promise<Policy> {
    return await this.updatePolicy(id, { status: 'published' });
  }

  /**
   * Change policy status to archived
   */
  static async archivePolicy(id: string): Promise<Policy> {
    return await this.updatePolicy(id, { status: 'archived' });
  }

  /**
   * Get prefilled templates filtered by jurisdiction and category
   */
  static getTemplatesForJurisdiction(
    jurisdiction?: PolicyJurisdiction | 'all',
    category?: PolicyCategory | 'all'
  ): PolicyTemplate[] {
    return JURISDICTION_POLICY_TEMPLATES.filter((template) => {
      const matchJurisdiction =
        !jurisdiction || jurisdiction === 'all' || template.jurisdiction === jurisdiction || template.jurisdiction === 'GLOBAL';
      const matchCategory = !category || category === 'all' || template.category === category;
      return matchJurisdiction && matchCategory;
    });
  }
}

export default PolicyService;
