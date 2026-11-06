import { supabase, isSupabaseConfigured } from '../config/supabase';
import { simpleAuth } from '../utils/simpleAuth';
import { quoteService } from './quoteService';
import { invoiceService } from './invoiceService';
import { exchangeRateService } from './exchangeRateService';
import type {
  Opportunity,
  OpportunityStage,
  CreateOpportunityData,
  UpdateOpportunityData,
  OpportunityFilters,
  OpportunityStats,
  PaginatedResponse,
  Lead,
  QuoteHandoffPayload,
  QuoteHandoffItem
} from '../types/lead';

class OpportunityService {
  async getOpportunityStats(companySettingsId?: string, targetCurrency: string = 'INR'): Promise<OpportunityStats> {
    let query = supabase
      .from('opportunities')
      .select('stage, estimated_value, currency_code, created_at, company_settings_id');
    
    if (companySettingsId) {
      query = query.eq('company_settings_id', companySettingsId);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    
    const now = new Date();
    let totalPipelineValue = 0;
    let openPipelineValue = 0;
    
    for (const o of data || []) {
      let val = Number(o.estimated_value) || 0;
      const curr = o.currency_code || 'INR';
      if (val > 0 && curr !== targetCurrency) {
        try {
          const conversion = await exchangeRateService.convertCurrency(val, curr, targetCurrency);
          if (conversion && typeof conversion.converted_amount === 'number') {
            val = conversion.converted_amount;
          }
        } catch (e) {
          console.warn(`Failed to convert opportunity estimated value (${curr} -> ${targetCurrency}):`, e);
        }
      }
      totalPipelineValue += val;
      if (!['closed_won', 'closed_lost'].includes(o.stage)) {
        openPipelineValue += val;
      }
    }

    return {
      total_opportunities: data?.length || 0,
      prospecting_opportunities: data?.filter(o => o.stage === 'prospecting').length || 0,
      qualification_opportunities: data?.filter(o => o.stage === 'qualification').length || 0,
      proposal_opportunities: data?.filter(o => o.stage === 'proposal').length || 0,
      negotiation_opportunities: data?.filter(o => o.stage === 'negotiation').length || 0,
      closed_won_opportunities: data?.filter(o => o.stage === 'closed_won').length || 0,
      closed_lost_opportunities: data?.filter(o => o.stage === 'closed_lost').length || 0,
      total_pipeline_value: totalPipelineValue,
      open_pipeline_value: openPipelineValue,
      this_month_opportunities: data?.filter(o => {
        const d = new Date(o.created_at);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length || 0,
      this_year_opportunities: data?.filter(o => {
        const d = new Date(o.created_at);
        return d.getFullYear() === now.getFullYear();
      }).length || 0
    };
  }

  async getOpportunities(filters?: OpportunityFilters, page: number = 1, perPage: number = 20): Promise<PaginatedResponse<Opportunity>> {
    let query = supabase
      .from('opportunities')
      .select(`
        *,
        lead:leads!opportunities_lead_id_fkey(*),
        customer:customers(*),
        company_settings:company_settings(*)
      `, { count: 'exact' });

    if (filters) {
      if (filters.search) {
        query = query.or(`opportunity_number.ilike.%${filters.search}%,opportunity_name.ilike.%${filters.search}%`);
      }
      if (filters.stage) {
        query = query.eq('stage', filters.stage);
      }
      if (filters.customer_id) {
        query = query.eq('customer_id', filters.customer_id);
      }
      if (filters.company_settings_id) {
        query = query.eq('company_settings_id', filters.company_settings_id);
      }
      if (filters.lead_id) {
        query = query.eq('lead_id', filters.lead_id);
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

  async getOpportunityById(id: string): Promise<Opportunity | null> {
    const { data, error } = await supabase
      .from('opportunities')
      .select(`
        *,
        lead:leads!opportunities_lead_id_fkey(*),
        customer:customers(*),
        company_settings:company_settings(*)
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  }

  async createOpportunity(opportunityData: CreateOpportunityData): Promise<Opportunity> {
    if (!isSupabaseConfigured) {
      throw new Error('Database is not configured');
    }

    const currentUser = await simpleAuth.getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const opportunityNumber = await this.generateOpportunityNumber();

    const { data, error } = await supabase
      .from('opportunities')
      .insert({
        ...opportunityData,
        opportunity_number: opportunityNumber,
        created_by: currentUser.id,
        stage: opportunityData.stage || 'prospecting',
        probability: opportunityData.probability ?? 10,
        currency_code: opportunityData.currency_code || 'INR',
        estimated_value: opportunityData.estimated_value || 0
      })
      .select(`
        *,
        lead:leads!opportunities_lead_id_fkey(*),
        customer:customers(*),
        company_settings:company_settings(*)
      `)
      .single();
    
    if (error) throw error;
    return data;
  }

  async updateOpportunity(id: string, opportunityData: UpdateOpportunityData): Promise<Opportunity> {
    const { data, error } = await supabase
      .from('opportunities')
      .update({
        ...opportunityData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        lead:leads!opportunities_lead_id_fkey(*),
        customer:customers(*),
        company_settings:company_settings(*)
      `)
      .single();
    
    if (error) throw error;
    return data;
  }

  async updateOpportunityStage(id: string, stage: OpportunityStage, metadata?: {
    actual_close_date?: string;
    loss_reason?: string;
  }): Promise<Opportunity> {
    const updateData: any = {
      stage,
      updated_at: new Date().toISOString()
    };

    if (stage === 'closed_won') {
      updateData.actual_close_date = new Date().toISOString().split('T')[0];
      updateData.probability = 100;
    } else if (stage === 'closed_lost') {
      updateData.probability = 0;
      if (metadata?.loss_reason) {
        updateData.loss_reason = metadata.loss_reason;
      }
    }

    if (metadata?.actual_close_date) {
      updateData.actual_close_date = metadata.actual_close_date;
    }

    const { data, error } = await supabase
      .from('opportunities')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        lead:leads!opportunities_lead_id_fkey(*),
        customer:customers(*),
        company_settings:company_settings(*)
      `)
      .single();
    
    if (error) throw error;
    return data;
  }

  async deleteOpportunity(id: string): Promise<void> {
    const { error } = await supabase
      .from('opportunities')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }

  async convertLeadToOpportunity(leadId: string, opportunityData: Partial<CreateOpportunityData>): Promise<Opportunity> {
    const lead = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (lead.error) throw lead.error;
    if (!lead.data) throw new Error('Lead not found');

    const leadRecord = lead.data as Lead;

    // Resolve or auto-create Customer association
    let customerId = leadRecord.customer_id;
    if (!customerId) {
      if (opportunityData.customer_id) {
        customerId = opportunityData.customer_id;
      } else {
        const companyName = leadRecord.company_name || `${leadRecord.first_name} ${leadRecord.last_name}`;
        const newCust = await invoiceService.createCustomer({
          company_name: companyName,
          contact_person: `${leadRecord.first_name} ${leadRecord.last_name}`.trim(),
          email: leadRecord.email || '',
          phone: leadRecord.phone || '',
          address_line1: leadRecord.address_line1 || '',
          address_line2: leadRecord.address_line2 || '',
          city: leadRecord.city || '',
          state: leadRecord.state || '',
          postal_code: leadRecord.postal_code || '',
          country_id: leadRecord.country_id || 'IN',
          company_settings_id: leadRecord.company_settings_id || undefined,
          gstin: leadRecord.gstin || undefined,
          pan: leadRecord.pan || undefined
        });

        customerId = newCust.id;

        await supabase
          .from('leads')
          .update({ customer_id: customerId })
          .eq('id', leadId);
      }
    }

    const opportunity = await this.createOpportunity({
      ...opportunityData,
      lead_id: leadId,
      source_lead_id: leadId,
      customer_id: customerId || '',
      company_settings_id: leadRecord.company_settings_id || opportunityData.company_settings_id || undefined,
      opportunity_name: opportunityData.opportunity_name || `${leadRecord.company_name || `${leadRecord.first_name} ${leadRecord.last_name}`} - Opportunity`,
      estimated_value: opportunityData.estimated_value ?? leadRecord.budget_max ?? leadRecord.budget_min ?? 0,
      currency_code: opportunityData.currency_code || leadRecord.currency_code || 'INR',
      expected_close_date: opportunityData.expected_close_date || leadRecord.expected_close_date || undefined,
      description: opportunityData.description || leadRecord.description || undefined,
      stage: opportunityData.stage || 'prospecting'
    });

    await supabase
      .from('leads')
      .update({
        status: 'converted',
        converted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', leadId);

    try {
      await supabase.from('lead_activities').insert({
        lead_id: leadId,
        opportunity_id: opportunity.id,
        activity_type: 'status_change',
        subject: 'Lead Converted to Draft Opportunity',
        description: `Lead was converted to Opportunity ${opportunity.opportunity_number}`
      });
    } catch (actErr) {
      console.warn('Could not record conversion activity log:', actErr);
    }

    return opportunity;
  }

  async convertOpportunityToQuote(
    opportunityId: string, 
    quotePayload: Partial<QuoteHandoffPayload>,
    allowAdminOverride: boolean = true
  ): Promise<{ quoteId: string; quoteNumber: string }> {
    const opportunity = await this.getOpportunityById(opportunityId);
    if (!opportunity) {
      throw new Error('Opportunity not found');
    }

    if (!allowAdminOverride && opportunity.stage !== 'closed_won') {
      throw new Error('Only closed-won opportunities can be converted to quotes without admin override');
    }

    const lead = opportunity.lead;
    const customer = opportunity.customer;

    if (!customer) {
      throw new Error('Opportunity must be associated with a customer to create a quote');
    }

    const quoteNumber = await quoteService.generateQuoteNumber();

    const quoteItems: QuoteHandoffItem[] = quotePayload.items?.length ? quotePayload.items : [
      {
        item_name: opportunity.opportunity_name || 'Services',
        description: quotePayload.project_title || opportunity.description || 'Professional services based on Opportunity details',
        quantity: 1,
        unit: 'pcs',
        unit_price: opportunity.estimated_value || 0,
        tax_rate: quotePayload.default_tax_rate || 18
      }
    ];

    const defaultValidUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const quoteData = {
      customer_id: customer.id,
      company_settings_id: opportunity.company_settings_id || customer.company_settings_id || undefined,
      quote_date: new Date().toISOString().split('T')[0],
      valid_until: quotePayload.terms_conditions && !quotePayload.items ? '' : defaultValidUntil,
      project_title: quotePayload.project_title || opportunity.opportunity_name,
      estimated_time: quotePayload.estimated_time || '',
      company_contact_name: quotePayload.company_contact_name || (lead ? `${lead.first_name} ${lead.last_name}` : customer.contact_person || ''),
      company_contact_email: quotePayload.company_contact_email || lead?.email || customer.email || '',
      company_contact_phone: quotePayload.company_contact_phone || lead?.phone || customer.phone || '',
      notes: quotePayload.notes || opportunity.description || '',
      terms_conditions: quotePayload.terms_conditions || '',
      items: quoteItems.map(item => ({
        product_id: item.product_id,
        item_name: item.item_name,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
        hsn_code: item.hsn_code,
        billable_hours: item.billable_hours,
        resource_count: item.resource_count,
        is_service_item: item.is_service_item || false
      }))
    };

    const quote = await quoteService.createQuote(quoteData, quoteNumber, opportunity.company_settings_id || customer.company_settings_id || undefined);

    await supabase
      .from('opportunities')
      .update({
        converted_to_quote_id: quote.id,
        converted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', opportunityId);

    try {
      await supabase.from('lead_activities').insert({
        opportunity_id: opportunityId,
        lead_id: opportunity.lead_id || undefined,
        activity_type: 'status_change',
        subject: 'Opportunity Converted to Draft Quote',
        description: `Draft Quote ${quote.quote_number} was generated from Opportunity ${opportunity.opportunity_number}`
      });
    } catch (actErr) {
      console.warn('Could not record quote conversion activity:', actErr);
    }

    return {
      quoteId: quote.id,
      quoteNumber: quote.quote_number
    };
  }

  async generateOpportunityNumber(): Promise<string> {
    if (!isSupabaseConfigured) {
      throw new Error('Database is not configured');
    }

    const { data, error } = await supabase
      .rpc('get_next_lead_opportunity_number', { p_record_type: 'opportunity' });
    
    if (error) throw error;
    if (!data || typeof data !== 'string') {
      throw new Error('Failed to generate opportunity number');
    }
    
    return data;
  }

  async getOpportunitiesForEntity(companySettingsId: string): Promise<Opportunity[]> {
    const { data, error } = await supabase
      .from('opportunities')
      .select(`
        *,
        lead:leads!opportunities_lead_id_fkey(*),
        customer:customers(*),
        company_settings:company_settings(*)
      `)
      .eq('company_settings_id', companySettingsId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }

  async bulkUpdateStage(ids: string[], stage: OpportunityStage): Promise<void> {
    const { error } = await supabase
      .from('opportunities')
      .update({
        stage,
        updated_at: new Date().toISOString()
      })
      .in('id', ids);
    
    if (error) throw error;
  }
}

export const opportunityService = new OpportunityService();
