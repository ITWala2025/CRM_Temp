import { supabase } from '../config/supabase';
import { simpleAuth } from '../utils/simpleAuth';
import { invoiceService } from './invoiceService';
import type {
  SubscriptionPlan,
  CustomerSubscription,
  CreateSubscriptionPlanData,
  CreateCustomerSubscriptionData,
  SubscriptionFilters,
} from '../types/subscription';

class SubscriptionService {
  // ── Plans ──────────────────────────────────────────────────────────────────

  async getPlans(includeInactive = false, companySettingsId?: string): Promise<SubscriptionPlan[]> {
    let query = supabase
      .from('subscription_plans')
      .select('*')
      .order('name');

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) throw error;
    let plans: SubscriptionPlan[] = data || [];

    if (companySettingsId) {
      plans = plans.filter(p => !p.company_settings_id || p.company_settings_id === companySettingsId);
    }

    return plans;
  }

  async getPlanById(id: string): Promise<SubscriptionPlan | null> {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  }

  async createPlan(plan: CreateSubscriptionPlanData): Promise<SubscriptionPlan> {
    const { data, error } = await supabase
      .from('subscription_plans')
      .insert({ ...plan, is_active: true })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async updatePlan(id: string, plan: Partial<CreateSubscriptionPlanData>): Promise<SubscriptionPlan> {
    const { data, error } = await supabase
      .from('subscription_plans')
      .update({ ...plan, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async deactivatePlan(id: string): Promise<void> {
    const { error } = await supabase
      .from('subscription_plans')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  }

  // ── ID Generation & Deduplication ──────────────────────────────────────────

  /**
   * Generates a unique subscription number adhering to SUB/<COUNTRY_CODE>/YYYY/MM/XXX format.
   * Resolves country code based on companySettingsId (IND for India, IRL for Ireland, etc.).
   */
  async generateSubscriptionNumber(companySettingsId?: string, dateStr?: string): Promise<string> {
    const dateObj = dateStr ? new Date(dateStr) : new Date();
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1;
    const monthStr = month.toString().padStart(2, '0');

    let countryCode = 'IND';

    if (companySettingsId) {
      try {
        const { data } = await supabase
          .from('company_settings')
          .select('country:countries(code)')
          .eq('id', companySettingsId)
          .single();

        const countryObj = Array.isArray(data?.country) ? data.country[0] : data?.country;
        if (countryObj && typeof countryObj === 'object' && 'code' in countryObj) {
          const rawCode = (countryObj as { code?: string }).code?.toUpperCase();
          if (rawCode === 'IN' || rawCode === 'IND') countryCode = 'IND';
          else if (rawCode === 'IE' || rawCode === 'IRL') countryCode = 'IRL';
          else if (rawCode) countryCode = rawCode;
        }
      } catch {
        // Fallback to IND
      }
    }

    try {
      const { data, error } = await supabase.rpc('get_next_subscription_number', {
        p_country_code: countryCode,
        p_year: year,
        p_month: month,
      });
      if (!error && data) return data;
    } catch {
      // Fallback if RPC fails or does not exist yet
    }

    // Fallback: Query max number for prefix SUB/IND/2026/08/
    const prefix = `SUB/${countryCode}/${year}/${monthStr}/`;
    const { data: subs } = await supabase
      .from('customer_subscriptions')
      .select('subscription_number')
      .like('subscription_number', `${prefix}%`)
      .order('subscription_number', { ascending: false })
      .limit(10);

    let maxSeq = 0;
    if (subs && subs.length > 0) {
      for (const s of subs) {
        if (s.subscription_number) {
          const parts = s.subscription_number.split('/');
          if (parts.length === 5) {
            const num = parseInt(parts[4], 10);
            if (!isNaN(num) && num > maxSeq) maxSeq = num;
          }
        }
      }
    }

    const nextVal = (maxSeq + 1).toString().padStart(3, '0');
    return `${prefix}${nextVal}`;
  }

  /**
   * Validates that a customer does not have an active/draft/paused subscription for the same plan
   * in an overlapping timeframe.
   */
  async validateNoDuplicateSubscription(
    customerId: string,
    planId: string,
    startDate: string,
    endDate?: string | null,
    excludeSubId?: string,
  ): Promise<void> {
    const { data: existing, error } = await supabase
      .from('customer_subscriptions')
      .select('id, subscription_number, status, start_date, end_date')
      .eq('customer_id', customerId)
      .eq('plan_id', planId)
      .in('status', ['active', 'paused', 'draft']);

    if (error) throw error;
    if (!existing || existing.length === 0) return;

    const candStart = new Date(startDate).getTime();
    const candEnd = endDate ? new Date(endDate).getTime() : Infinity;

    for (const sub of existing) {
      if (excludeSubId && sub.id === excludeSubId) continue;

      const existStart = new Date(sub.start_date).getTime();
      const existEnd = sub.end_date ? new Date(sub.end_date).getTime() : Infinity;

      // Overlap condition: candStart <= existEnd && candEnd >= existStart
      if (candStart <= existEnd && candEnd >= existStart) {
        const subLabel = sub.subscription_number || sub.id.slice(0, 8);
        const timeframeStr = sub.end_date
          ? `${sub.start_date} to ${sub.end_date}`
          : `from ${sub.start_date} (ongoing)`;
        throw new Error(
          `Customer already has an active or draft subscription (${subLabel}) for this plan during an overlapping timeframe (${timeframeStr}).`,
        );
      }
    }
  }

  // ── Subscriptions ──────────────────────────────────────────────────────────

  async getSubscriptions(filters?: SubscriptionFilters): Promise<CustomerSubscription[]> {
    let query = supabase
      .from('customer_subscriptions')
      .select(`
        *,
        customer:customers(id, company_name, contact_person, email, customer_code, company_settings_id),
        plan:subscription_plans(*),
        source_subscription:customer_subscriptions!source_subscription_id(id, subscription_number)
      `)
      .order('created_at', { ascending: false });

    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.customer_id) query = query.eq('customer_id', filters.customer_id);
    if (filters?.plan_id) query = query.eq('plan_id', filters.plan_id);

    const { data, error } = await query;
    if (error) throw error;
    let results: CustomerSubscription[] = data || [];

    // Filter by company_settings_id via subscription or customer relation if entity filter is provided
    if (filters?.company_settings_id) {
      results = results.filter(sub => 
        (!sub.company_settings_id && !sub.customer?.company_settings_id) ||
        sub.company_settings_id === filters.company_settings_id ||
        sub.customer?.company_settings_id === filters.company_settings_id
      );
    }

    return results;
  }

  async getSubscriptionById(id: string): Promise<CustomerSubscription | null> {
    const { data, error } = await supabase
      .from('customer_subscriptions')
      .select(`
        *,
        customer:customers(id, company_name, contact_person, email),
        plan:subscription_plans(*),
        source_subscription:customer_subscriptions!source_subscription_id(id, subscription_number)
      `)
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  }

  async createSubscription(sub: CreateCustomerSubscriptionData): Promise<CustomerSubscription> {
    const currentUser = await simpleAuth.getCurrentUser();
    if (!currentUser) throw new Error('User not authenticated');

    const plan = await this.getPlanById(sub.plan_id);
    if (!plan) throw new Error('Plan not found');

    const targetStatus = sub.status || 'active';

    // Deduplication check for active, paused, or draft subscriptions
    if (targetStatus === 'active' || targetStatus === 'draft' || targetStatus === 'paused') {
      await this.validateNoDuplicateSubscription(
        sub.customer_id,
        sub.plan_id,
        sub.start_date,
        sub.end_date,
      );
    }

    // Auto-generate subscription_number if not provided
    const subscriptionNumber =
      sub.subscription_number ||
      (await this.generateSubscriptionNumber(sub.company_settings_id, sub.start_date));

    const nextBillingDate = this.calculateNextBillingDate(
      sub.start_date,
      plan.billing_interval,
    );

    const { data, error } = await supabase
      .from('customer_subscriptions')
      .insert({
        subscription_number: subscriptionNumber,
        customer_id: sub.customer_id,
        plan_id: sub.plan_id,
        status: targetStatus,
        start_date: sub.start_date,
        end_date: sub.end_date || null,
        next_billing_date: nextBillingDate,
        notes: sub.notes || null,
        company_settings_id: sub.company_settings_id || null,
        source_subscription_id: sub.source_subscription_id || null,
        created_by: currentUser.id,
      })
      .select(`
        *,
        customer:customers(id, company_name, contact_person, email),
        plan:subscription_plans(*),
        source_subscription:customer_subscriptions!source_subscription_id(id, subscription_number)
      `)
      .single();
    if (error) throw error;
    return data;
  }

  /**
   * Clone an existing subscription into a new DRAFT status with a new unique Subscription ID.
   */
  async cloneSubscription(sourceSubId: string): Promise<CustomerSubscription> {
    const sourceSub = await this.getSubscriptionById(sourceSubId);
    if (!sourceSub) throw new Error('Source subscription not found');

    const today = new Date().toISOString().split('T')[0];
    const newSubNumber = await this.generateSubscriptionNumber(sourceSub.company_settings_id, today);

    const sourceLabel = sourceSub.subscription_number || sourceSub.id.slice(0, 8);
    const cloneNote = `Cloned from ${sourceLabel}.${sourceSub.notes ? `\n\nOriginal Notes: ${sourceSub.notes}` : ''}`;

    return this.createSubscription({
      customer_id: sourceSub.customer_id,
      plan_id: sourceSub.plan_id,
      start_date: today,
      end_date: sourceSub.end_date || undefined,
      notes: cloneNote,
      company_settings_id: sourceSub.company_settings_id,
      status: 'draft',
      subscription_number: newSubNumber,
      source_subscription_id: sourceSub.id,
    });
  }

  /**
   * Activate a draft or paused subscription.
   */
  async activateSubscription(id: string): Promise<CustomerSubscription> {
    const sub = await this.getSubscriptionById(id);
    if (!sub) throw new Error('Subscription not found');

    // Run deduplication validation before activating
    await this.validateNoDuplicateSubscription(
      sub.customer_id,
      sub.plan_id,
      sub.start_date,
      sub.end_date,
      id,
    );

    const plan = sub.plan || (await this.getPlanById(sub.plan_id));
    if (!plan) throw new Error('Subscription plan not found');

    const today = new Date().toISOString().split('T')[0];
    const startDate = sub.start_date < today ? today : sub.start_date;
    const nextBillingDate = this.calculateNextBillingDate(startDate, plan.billing_interval);

    const { data, error } = await supabase
      .from('customer_subscriptions')
      .update({
        status: 'active',
        start_date: startDate,
        next_billing_date: nextBillingDate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`
        *,
        customer:customers(id, company_name, contact_person, email),
        plan:subscription_plans(*),
        source_subscription:customer_subscriptions!source_subscription_id(id, subscription_number)
      `)
      .single();
    if (error) throw error;
    return data;
  }

  async deleteSubscription(id: string): Promise<void> {
    const { error } = await supabase
      .from('customer_subscriptions')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  async updateSubscriptionStatus(
    id: string,
    status: CustomerSubscription['status'],
  ): Promise<CustomerSubscription> {
    if (status === 'active') {
      return this.activateSubscription(id);
    }

    const { data, error } = await supabase
      .from('customer_subscriptions')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(`
        *,
        customer:customers(id, company_name, contact_person, email),
        plan:subscription_plans(*),
        source_subscription:customer_subscriptions!source_subscription_id(id, subscription_number)
      `)
      .single();
    if (error) throw error;
    return data;
  }

  async updateNextBillingDate(id: string, nextDate: string): Promise<void> {
    const { error } = await supabase
      .from('customer_subscriptions')
      .update({ next_billing_date: nextDate, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  }

  async updateSubscription(
    id: string,
    data: { plan_id?: string; end_date?: string | null; notes?: string; next_billing_date?: string },
  ): Promise<CustomerSubscription> {
    const existing = await this.getSubscriptionById(id);
    if (!existing) throw new Error('Subscription not found');

    const targetPlanId = data.plan_id || existing.plan_id;
    const targetEndDate = data.end_date !== undefined ? data.end_date : existing.end_date;

    if (existing.status === 'active' || existing.status === 'draft' || existing.status === 'paused') {
      await this.validateNoDuplicateSubscription(
        existing.customer_id,
        targetPlanId,
        existing.start_date,
        targetEndDate,
        id,
      );
    }

    const { data: result, error } = await supabase
      .from('customer_subscriptions')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(`
        *,
        customer:customers(id, company_name, contact_person, email),
        plan:subscription_plans(*),
        source_subscription:customer_subscriptions!source_subscription_id(id, subscription_number)
      `)
      .single();
    if (error) throw error;
    return result;
  }

  /** Returns active subscriptions whose end_date is within the next `daysAhead` days. */
  getExpiringSoon(subscriptions: CustomerSubscription[], daysAhead = 30): CustomerSubscription[] {
    const now = new Date();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + daysAhead);
    return subscriptions.filter(s => {
      if (s.status !== 'active' || !s.end_date) return false;
      const end = new Date(s.end_date);
      return end >= now && end <= cutoff;
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  calculateNextBillingDate(fromDate: string, interval: 'monthly' | 'annual'): string {
    const d = new Date(fromDate);
    if (interval === 'monthly') {
      d.setMonth(d.getMonth() + 1);
    } else {
      d.setFullYear(d.getFullYear() + 1);
    }
    return d.toISOString().split('T')[0];
  }

  /** Returns active monthly subscriptions whose next_billing_date is today or past. */
  async getDueSubscriptions(): Promise<CustomerSubscription[]> {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('customer_subscriptions')
      .select(`
        *,
        customer:customers(id, company_name, contact_person, email),
        plan:subscription_plans(*)
      `)
      .eq('status', 'active')
      .lte('next_billing_date', today);
    if (error) throw error;
    return data || [];
  }

  /**
   * Generate a draft invoice from a subscription.
   * Creates a draft invoice populated with subscription details
   * and links it via subscription_id.
   *
   * Passes the subscription's company_settings_id so the correct
   * company entity is used.  The plan's own currency_code is used
   * as a currency override to avoid exchange-rate failures when the
   * customer's country currency differs from the plan currency.
   */
  async generateDraftInvoice(subscriptionId: string): Promise<any> {
    const subscription = await this.getSubscriptionById(subscriptionId);
    if (!subscription) throw new Error('Subscription not found');
    if (subscription.status !== 'active') throw new Error('Subscription must be active to generate an invoice');
    if (!subscription.plan) throw new Error('Subscription plan not found');
    if (!subscription.customer_id) throw new Error('Subscription has no associated customer');

    const plan = subscription.plan;

    // Determine the invoice date. The Invoice Management UI rejects any
    // invoice_date later than today ("Invoice date cannot be in the
    // future"), so if this subscription's next_billing_date is still
    // upcoming (e.g. generating an invoice ahead of schedule), issue the
    // invoice today instead — otherwise admins could never save/finalize
    // the resulting draft invoice. The subscription's actual billing cycle
    // (next_billing_date) is preserved separately below.
    const today = new Date().toISOString().split('T')[0];
    const scheduledBillingDate = subscription.next_billing_date || today;
    const invoiceDate = scheduledBillingDate <= today ? scheduledBillingDate : today;

    // Calculate due date (15 days from invoice date)
    const dueDate = new Date(invoiceDate);
    dueDate.setDate(dueDate.getDate() + 15);

    // Build line item from subscription plan
    const itemName = `${plan.name} - ${plan.billing_interval === 'monthly' ? 'Monthly' : 'Annual'} Subscription`;
    const itemDescription = `Subscription to ${plan.name} plan (${plan.billing_interval}).${plan.description ? ` ${plan.description}` : ''}`;

    const invoiceData = {
      customer_id: subscription.customer_id,
      invoice_date: invoiceDate,
      due_date: dueDate.toISOString().split('T')[0],
      notes: `Auto-generated from subscription ${subscription.subscription_number || subscription.id}`,
      terms_conditions: subscription.notes || '',
      subscription_id: subscription.id,
      // Use the plan's currency so we don't depend on a live exchange-rate
      // lookup against the customer's country currency.
      currency_code_override: plan.currency_code,
      items: [
        {
          item_name: itemName,
          description: itemDescription,
          quantity: 1,
          unit: 'svc',
          unit_price: plan.price,
          tax_rate: 0,
        },
      ],
    };

    // Pass the subscription's company_settings_id so the correct
    // company entity (and invoice number sequence) is used.
    const invoice = await invoiceService.createInvoice(
      invoiceData,
      undefined,
      subscription.company_settings_id || undefined,
    );

    // Advance the subscription's next_billing_date from its originally
    // scheduled date (not the possibly-earlier invoice issue date) so the
    // billing cadence is preserved even when invoicing ahead of schedule.
    const newNextBillingDate =
      plan.billing_interval === 'monthly'
        ? this.calculateNextBillingDate(scheduledBillingDate, 'monthly')
        : this.calculateNextBillingDate(scheduledBillingDate, 'annual');

    await this.updateNextBillingDate(subscriptionId, newNextBillingDate);

    return invoice;
  }
}

export const subscriptionService = new SubscriptionService();
