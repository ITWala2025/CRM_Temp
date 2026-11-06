/**
 * Contract Service
 * Handles all database operations for contract management
 */

import { supabase, isSupabaseConfigured } from '../config/supabase';
import { simpleAuth } from '../utils/simpleAuth';
import { convertToINR } from '../utils/currencyConverter';
import { exchangeRateService } from './exchangeRateService';
import { getEntityPrefix } from '../utils/customerCodeUtils';
import { IRISH_CONTRACT_TEMPLATES } from '../data/irishContractTemplates';
import { INDIAN_CONTRACT_TEMPLATES } from '../data/indianContractTemplates';
import type {
  Contract,
  ContractWithDetails,
  ContractSection,
  ContractTemplate,
  ContractTemplateWithSections,
  CreateContractData,
  UpdateContractData,
  ContractFilters,
  ContractStatistics
} from '../types/contract';

const CUSTOM_TEMPLATES_KEY = 'kdadks_custom_contract_templates';

// Convert static templates to standard ContractTemplateWithSections format
const builtInIrishTemplates: ContractTemplateWithSections[] = IRISH_CONTRACT_TEMPLATES.map(t => ({
  id: `builtin-irish-${t.contract_type.toLowerCase()}`,
  template_name: t.label,
  contract_type: t.contract_type,
  contract_title: t.contract_title,
  entity_law: 'IRL',
  currency_code: t.currency_code,
  preamble: t.preamble,
  description: `Standard Irish Law ${t.contract_title} compliance template.`,
  is_active: true,
  is_custom: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  sections: t.sections.map((s, idx) => ({
    id: `sec-irl-${t.contract_type}-${idx}`,
    template_id: `builtin-irish-${t.contract_type.toLowerCase()}`,
    section_number: s.section_number,
    section_title: s.section_title,
    section_content: s.section_content,
    is_required: s.is_required,
    is_locked: s.is_locked,
    is_editable: !s.is_locked,
    page_break_before: s.page_break_before,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }))
}));

const builtInIndianTemplates: ContractTemplateWithSections[] = INDIAN_CONTRACT_TEMPLATES.map(t => ({
  id: `builtin-indian-${t.contract_type.toLowerCase()}`,
  template_name: t.label,
  contract_type: t.contract_type,
  contract_title: t.contract_title,
  entity_law: 'IND',
  currency_code: t.currency_code,
  preamble: t.preamble,
  description: `Standard Indian Law ${t.contract_title} compliance template.`,
  is_active: true,
  is_custom: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  sections: t.sections.map((s, idx) => ({
    id: `sec-ind-${t.contract_type}-${idx}`,
    template_id: `builtin-indian-${t.contract_type.toLowerCase()}`,
    section_number: s.section_number,
    section_title: s.section_title,
    section_content: s.section_content,
    is_required: s.is_required,
    is_locked: s.is_locked,
    is_editable: !s.is_locked,
    page_break_before: s.page_break_before,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }))
}));

class ContractService {
  
  // =====================================================
  // CONTRACT NUMBER GENERATION
  // =====================================================

  /**
   * Generate next contract number.
   * Format: KDADKS/{ENTITY}/YYYY/MM/XXXX
   * e.g. KDADKS/IND/2026/08/0001, KDADKS/IRL/2026/08/0002
   */
  async generateContractNumber(entityPrefix?: string, contractType?: string): Promise<string> {
    if (!isSupabaseConfigured) {
      throw new Error('Database is not configured');
    }

    const year = new Date().getFullYear();
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');

    let entity = 'IND';
    if (entityPrefix) {
      const up = entityPrefix.toUpperCase();
      if (up === 'IRL' || up === 'IE') {
        entity = 'IRL';
      } else if (up === 'GBR' || up === 'GB' || up === 'UK') {
        entity = 'GBR';
      } else if (up === 'USA' || up === 'US') {
        entity = 'USA';
      } else if (up === 'IND' || up === 'IN') {
        entity = 'IND';
      } else if (up && /^[A-Z]{2,4}$/.test(up)) {
        entity = up.substring(0, 3);
      }
    }

    const prefix = `KDADKS/${entity}/${year}/${month}/`;

    const { data, error } = await supabase
      .from('contracts')
      .select('contract_number')
      .like('contract_number', `${prefix}%`)
      .order('contract_number', { ascending: false })
      .limit(1);

    if (error) {
      console.warn('Failed to fetch last contract number, falling back to 0001:', error);
      return `${prefix}0001`;
    }

    if (!data || data.length === 0) {
      return `${prefix}0001`;
    }

    const lastContractNumber = data[0].contract_number;
    const lastSequenceStr = lastContractNumber.split('/').pop();
    const lastSequence = lastSequenceStr ? parseInt(lastSequenceStr, 10) : 0;
    const nextNumber = isNaN(lastSequence) ? 1 : lastSequence + 1;

    return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
  }

  // =====================================================
  // CONTRACT TEMPLATES
  // =====================================================

  /**
   * Helper to fetch custom templates from local storage
   */
  private getCustomTemplatesFromStorage(): ContractTemplateWithSections[] {
    try {
      const raw = localStorage.getItem(CUSTOM_TEMPLATES_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch (err) {
      console.error('Failed to load custom contract templates:', err);
      return [];
    }
  }

  /**
   * Get all contract templates (combines built-in Irish/Indian with custom templates)
   */
  async getTemplates(): Promise<ContractTemplate[]> {
    const all = await this.getAllTemplatesWithSections();
    return all.map(({ sections, ...rest }) => rest);
  }

  /**
   * Get all contract templates with their full section details, optionally filtered by entity Code (IN/IND vs IE/IRL)
   */
  async getAllTemplatesWithSections(entityCode?: string): Promise<ContractTemplateWithSections[]> {
    const custom = this.getCustomTemplatesFromStorage();
    const allBuiltIn = [...builtInIrishTemplates, ...builtInIndianTemplates];

    let dbTemplates: ContractTemplateWithSections[] = [];
    if (isSupabaseConfigured) {
      try {
        const { data: tpls } = await supabase.from('contract_templates').select('*').eq('is_active', true);
        if (tpls && tpls.length > 0) {
          for (const t of tpls) {
            const { data: secs } = await supabase
              .from('contract_template_sections')
              .select('*')
              .eq('template_id', t.id)
              .order('section_number');
            dbTemplates.push({
              ...t,
              contract_type: t.contract_type || t.template_type || 'MSA',
              is_custom: true,
              sections: (secs || []).map(s => ({
                ...s,
                is_locked: !s.is_editable,
              }))
            });
          }
        }
      } catch (e) {
        console.warn('Could not fetch DB contract templates:', e);
      }
    }

    // Merge: custom templates take precedence over built-in if IDs match
    const map = new Map<string, ContractTemplateWithSections>();
    allBuiltIn.forEach(t => map.set(t.id, t));
    custom.forEach(t => map.set(t.id, t));
    dbTemplates.forEach(t => map.set(t.id, t));

    const result = Array.from(map.values());

    if (!entityCode) return result;

    const isIrish = entityCode === 'IE' || entityCode === 'IRL';
    const isIndian = entityCode === 'IN' || entityCode === 'IND';

    return result.filter(t => {
      if (!t.entity_law || t.entity_law === 'ALL') return true;
      if (isIrish && t.entity_law === 'IRL') return true;
      if (isIndian && t.entity_law === 'IND') return true;
      return false;
    });
  }

  /**
   * Get template with sections by ID
   */
  async getTemplateWithSections(templateId: string): Promise<ContractTemplateWithSections | null> {
    const all = await this.getAllTemplatesWithSections();
    return all.find(t => t.id === templateId) || null;
  }

  /**
   * Save or update a contract template (with sections)
   */
  async saveTemplate(template: Partial<ContractTemplateWithSections> & { template_name: string; contract_type: any }): Promise<ContractTemplateWithSections> {
    const now = new Date().toISOString();
    const templateId = template.id || `custom-tpl-${Date.now()}`;
    
    const savedTemplate: ContractTemplateWithSections = {
      id: templateId,
      template_name: template.template_name,
      contract_type: template.contract_type,
      contract_title: template.contract_title || template.template_name,
      description: template.description || '',
      entity_law: template.entity_law || 'ALL',
      currency_code: template.currency_code || 'INR',
      preamble: template.preamble || '',
      is_active: template.is_active !== undefined ? template.is_active : true,
      is_custom: true,
      created_at: template.created_at || now,
      updated_at: now,
      sections: (template.sections || []).map((s, idx) => ({
        id: s.id || `sec-${templateId}-${idx}-${Date.now()}`,
        template_id: templateId,
        section_number: idx + 1,
        section_title: s.section_title,
        section_content: s.section_content,
        is_required: !!s.is_required,
        is_editable: s.is_editable !== undefined ? s.is_editable : !s.is_locked,
        is_locked: !!s.is_locked,
        page_break_before: !!s.page_break_before,
        created_at: s.created_at || now,
        updated_at: now,
      }))
    };

    // Save to local storage for persistence across reloads
    const custom = this.getCustomTemplatesFromStorage();
    const existingIdx = custom.findIndex(t => t.id === templateId);
    if (existingIdx >= 0) {
      custom[existingIdx] = savedTemplate;
    } else {
      custom.push(savedTemplate);
    }
    localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(custom));

    // Also persist to Supabase if available
    if (isSupabaseConfigured) {
      try {
        await supabase.from('contract_templates').upsert({
          id: savedTemplate.id,
          template_name: savedTemplate.template_name,
          template_type: savedTemplate.contract_type,
          description: savedTemplate.description,
          is_active: savedTemplate.is_active,
          updated_at: savedTemplate.updated_at
        });
        
        await supabase.from('contract_template_sections').delete().eq('template_id', savedTemplate.id);
        if (savedTemplate.sections.length > 0) {
          await supabase.from('contract_template_sections').insert(
            savedTemplate.sections.map(s => ({
              template_id: savedTemplate.id,
              section_number: s.section_number,
              section_title: s.section_title,
              section_content: s.section_content,
              is_required: s.is_required,
              is_editable: s.is_editable,
            }))
          );
        }
      } catch (e) {
        console.warn('Supabase template save error, using local storage fallback:', e);
      }
    }

    return savedTemplate;
  }

  /**
   * Delete a custom contract template
   */
  async deleteTemplate(templateId: string): Promise<void> {
    const custom = this.getCustomTemplatesFromStorage().filter(t => t.id !== templateId);
    localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(custom));

    if (isSupabaseConfigured) {
      try {
        await supabase.from('contract_templates').delete().eq('id', templateId);
      } catch (e) {
        console.warn('Supabase template delete error:', e);
      }
    }
  }

  // =====================================================
  // CONTRACTS - CREATE
  // =====================================================

  /**
   * Create a new contract
   */
  async createContract(contractData: CreateContractData): Promise<Contract> {
    if (!isSupabaseConfigured) {
      throw new Error('Database is not configured');
    }

    const currentUser = await simpleAuth.getCurrentUser();
    const contractNumber = await this.generateContractNumber(
      contractData.entity_prefix,
      contractData.contract_type
    );

    // Prepare contract data (exclude non-schema UI fields from main contracts table insert)
    const { 
      sections, 
      milestones, 
      entity_prefix, 
      customer_id, 
      party_a_vat_number,
      party_a_cro_number,
      party_b_vat_number,
      party_b_cro_number,
      ...contractInfo 
    } = contractData;

    const isUuid = (str?: string) => str ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str) : false;

    const contractToInsert: any = {
      ...contractInfo,
      company_settings_id: isUuid(contractData.company_settings_id) ? contractData.company_settings_id : undefined,
      customer_id: isUuid(contractData.customer_id) ? contractData.customer_id : undefined,
      template_id: isUuid(contractInfo.template_id) ? contractInfo.template_id : undefined,
      contract_type: contractData.contract_type ? String(contractData.contract_type).substring(0, 10) : 'OTHER',
      party_a_vat_number: contractData.party_a_vat_number ? String(contractData.party_a_vat_number).substring(0, 50) : undefined,
      party_a_cro_number: contractData.party_a_cro_number ? String(contractData.party_a_cro_number).substring(0, 50) : undefined,
      party_b_vat_number: contractData.party_b_vat_number ? String(contractData.party_b_vat_number).substring(0, 50) : undefined,
      party_b_cro_number: contractData.party_b_cro_number ? String(contractData.party_b_cro_number).substring(0, 50) : undefined,
      party_a_gstin: contractData.party_a_gstin ? String(contractData.party_a_gstin).substring(0, 15) : undefined,
      party_a_pan: contractData.party_a_pan ? String(contractData.party_a_pan).substring(0, 10) : undefined,
      party_b_gstin: contractData.party_b_gstin ? String(contractData.party_b_gstin).substring(0, 15) : undefined,
      party_b_pan: contractData.party_b_pan ? String(contractData.party_b_pan).substring(0, 10) : undefined,
      contract_number: contractNumber,
      currency_code: contractData.currency_code ? String(contractData.currency_code).substring(0, 5) : 'INR',
      status: 'draft',
      signed_by_party_a: false,
      signed_by_party_b: false,
    };

    if (currentUser?.id) {
      contractToInsert.created_by = currentUser.id;
    }

    // Clean payload of undefined properties and empty strings for UUID/Date/Foreign key fields
    Object.keys(contractToInsert).forEach(key => {
      const val = contractToInsert[key];
      if (val === undefined || val === '') {
        delete contractToInsert[key];
      }
    });

    // Insert contract safely with missing column fallback
    const contract = await this.safeInsertContract(contractToInsert);

    // Insert sections
    if (sections && sections.length > 0) {
      const sectionsToInsert = sections.map(section => ({
        contract_id: contract.id,
        section_number: section.section_number,
        section_title: section.section_title,
        section_content: section.section_content,
        is_required: section.is_required || false,
        page_break_before: section.page_break_before || false
      }));

      const { error: sectionsError } = await supabase
        .from('contract_sections')
        .insert(sectionsToInsert);

      if (sectionsError) {
        console.error('Supabase contract sections insert error:', sectionsError);
        throw new Error(sectionsError.message || sectionsError.details || 'Database error creating contract sections');
      }
    }

    // Insert milestones (if applicable for SOW/Work Orders)
    if (milestones && milestones.length > 0) {
      const milestonesToInsert = milestones.map(milestone => ({
        contract_id: contract.id,
        milestone_number: milestone.milestone_number,
        milestone_title: milestone.milestone_title,
        description: milestone.description,
        deliverables: milestone.deliverables,
        due_date: milestone.due_date,
        payment_amount: milestone.payment_amount || 0,
        status: 'pending'
      }));

      const { error: milestonesError } = await supabase
        .from('contract_milestones')
        .insert(milestonesToInsert);

      if (milestonesError) {
        console.error('Supabase contract milestones insert error:', milestonesError);
        throw new Error(milestonesError.message || milestonesError.details || 'Database error creating contract milestones');
      }
    }

    return contract;
  }

  // =====================================================
  // CONTRACTS - READ
  // =====================================================

  /**
   * Get contracts with filtering and pagination
   */
  async getContracts(
    filters?: ContractFilters,
    page: number = 1,
    perPage: number = 10
  ): Promise<{ contracts: Contract[]; total: number }> {
    if (!isSupabaseConfigured) {
      throw new Error('Database is not configured');
    }

    let query = supabase
      .from('contracts')
      .select('*', { count: 'exact' });

    // Apply filters
    if (filters?.search) {
      query = query.or(`contract_number.ilike.%${filters.search}%,party_b_name.ilike.%${filters.search}%,contract_title.ilike.%${filters.search}%`);
    }

    if (filters?.contract_type) {
      query = query.eq('contract_type', filters.contract_type);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.party_b_name) {
      query = query.ilike('party_b_name', `%${filters.party_b_name}%`);
    }

    if (filters?.date_from) {
      query = query.gte('contract_date', filters.date_from);
    }

    if (filters?.date_to) {
      query = query.lte('contract_date', filters.date_to);
    }

    if (filters?.company_settings_id) {
      query = query.eq('company_settings_id', filters.company_settings_id);
    }

    // Pagination
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    const { data, error, count } = await query
      .order('contract_date', { ascending: false })
      .range(from, to);

    if (error) throw error;

    return {
      contracts: data || [],
      total: count || 0
    };
  }

  /**
   * Get single contract by ID with all details
   */
  async getContractById(id: string): Promise<ContractWithDetails | null> {
    if (!isSupabaseConfigured) {
      throw new Error('Database is not configured');
    }

    // Get contract
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('*')
      .eq('id', id)
      .single();

    if (contractError) throw contractError;
    if (!contract) return null;

    // Get sections
    const { data: sections, error: sectionsError } = await supabase
      .from('contract_sections')
      .select('*')
      .eq('contract_id', id)
      .order('section_number');

    if (sectionsError) throw sectionsError;

    // Get milestones
    const { data: milestones, error: milestonesError } = await supabase
      .from('contract_milestones')
      .select('*')
      .eq('contract_id', id)
      .order('milestone_number');

    if (milestonesError) throw milestonesError;

    // Get attachments
    const { data: attachments, error: attachmentsError } = await supabase
      .from('contract_attachments')
      .select('*')
      .eq('contract_id', id)
      .order('uploaded_at', { ascending: false });

    if (attachmentsError) throw attachmentsError;

    // Get amendments
    const { data: amendments, error: amendmentsError } = await supabase
      .from('contract_amendments')
      .select('*')
      .eq('contract_id', id)
      .order('amendment_number');

    if (amendmentsError) throw amendmentsError;

    // Get template if exists
    let template = null;
    if (contract.template_id) {
      const { data: templateData } = await supabase
        .from('contract_templates')
        .select('*')
        .eq('id', contract.template_id)
        .single();
      template = templateData;
    }

    return {
      ...contract,
      sections: sections || [],
      milestones: milestones || [],
      attachments: attachments || [],
      amendments: amendments || [],
      template
    };
  }

  // =====================================================
  // CONTRACTS - UPDATE
  // =====================================================

  /**
   * Update contract
   */
  async updateContract(contractData: UpdateContractData): Promise<Contract> {
    if (!isSupabaseConfigured) {
      throw new Error('Database is not configured');
    }

    const isUuid = (str?: string) => str ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str) : false;
    const { 
      id, 
      sections, 
      milestones, 
      template_id, 
      ...updateData 
    } = contractData as any;

    const payload: any = {
      ...updateData,
      company_settings_id: isUuid(contractData.company_settings_id) ? contractData.company_settings_id : undefined,
      customer_id: isUuid(contractData.customer_id) ? contractData.customer_id : undefined,
      ...(template_id !== undefined ? { template_id: isUuid(template_id) ? template_id : null } : {}),
      party_a_vat_number: contractData.party_a_vat_number ? String(contractData.party_a_vat_number).substring(0, 50) : undefined,
      party_a_cro_number: contractData.party_a_cro_number ? String(contractData.party_a_cro_number).substring(0, 50) : undefined,
      party_b_vat_number: contractData.party_b_vat_number ? String(contractData.party_b_vat_number).substring(0, 50) : undefined,
      party_b_cro_number: contractData.party_b_cro_number ? String(contractData.party_b_cro_number).substring(0, 50) : undefined,
      party_a_gstin: contractData.party_a_gstin ? String(contractData.party_a_gstin).substring(0, 15) : undefined,
      party_a_pan: contractData.party_a_pan ? String(contractData.party_a_pan).substring(0, 10) : undefined,
      party_b_gstin: contractData.party_b_gstin ? String(contractData.party_b_gstin).substring(0, 15) : undefined,
      party_b_pan: contractData.party_b_pan ? String(contractData.party_b_pan).substring(0, 10) : undefined,
    };

    // Clean payload of undefined properties
    Object.keys(payload).forEach(key => {
      if (payload[key] === undefined) {
        delete payload[key];
      }
    });

    // Update contract safely with missing column fallback
    const contract = await this.safeUpdateContract(id, payload);

    // Update sections if provided
    if (sections) {
      // Delete existing sections
      await supabase
        .from('contract_sections')
        .delete()
        .eq('contract_id', id);

      // Insert new sections
      if (sections.length > 0) {
        const sectionsToInsert = sections.map((section: any) => ({
          contract_id: id,
          section_number: section.section_number,
          section_title: section.section_title,
          section_content: section.section_content,
          is_required: section.is_required || false,
          page_break_before: section.page_break_before || false
        }));

        const { error: sectionsError } = await supabase
          .from('contract_sections')
          .insert(sectionsToInsert);

        if (sectionsError) throw sectionsError;
      }
    }

    // Update milestones if provided
    if (milestones) {
      // Delete existing milestones
      await supabase
        .from('contract_milestones')
        .delete()
        .eq('contract_id', id);

      // Insert new milestones
      if (milestones.length > 0) {
        const milestonesToInsert = milestones.map((milestone: any) => ({
          contract_id: id,
          milestone_number: milestone.milestone_number,
          milestone_title: milestone.milestone_title,
          description: milestone.description,
          deliverables: milestone.deliverables,
          due_date: milestone.due_date,
          payment_amount: milestone.payment_amount || 0
        }));

        const { error: milestonesError } = await supabase
          .from('contract_milestones')
          .insert(milestonesToInsert);

        if (milestonesError) throw milestonesError;
      }
    }

    return contract;
  }

  /**
   * Update contract status
   */
  async updateContractStatus(id: string, status: Contract['status']): Promise<void> {
    if (!isSupabaseConfigured) {
      throw new Error('Database is not configured');
    }

    const { error } = await supabase
      .from('contracts')
      .update({ status })
      .eq('id', id);

    if (error) throw error;
  }

  /**
   * Sign contract
   */
  async signContract(id: string, signedBy: 'party_a' | 'party_b'): Promise<void> {
    if (!isSupabaseConfigured) {
      throw new Error('Database is not configured');
    }

    const field = signedBy === 'party_a' ? 'signed_by_party_a' : 'signed_by_party_b';
    
    const updateData: Partial<Contract> = {
      [field]: true
    };

    // Check if both parties have signed
    const { data: contract } = await supabase
      .from('contracts')
      .select('signed_by_party_a, signed_by_party_b')
      .eq('id', id)
      .single();

    const otherField = signedBy === 'party_a' ? 'signed_by_party_b' : 'signed_by_party_a';
    if (contract && contract[otherField]) {
      updateData.signed_date = new Date().toISOString().split('T')[0];
      updateData.status = 'active';
    }

    const { error } = await supabase
      .from('contracts')
      .update(updateData)
      .eq('id', id);

    if (error) throw error;
  }

  // =====================================================
  // CONTRACTS - DELETE
  // =====================================================

  /**
   * Delete contract
   */
  async deleteContract(id: string): Promise<void> {
    if (!isSupabaseConfigured) {
      throw new Error('Database is not configured');
    }

    const { error } = await supabase
      .from('contracts')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // =====================================================
  // CONTRACT SECTIONS
  // =====================================================

  /**
   * Add section to contract
   */
  async addSection(contractId: string, section: Omit<ContractSection, 'id' | 'contract_id' | 'created_at' | 'updated_at'>): Promise<ContractSection> {
    if (!isSupabaseConfigured) {
      throw new Error('Database is not configured');
    }

    const { data, error } = await supabase
      .from('contract_sections')
      .insert({
        contract_id: contractId,
        ...section
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Reorder sections
   */
  async reorderSections(contractId: string, sectionIds: string[]): Promise<void> {
    if (!isSupabaseConfigured) {
      throw new Error('Database is not configured');
    }

    for (let i = 0; i < sectionIds.length; i++) {
      await supabase
        .from('contract_sections')
        .update({ section_number: i + 1 })
        .eq('id', sectionIds[i])
        .eq('contract_id', contractId);
    }
  }

  // =====================================================
  // STATISTICS
  // =====================================================

  /**
   * Get contract statistics with values converted to target currency (INR for IND entity, EUR for IRL entity)
   */
  async getStatistics(companySettingsId?: string, targetCurrency: string = 'INR'): Promise<ContractStatistics> {
    if (!isSupabaseConfigured) {
      throw new Error('Database is not configured');
    }

    let query = supabase
      .from('contracts')
      .select('status, contract_type, contract_value, currency_code, expiry_date, company_settings_id, contract_number');

    if (companySettingsId) {
      query = query.eq('company_settings_id', companySettingsId);
    }

    const { data: contracts, error } = await query;

    if (error) throw error;

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const stats: ContractStatistics = {
      total_contracts: contracts?.length || 0,
      active_contracts: 0,
      draft_contracts: 0,
      expired_contracts: 0,
      expiring_soon: 0,
      total_contract_value: 0,
      active_contract_value: 0,
      contracts_by_type: {
        MSA: 0,
        SOW: 0,
        NDA: 0,
        SLA: 0,
        WORK_ORDER: 0,
        MAINTENANCE: 0,
        CONSULTING: 0,
        LICENSE: 0,
        OTHER: 0
      }
    };

    for (const contract of contracts || []) {
      // Status counts
      if (contract.status === 'active') stats.active_contracts++;
      if (contract.status === 'draft') stats.draft_contracts++;
      if (contract.status === 'expired') stats.expired_contracts++;

      // Expiring soon
      if (contract.expiry_date) {
        const expiryDate = new Date(contract.expiry_date);
        if (expiryDate >= now && expiryDate <= thirtyDaysFromNow) {
          stats.expiring_soon++;
        }
      }

      // Contract values converted to target currency
      let val = contract.contract_value || 0;
      const contractCurrency = contract.currency_code || 'INR';
      if (val > 0 && contractCurrency !== targetCurrency) {
        try {
          const conversion = await exchangeRateService.convertCurrency(
            val,
            contractCurrency,
            targetCurrency
          );
          if (conversion && typeof conversion.converted_amount === 'number') {
            val = conversion.converted_amount;
          }
        } catch (e) {
          console.warn(`Failed to convert contract value (${contractCurrency} -> ${targetCurrency}):`, e);
        }
      }

      stats.total_contract_value += val;
      if (contract.status === 'active') {
        stats.active_contract_value += val;
      }

      // By type
      if (contract.contract_type) {
        stats.contracts_by_type[contract.contract_type as keyof typeof stats.contracts_by_type]++;
      }
    }

    return stats;
  }
  // Helper to execute insert safely if columns might be missing in schema
  private async safeInsertContract(payload: any) {
    let currentPayload = { ...payload };
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data, error } = await supabase.from('contracts').insert(currentPayload).select().single();
      if (!error) return data;
      if (error.code === 'PGRST204' && error.message) {
        const match = error.message.match(/'([^']+)'/);
        if (match && match[1] && Object.prototype.hasOwnProperty.call(currentPayload, match[1])) {
          delete currentPayload[match[1]];
          continue;
        }
      }
      throw error;
    }
    throw new Error('Failed to insert contract');
  }

  // Helper to execute update safely if columns might be missing in schema
  private async safeUpdateContract(id: string, payload: any) {
    let currentPayload = { ...payload };
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data, error } = await supabase.from('contracts').update(currentPayload).eq('id', id).select().single();
      if (!error) return data;
      if (error.code === 'PGRST204' && error.message) {
        const match = error.message.match(/'([^']+)'/);
        if (match && match[1] && Object.prototype.hasOwnProperty.call(currentPayload, match[1])) {
          delete currentPayload[match[1]];
          continue;
        }
      }
      throw error;
    }
    throw new Error('Failed to update contract');
  }
}

export const contractService = new ContractService();
export default contractService;
