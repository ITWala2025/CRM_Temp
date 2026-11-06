// =====================================================
// Payment Service - Core Data Access Layer
// =====================================================
// Centralized service for all payment gateway operations
// Handles CRUD operations, analytics, and business logic

import { supabase } from '../config/supabase';
import type { 
  PaymentGateway,
  PaymentRequest,
  PaymentTransaction,
  PaymentLink,
  PaymentWebhook,
  ExchangeRate,
  CreatePaymentRequestData,
  UpdatePaymentRequestData,
  CreatePaymentLinkData,
  PaymentFilters,
  PaymentAnalytics,
  PaginatedResponse,
  InvoicePaymentData
} from '../types/payment';

class PaymentService {
  // =====================================================
  // PAYMENT GATEWAYS
  // =====================================================

  async getPaymentGateways(): Promise<PaymentGateway[]> {
    // First check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      // If not authenticated, only return active gateways (public view)
      const { data, error } = await supabase
        .from('payment_gateways')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw new Error(`Failed to fetch payment gateways: ${error.message}`);
      return data || [];
    }

    // If authenticated, try to get all gateways (should work with the management policy)
    const { data, error } = await supabase
      .from('payment_gateways')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      // If the authenticated query fails, fall back to active only
      console.warn('Failed to fetch all gateways, falling back to active only:', error.message);
      const { data: activeData, error: activeError } = await supabase
        .from('payment_gateways')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (activeError) throw new Error(`Failed to fetch payment gateways: ${activeError.message}`);
      return activeData || [];
    }

    return data || [];
  }

  async getActivePaymentGateways(): Promise<PaymentGateway[]> {
    const { data, error } = await supabase
      .from('payment_gateways')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw new Error(`Failed to fetch active payment gateways: ${error.message}`);
    return data || [];
  }

  async getPaymentGatewayById(id: string): Promise<PaymentGateway | null> {
    const { data, error } = await supabase
      .from('payment_gateways')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch payment gateway: ${error.message}`);
    }
    return data;
  }

  async createPaymentGateway(gateway: Omit<PaymentGateway, 'id' | 'created_at' | 'updated_at'>): Promise<PaymentGateway> {
    const { data, error } = await supabase
      .from('payment_gateways')
      .insert([gateway])
      .select()
      .single();

    if (error) throw new Error(`Failed to create payment gateway: ${error.message}`);
    return data;
  }

  async updatePaymentGateway(id: string, updates: Partial<PaymentGateway>): Promise<PaymentGateway> {
    const { data, error } = await supabase
      .from('payment_gateways')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update payment gateway: ${error.message}`);
    return data;
  }

  async deletePaymentGateway(id: string): Promise<void> {
    const { error } = await supabase
      .from('payment_gateways')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`Failed to delete payment gateway: ${error.message}`);
  }

  // =====================================================
  // PAYMENT REQUESTS
  // =====================================================

  async deletePaymentRequest(id: string): Promise<void> {
    // Delete associated payment links and transactions first to avoid FK violations
    await supabase.from('payment_links').delete().eq('payment_request_id', id);
    await supabase.from('payment_transactions').delete().eq('payment_request_id', id);

    const { error } = await supabase
      .from('payment_requests')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`Failed to delete payment request: ${error.message}`);
  }

  async createPaymentRequest(data: CreatePaymentRequestData): Promise<PaymentRequest> {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    
    const paymentRequest = {
      ...data,
      created_by: user?.id, // Add user ID for RLS
      expires_at: data.expires_in_hours 
        ? new Date(Date.now() + data.expires_in_hours * 60 * 60 * 1000).toISOString()
        : null
    };

    // Remove expires_in_hours as it's not a database field
    const { expires_in_hours: _expires_in_hours, ...dbData } = paymentRequest;

    const { data: result, error } = await supabase
      .from('payment_requests')
      .insert([dbData])
      .select(`
        *,
        gateway:payment_gateways(*)
      `)
      .single();

    if (error) throw new Error(`Failed to create payment request: ${error.message}`);
    return result;
  }

  async getPaymentRequests(
    filters: PaymentFilters = {},
    page: number = 1,
    perPage: number = 20
  ): Promise<PaginatedResponse<PaymentRequest>> {
    let query = supabase
      .from('payment_requests')
      .select(`
        *,
        gateway:payment_gateways(*)
      `, { count: 'exact' });

    // Apply filters
    if (filters.status) {
      if (Array.isArray(filters.status)) {
        query = query.in('status', filters.status);
      } else {
        query = query.eq('status', filters.status);
      }
    }

    if (filters.gateway_id) {
      query = query.eq('gateway_id', filters.gateway_id);
    }

    if (filters.currency) {
      query = query.eq('currency', filters.currency);
    }

    if (filters.customer_email) {
      query = query.ilike('customer_email', `%${filters.customer_email}%`);
    }

    if (filters.date_from) {
      query = query.gte('created_at', filters.date_from);
    }

    if (filters.date_to) {
      query = query.lte('created_at', filters.date_to);
    }

    if (filters.amount_min) {
      query = query.gte('amount', filters.amount_min);
    }

    if (filters.amount_max) {
      query = query.lte('amount', filters.amount_max);
    }

    // Apply pagination
    const offset = (page - 1) * perPage;
    query = query.range(offset, offset + perPage - 1);
    query = query.order('created_at', { ascending: false });

    const { data, error, count } = await query;

    if (error) throw new Error(`Failed to fetch payment requests: ${error.message}`);

    const totalPages = Math.ceil((count || 0) / perPage);

    return {
      data: data || [],
      pagination: {
        current_page: page,
        per_page: perPage,
        total_pages: totalPages,
        total_count: count || 0,
        has_next: page < totalPages,
        has_prev: page > 1
      }
    };
  }

  async getPaymentRequestById(id: string): Promise<PaymentRequest | null> {
    const { data, error } = await supabase
      .from('payment_requests')
      .select(`
        *,
        gateway:payment_gateways(*),
        invoice:invoices(
          id,
          invoice_number,
          invoice_date,
          due_date,
          status,
          payment_status
        )
      `)
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch payment request: ${error.message}`);
    }
    return data;
  }

  async getPaymentRequestByOrderId(orderId: string): Promise<PaymentRequest | null> {
    const { data, error } = await supabase
      .from('payment_requests')
      .select(`
        *,
        gateway:payment_gateways(*)
      `)
      .eq('gateway_order_id', orderId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch payment request by order ID: ${error.message}`);
    }
    return data;
  }

  async getPaymentRequestByGatewayPaymentId(paymentId: string): Promise<PaymentRequest | null> {
    const { data, error } = await supabase
      .from('payment_requests')
      .select(`
        *,
        gateway:payment_gateways(*)
      `)
      .eq('gateway_payment_id', paymentId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch payment request by payment ID: ${error.message}`);
    }
    return data;
  }

  async updatePaymentRequestStatus(
    id: string, 
    status: PaymentRequest['status'], 
    metadata?: Partial<UpdatePaymentRequestData>
  ): Promise<PaymentRequest> {
    const updates: Partial<PaymentRequest> = {
      status,
      ...metadata,
      ...(status === 'completed' && { completed_at: new Date().toISOString() })
    };

    const { data, error } = await supabase
      .from('payment_requests')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        gateway:payment_gateways(*)
      `)
      .single();

    if (error) throw new Error(`Failed to update payment request status: ${error.message}`);
    return data;
  }

  async updatePaymentRequestGateway(id: string, gatewayId: string): Promise<PaymentRequest> {
    const { data, error } = await supabase
      .from('payment_requests')
      .update({ gateway_id: gatewayId })
      .eq('id', id)
      .select(`
        *,
        gateway:payment_gateways(*)
      `)
      .single();

    if (error) throw new Error(`Failed to update payment request gateway: ${error.message}`);
    return data;
  }

  isPaymentRequestExpired(request: PaymentRequest): boolean {
    if (!request.expires_at) return false;
    return new Date(request.expires_at) < new Date();
  }

  // =====================================================
  // PAYMENT TRANSACTIONS
  // =====================================================

  async createPaymentTransaction(transaction: Omit<PaymentTransaction, 'id' | 'created_at'>): Promise<PaymentTransaction> {
    const { data, error } = await supabase
      .from('payment_transactions')
      .insert([transaction])
      .select()
      .single();

    if (error) throw new Error(`Failed to create payment transaction: ${error.message}`);
    return data;
  }

  async getTransactionsByPaymentRequest(paymentRequestId: string): Promise<PaymentTransaction[]> {
    const { data, error } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('payment_request_id', paymentRequestId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch transactions: ${error.message}`);
    return data || [];
  }

  async getTransactionById(id: string): Promise<PaymentTransaction | null> {
    const { data, error } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch transaction: ${error.message}`);
    }
    return data;
  }

  async updateTransactionStatus(
    id: string, 
    status: PaymentTransaction['status'],
    metadata?: Partial<PaymentTransaction>
  ): Promise<PaymentTransaction> {
    const updates = {
      status,
      ...metadata,
      ...(status === 'success' && { processed_at: new Date().toISOString() })
    };

    const { data, error } = await supabase
      .from('payment_transactions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update transaction status: ${error.message}`);
    return data;
  }

  // =====================================================
  // PAYMENT LINKS
  // =====================================================

  async createPaymentLink(
    paymentRequestId: string,
    linkType: PaymentLink['link_type'],
    data: CreatePaymentLinkData
  ): Promise<PaymentLink> {
    const linkToken = this.generateLinkToken();
    const checkoutUrl = this.generateCheckoutUrl(paymentRequestId, linkToken);

    // Basic link data without sent_at initially
    const linkData = {
      payment_request_id: paymentRequestId,
      link_type: linkType,
      link_token: linkToken,
      checkout_url: checkoutUrl,
      recipient_email: data.recipient_email,
      recipient_phone: data.recipient_phone,
      template_used: data.template_used,
      delivery_metadata: {
        send_immediately: data.send_immediately,
        custom_message: data.custom_message
      },
      // If send_immediately is true, set delivery_status but NOT sent_at yet
      ...(data.send_immediately && {
        delivery_status: 'sent' as const
      })
    };

    // Insert the record first
    const { data: result, error } = await supabase
      .from('payment_links')
      .insert([linkData])
      .select()
      .single();

    if (error || !result) throw new Error(`Failed to create payment link: ${error?.message || 'Unknown error'}`);

    // If we need to set sent_at, do it in a separate update that ensures it's after created_at
    if (data.send_immediately) {
      const { error: updateError } = await supabase
        .from('payment_links')
        .update({ 
          sent_at: 'NOW()' // Use database NOW() to ensure it's after created_at
        })
        .eq('id', result.id);

      if (updateError) throw new Error(`Failed to update payment link delivery status: ${updateError.message}`);
      
      // Fetch the updated record
      const { data: updatedResult, error: fetchError } = await supabase
        .from('payment_links')
        .select()
        .eq('id', result.id)
        .single();
      
      if (fetchError || !updatedResult) throw new Error(`Failed to fetch updated payment link: ${fetchError?.message || 'Unknown error'}`);
      return updatedResult;
    }

    return result;
  }

  async getPaymentLinksByRequest(paymentRequestId: string): Promise<PaymentLink[]> {
    const { data, error } = await supabase
      .from('payment_links')
      .select('*')
      .eq('payment_request_id', paymentRequestId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch payment links: ${error.message}`);
    return data || [];
  }

  async getPaymentLinkByToken(token: string): Promise<PaymentLink | null> {
    const { data, error } = await supabase
      .from('payment_links')
      .select(`
        *,
        payment_request:payment_requests(
          *,
          gateway:payment_gateways(*)
        )
      `)
      .eq('link_token', token)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch payment link: ${error.message}`);
    }
    return data;
  }

  async updatePaymentLinkDeliveryStatus(
    id: string, 
    status: PaymentLink['delivery_status']
  ): Promise<PaymentLink> {
    // First get the current record to ensure sent_at is after created_at
    const { data: currentLink, error: fetchError } = await supabase
      .from('payment_links')
      .select('created_at')
      .eq('id', id)
      .single();

    if (fetchError) throw new Error(`Failed to fetch payment link: ${fetchError.message}`);

    const now = new Date();
    const createdAt = new Date(currentLink.created_at);
    
    // Ensure sent_at is at least equal to created_at (add 1ms buffer to be safe)
    const sentAt = status === 'sent' 
      ? new Date(Math.max(now.getTime(), createdAt.getTime() + 1)).toISOString()
      : undefined;

    const updates = {
      delivery_status: status,
      ...(sentAt && { sent_at: sentAt })
    };

    const { data, error } = await supabase
      .from('payment_links')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update payment link status: ${error.message}`);
    return data;
  }

  async trackPaymentLinkAccess(token: string): Promise<void> {
    const { error } = await supabase
      .rpc('increment_payment_link_access', { link_token: token });

    if (error) {
      // Fallback to manual update if RPC doesn't exist
      const { data: link } = await supabase
        .from('payment_links')
        .select('id, access_count')
        .eq('link_token', token)
        .single();

      if (link) {
        await supabase
          .from('payment_links')
          .update({ 
            access_count: (link.access_count || 0) + 1,
            accessed_at: new Date().toISOString()
          })
          .eq('id', link.id);
      }
    }
  }

  private generateLinkToken(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  private generateCheckoutUrl(paymentRequestId: string, linkToken: string): string {
    const baseUrl = window.location.origin;
    return `${baseUrl}/payment/checkout/${paymentRequestId}?token=${linkToken}`;
  }

  // =====================================================
  // WEBHOOK MANAGEMENT
  // =====================================================

  async logWebhook(webhook: Omit<PaymentWebhook, 'id' | 'received_at'>): Promise<PaymentWebhook> {
    const { data, error } = await supabase
      .from('payment_webhooks')
      .insert([webhook])
      .select()
      .single();

    if (error) throw new Error(`Failed to log webhook: ${error.message}`);
    return data;
  }

  async getWebhooks(
    filters: { gateway_type?: string; status?: string; limit?: number } = {}
  ): Promise<PaymentWebhook[]> {
    let query = supabase
      .from('payment_webhooks')
      .select('*');

    if (filters.gateway_type) {
      query = query.eq('gateway_type', filters.gateway_type);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    query = query.order('received_at', { ascending: false });

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) throw new Error(`Failed to fetch webhooks: ${error.message}`);
    return data || [];
  }

  // =====================================================
  // EXCHANGE RATES
  // =====================================================

  async getExchangeRate(fromCurrency: string, toCurrency: string, date?: string): Promise<number> {
    const { data, error } = await supabase
      .rpc('get_exchange_rate', {
        p_from_currency: fromCurrency,
        p_to_currency: toCurrency,
        p_date: date || new Date().toISOString().split('T')[0]
      });

    if (error) throw new Error(`Failed to get exchange rate: ${error.message}`);
    return data || 1.0;
  }

  async convertCurrency(
    amount: number, 
    fromCurrency: string, 
    toCurrency: string, 
    date?: string
  ): Promise<number> {
    const { data, error } = await supabase
      .rpc('convert_currency', {
        p_amount: amount,
        p_from_currency: fromCurrency,
        p_to_currency: toCurrency,
        p_date: date || new Date().toISOString().split('T')[0]
      });

    if (error) throw new Error(`Failed to convert currency: ${error.message}`);
    return data || amount;
  }

  async updateExchangeRates(rates: ExchangeRate[]): Promise<void> {
    const { error } = await supabase
      .from('exchange_rates')
      .upsert(rates, { 
        onConflict: 'from_currency,to_currency,effective_date' 
      });

    if (error) throw new Error(`Failed to update exchange rates: ${error.message}`);
  }

  // =====================================================
  // ANALYTICS
  // =====================================================

  async getPaymentAnalytics(filters: {
    dateFrom?: string;
    dateTo?: string;
    gateway?: string;
    currency?: string;
  } = {}): Promise<PaymentAnalytics> {
    try {
      // Get basic stats
      let query = supabase
        .from('payment_requests')
        .select(`
          amount,
          currency,
          status,
          created_at,
          gateway:payment_gateways(name, provider_type),
          transactions:payment_transactions(payment_method, status)
        `);

      if (filters.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }

      if (filters.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }

      if (filters.gateway) {
        query = query.eq('gateway_id', filters.gateway);
      }

      if (filters.currency) {
        query = query.eq('currency', filters.currency);
      }

      const { data, error } = await query;

      if (error) throw new Error(`Failed to fetch payment analytics: ${error.message}`);

      const requests = data || [];
      const completed = requests.filter(r => r.status === 'completed');
      const failed = requests.filter(r => r.status === 'failed');

      // Calculate analytics
      const totalAmount = completed.reduce((sum, r) => sum + r.amount, 0);
      const totalCount = requests.length;
      const successCount = completed.length;
      const failedCount = failed.length;
      const successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 0;
      const averageAmount = successCount > 0 ? totalAmount / successCount : 0;

      // Currency breakdown
      const currencyBreakdown: Record<string, { amount: number; count: number }> = {};
      completed.forEach(r => {
        if (!currencyBreakdown[r.currency]) {
          currencyBreakdown[r.currency] = { amount: 0, count: 0 };
        }
        currencyBreakdown[r.currency].amount += r.amount;
        currencyBreakdown[r.currency].count += 1;
      });

      // Gateway breakdown
      const gatewayBreakdown: Record<string, { amount: number; count: number; success_rate: number }> = {};
      requests.forEach(r => {
        const gateway = Array.isArray(r.gateway) ? r.gateway[0] : r.gateway;
        const gatewayName = gateway?.name || 'Unknown';
        if (!gatewayBreakdown[gatewayName]) {
          gatewayBreakdown[gatewayName] = { amount: 0, count: 0, success_rate: 0 };
        }
        gatewayBreakdown[gatewayName].count += 1;
        if (r.status === 'completed') {
          gatewayBreakdown[gatewayName].amount += r.amount;
        }
      });

      // Calculate success rates for gateways
      Object.keys(gatewayBreakdown).forEach(gatewayName => {
        const gatewayRequests = requests.filter(r => {
          const gateway = Array.isArray(r.gateway) ? r.gateway[0] : r.gateway;
          return gateway?.name === gatewayName;
        });
        const gatewaySuccess = gatewayRequests.filter(r => r.status === 'completed').length;
        gatewayBreakdown[gatewayName].success_rate = gatewayRequests.length > 0 
          ? (gatewaySuccess / gatewayRequests.length) * 100 
          : 0;
      });

      // Payment method breakdown
      const paymentMethodBreakdown: Record<string, { amount: number; count: number }> = {};
      completed.forEach(r => {
        r.transactions?.forEach((t: any) => {
          if (t.status === 'success' && t.payment_method) {
            if (!paymentMethodBreakdown[t.payment_method]) {
              paymentMethodBreakdown[t.payment_method] = { amount: 0, count: 0 };
            }
            paymentMethodBreakdown[t.payment_method].amount += r.amount;
            paymentMethodBreakdown[t.payment_method].count += 1;
          }
        });
      });

      // Daily stats (last 30 days)
      const dailyStats: Array<{
        date: string;
        amount: number;
        count: number;
        success_count: number;
      }> = [];

      const last30Days = Array.from({ length: 30 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        return date.toISOString().split('T')[0];
      }).reverse();

      last30Days.forEach(date => {
        const dayRequests = requests.filter(r => 
          r.created_at.split('T')[0] === date
        );
        const dayCompleted = dayRequests.filter(r => r.status === 'completed');
        
        dailyStats.push({
          date,
          amount: dayCompleted.reduce((sum, r) => sum + r.amount, 0),
          count: dayRequests.length,
          success_count: dayCompleted.length
        });
      });

      return {
        total_amount: totalAmount,
        total_count: totalCount,
        success_count: successCount,
        failed_count: failedCount,
        success_rate: successRate,
        average_amount: averageAmount,
        currency_breakdown: currencyBreakdown,
        gateway_breakdown: gatewayBreakdown,
        payment_method_breakdown: paymentMethodBreakdown,
        daily_stats: dailyStats
      };

    } catch (error) {
      throw new Error(`Failed to calculate payment analytics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getFailedPayments(filters: {
    page?: number;
    perPage?: number;
    dateFrom?: string;
  } = {}): Promise<PaginatedResponse<PaymentRequest>> {
    return this.getPaymentRequests({
      status: ['failed', 'expired'],
      date_from: filters.dateFrom
    }, filters.page || 1, filters.perPage || 20);
  }

  // =====================================================
  // INVOICE INTEGRATION
  // =====================================================

  async markInvoiceAsPaid(invoiceId: string, paymentData: InvoicePaymentData): Promise<void> {
    try {
      // Update invoice status
      const { error: invoiceError } = await supabase
        .from('invoices')
        .update({
          status: 'paid',
          payment_status: 'paid',
          paid_amount: paymentData.amount,
          paid_at: paymentData.paymentDate
        })
        .eq('id', invoiceId);

      if (invoiceError) throw new Error(`Failed to update invoice: ${invoiceError.message}`);

      // Create payment record in invoice_payments table if it exists
      try {
        await supabase
          .from('invoice_payments')
          .insert([{
            invoice_id: invoiceId,
            amount: paymentData.amount,
            payment_method: paymentData.paymentMethod,
            reference_number: paymentData.referenceNumber,
            payment_date: paymentData.paymentDate,
            currency: paymentData.currency || 'INR',
            gateway: paymentData.gateway,
            transaction_id: paymentData.transaction_id
          }]);
      } catch (paymentRecordError) {
        // Ignore if invoice_payments table doesn't exist
        console.warn('Invoice payments table not found, skipping payment record creation');
      }

    } catch (error) {
      throw new Error(`Failed to mark invoice as paid: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // =====================================================
  // UTILITY METHODS
  // =====================================================

  formatCurrencyAmount(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount);
  }

  getSmallestCurrencyUnit(amount: number, currency: string): number {
    // Convert to smallest unit (e.g., paise for INR, cents for USD)
    const multipliers: Record<string, number> = {
      'INR': 100,  // paise
      'USD': 100,  // cents
      'EUR': 100,  // cents
      'GBP': 100,  // pence
      'JPY': 1,    // yen (no subdivision)
      'KRW': 1     // won (no subdivision)
    };

    return Math.round(amount * (multipliers[currency] || 100));
  }

  validatePaymentAmount(amount: number, currency: string): boolean {
    const minAmounts: Record<string, number> = {
      'INR': 1.00,
      'USD': 0.50,
      'EUR': 0.50,
      'GBP': 0.30
    };

    const maxAmounts: Record<string, number> = {
      'INR': 1000000.00,
      'USD': 15000.00,
      'EUR': 15000.00,
      'GBP': 12000.00
    };

    const minAmount = minAmounts[currency] || 1.00;
    const maxAmount = maxAmounts[currency] || 10000.00;

    return amount >= minAmount && amount <= maxAmount;
  }
}

// Create and export singleton instance
export const paymentService = new PaymentService();