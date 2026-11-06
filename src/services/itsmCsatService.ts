import { supabase, isSupabaseConfigured } from '../config/supabase';
import { ITSMCsatSurvey, ITSMCsatQuestionResponse } from '../types/itsm';

export class ITSMCsatService {
  /**
   * Submit CSAT survey for a resolved ticket supporting up to 5 detailed questions (rating + comments)
   */
  static async submitCsatSurvey(
    ticketId: string,
    customerId: string,
    responsesOrRating: number | ITSMCsatQuestionResponse[],
    feedbackText?: string,
    contactId?: string
  ): Promise<ITSMCsatSurvey> {
    let finalRating = 5;
    let responses: ITSMCsatQuestionResponse[] = [];
    let combinedFeedback = feedbackText || '';

    if (Array.isArray(responsesOrRating)) {
      responses = responsesOrRating;
      if (responses.length > 0) {
        const total = responses.reduce((sum, q) => sum + (q.rating || 5), 0);
        finalRating = Math.round((total / responses.length) * 10) / 10; // e.g. 4.6
      }
      const commentSummary = responses
        .map((r) => r.comment?.trim())
        .filter(Boolean)
        .join(' | ');
      if (commentSummary) {
        combinedFeedback = combinedFeedback
          ? `${combinedFeedback} | ${commentSummary}`
          : commentSummary;
      }
    } else {
      finalRating = Math.min(5, Math.max(1, responsesOrRating));
    }

    const payload = {
      ticket_id: ticketId,
      customer_id: customerId,
      contact_id: contactId || null,
      rating: Math.min(5, Math.max(1, Math.round(finalRating))), // Integer 1-5 for DB column check
      feedback_text: combinedFeedback || null,
      responses: responses,
      submitted_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('itsm_csat_surveys')
          .insert([payload])
          .select()
          .single();

        if (error) {
          console.error('Failed to submit CSAT survey:', error);
          throw error;
        }

        return data as ITSMCsatSurvey;
      } catch (err) {
        console.error('ITSMCsatService.submitCsatSurvey DB error:', err);
      }
    }

    return {
      id: `csat-${Date.now()}`,
      ...payload,
    };
  }

  /**
   * Fetch CSAT survey for a ticket
   */
  static async getCsatSurveyForTicket(ticketId: string): Promise<ITSMCsatSurvey | null> {
    if (!isSupabaseConfigured) return null;

    try {
      const { data, error } = await supabase
        .from('itsm_csat_surveys')
        .select('*')
        .eq('ticket_id', ticketId)
        .maybeSingle();

      if (error) throw error;
      return data as ITSMCsatSurvey | null;
    } catch (err) {
      console.error('ITSMCsatService.getCsatSurveyForTicket error:', err);
      return null;
    }
  }

  /**
   * Get average CSAT rating across company entity
   */
  static async getAverageCsat(companySettingsId?: string | null): Promise<{ avgRating: number; count: number }> {
    if (!isSupabaseConfigured) return { avgRating: 0, count: 0 };

    try {
      let query = supabase.from('itsm_csat_surveys').select('rating, ticket:ticket_id!inner(company_settings_id)');

      if (companySettingsId) {
        query = query.eq('ticket.company_settings_id', companySettingsId);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) return { avgRating: 0, count: 0 };

      const total = data.reduce((acc, row) => acc + (row.rating || 0), 0);
      const avg = Number((total / data.length).toFixed(1));
      return { avgRating: avg, count: data.length };
    } catch (err) {
      console.error('ITSMCsatService.getAverageCsat error:', err);
      return { avgRating: 0, count: 0 };
    }
  }
}

export default ITSMCsatService;
