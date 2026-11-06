import { supabase, isSupabaseConfigured, isMockMode } from '../config/supabase';
import { mockStore } from '../data/mockStore';
import type {
  RateCardTemplate,
  CostHeadType,
  QuoteRateCard,
  CreateRateCardTemplateData,
  UpdateRateCardTemplateData,
  CreateCostHeadTypeData,
  UpdateCostHeadTypeData,
  CreateQuoteRateCardData,
  UpdateQuoteRateCardData,
  RateCardFilters,
  RateCardStats,
} from '../types/rateCard';

class RateCardService {
  // ==================== Rate Card Templates ====================

  async getRateCardTemplates(filters?: RateCardFilters): Promise<RateCardTemplate[]> {
    if (isMockMode) {
      let list = mockStore.get<RateCardTemplate>('rate_cards');
      if (filters?.category) list = list.filter((r) => r.category === filters.category);
      if (filters?.resource_level) list = list.filter((r) => r.resource_level === filters.resource_level);
      if (filters?.is_active !== undefined) list = list.filter((r) => r.is_active === filters.is_active);
      if (filters?.search) {
        const s = filters.search.toLowerCase();
        list = list.filter((r) => r.template_name.toLowerCase().includes(s) || (r.description && r.description.toLowerCase().includes(s)));
      }
      return list;
    }

    let query = supabase
      .from('rate_card_templates')
      .select('*')
      .order('category', { ascending: true })
      .order('resource_level', { ascending: true });

    if (filters?.category) query = query.eq('category', filters.category);
    if (filters?.resource_level) query = query.eq('resource_level', filters.resource_level);
    if (filters?.is_active !== undefined) query = query.eq('is_active', filters.is_active);

    const { data, error } = await query;
    if (error) return [];
    return data || [];
  }

  async getRateCardTemplateById(id: string): Promise<RateCardTemplate | null> {
    if (isMockMode) {
      return mockStore.getById<RateCardTemplate>('rate_cards', id) || null;
    }
    const { data, error } = await supabase.from('rate_card_templates').select('*').eq('id', id).single();
    if (error) return null;
    return data;
  }

  async createRateCardTemplate(data: CreateRateCardTemplateData): Promise<RateCardTemplate> {
    if (isMockMode) {
      return mockStore.insert<RateCardTemplate>('rate_cards', {
        ...data,
        is_active: true,
      } as any);
    }
    const { data: created, error } = await supabase.from('rate_card_templates').insert(data).select().single();
    if (error) throw error;
    return created;
  }

  async updateRateCardTemplate(id: string, data: UpdateRateCardTemplateData): Promise<RateCardTemplate> {
    if (isMockMode) {
      return mockStore.update<RateCardTemplate>('rate_cards', id, data);
    }
    const { data: updated, error } = await supabase.from('rate_card_templates').update(data).eq('id', id).select().single();
    if (error) throw error;
    return updated;
  }

  async deleteRateCardTemplate(id: string): Promise<boolean> {
    if (isMockMode) {
      return mockStore.delete('rate_cards', id);
    }
    const { error } = await supabase.from('rate_card_templates').delete().eq('id', id);
    return !error;
  }

  async getCostHeadTypes(): Promise<CostHeadType[]> {
    return [];
  }

  async getQuoteRateCards(quoteId: string): Promise<QuoteRateCard[]> {
    return [];
  }

  async createQuoteRateCard(data: CreateQuoteRateCardData): Promise<QuoteRateCard> {
    return {} as QuoteRateCard;
  }

  async deleteQuoteRateCard(id: string): Promise<boolean> {
    return true;
  }
}

export const rateCardService = new RateCardService();
export default rateCardService;
