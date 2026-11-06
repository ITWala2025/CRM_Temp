// =====================================================
// Payment Providers - Gateway Implementations
// =====================================================
// Provider implementations for Stripe and PayPal
// Handles payment processing, verification, and webhook management

import type {
  PaymentProvider,
  PaymentGateway,
  PaymentRequest,
  PaymentTransaction,
  PaymentProviderResponse,
  PaymentProviderPaymentDetails,
  PaymentWebhookResult,
  RefundTransaction,
  StripeSettings,
  StripePaymentIntentRequest,
  StripePaymentIntentResponse,
  PayPalSettings,
  PayPalOrderRequest,
  PayPalOrderResponse
} from '../types/payment';

// =====================================================
// BASE PAYMENT PROVIDER CLASS
// =====================================================

abstract class BasePaymentProvider implements PaymentProvider {
  abstract name: string;
  abstract type: string;

  abstract createPaymentRequest(request: PaymentRequest): Promise<PaymentProviderResponse>;
  abstract verifyPayment(paymentId: string, request: PaymentRequest): Promise<PaymentTransaction>;
  abstract processRefund(transactionId: string, amount: number, reason?: string): Promise<RefundTransaction>;
  abstract getPaymentDetails(paymentId: string): Promise<PaymentProviderPaymentDetails>;
  abstract handleWebhook(payload: any, signature: string): Promise<PaymentWebhookResult>;

  protected formatError(error: any): string {
    if (typeof error === 'string') return error;
    if (error?.message) return error.message;
    if (error?.error?.description) return error.error.description;
    return 'Unknown payment provider error';
  }

  protected generateReceipt(): string {
    return `rcpt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }
}

// =====================================================
// STRIPE PROVIDER
// =====================================================

class StripeProvider extends BasePaymentProvider {
  name = 'Stripe';
  type = 'stripe';
  private settings: StripeSettings;

  constructor(gateway: PaymentGateway) {
    super();
    this.settings = gateway.settings as StripeSettings;
  }

  async createPaymentRequest(request: PaymentRequest): Promise<PaymentProviderResponse> {
    try {
      const paymentIntentData: StripePaymentIntentRequest = {
        amount: this.convertToSmallestUnit(request.amount, request.currency),
        currency: request.currency.toLowerCase(),
        payment_method_types: ['card'],
        description: request.description,
        receipt_email: request.customer_email,
        metadata: {
          payment_request_id: request.id,
          invoice_id: request.invoice_id || '',
          customer_name: request.customer_name || ''
        },
        return_url: `${window.location.origin}/payment/${request.id}?gateway=stripe`
      };

      const paymentIntent = await this.createStripePaymentIntent(paymentIntentData);
      const paymentUrl = this.generateStripeCheckoutUrl(paymentIntent, request);

      return {
        success: true,
        paymentUrl,
        orderId: request.id,
        providerOrderId: paymentIntent.id
      };

    } catch (error) {
      return {
        success: false,
        paymentUrl: '',
        orderId: request.id,
        error: this.formatError(error)
      };
    }
  }

  private async createStripePaymentIntent(data: StripePaymentIntentRequest): Promise<StripePaymentIntentResponse> {
    // This would be a server-side API call to Stripe
    // Mock response for demo
    return {
      id: `pi_${Date.now()}`,
      object: 'payment_intent',
      amount: data.amount,
      currency: data.currency,
      status: 'requires_payment_method',
      client_secret: `pi_${Date.now()}_secret_${Math.random().toString(36).substring(2)}`,
      description: data.description,
      receipt_email: data.receipt_email,
      payment_method_types: data.payment_method_types || ['card'],
      metadata: data.metadata || {},
      created: Math.floor(Date.now() / 1000)
    };
  }

  private generateStripeCheckoutUrl(paymentIntent: StripePaymentIntentResponse, request: PaymentRequest): string {
    const baseUrl = window.location.origin;
    const params = new URLSearchParams({
      payment_intent: paymentIntent.id,
      client_secret: paymentIntent.client_secret || '',
      return_url: `${baseUrl}/payment/${request.id}?gateway=stripe`
    });

    return `${baseUrl}/payment/stripe-checkout?${params.toString()}`;
  }

  async verifyPayment(paymentId: string, request: PaymentRequest): Promise<PaymentTransaction> {
    try {
      const paymentIntent = await this.getStripePaymentIntent(paymentId);

      const transaction: Omit<PaymentTransaction, 'id' | 'created_at'> = {
        payment_request_id: request.id,
        gateway_transaction_id: paymentIntent.id,
        amount: this.convertFromSmallestUnit(paymentIntent.amount, paymentIntent.currency),
        currency: paymentIntent.currency.toUpperCase(),
        status: this.mapStripeStatus(paymentIntent.status),
        payment_method: paymentIntent.payment_method_types[0] || 'card',
        payment_method_details: {
          payment_method: paymentIntent.payment_method
        },
        gateway_response: paymentIntent,
        processed_at: new Date(paymentIntent.created * 1000).toISOString(),
        failure_code: paymentIntent.last_payment_error?.code,
        failure_reason: paymentIntent.last_payment_error?.message
      };

      return transaction as PaymentTransaction;

    } catch (error) {
      throw new Error(`Stripe payment verification failed: ${this.formatError(error)}`);
    }
  }

  private async getStripePaymentIntent(paymentIntentId: string): Promise<StripePaymentIntentResponse> {
    // This would be a server-side API call to Stripe
    // Mock response for demo
    return {
      id: paymentIntentId,
      object: 'payment_intent',
      amount: 5000, // $50.00 in cents
      currency: 'usd',
      status: 'succeeded',
      payment_method_types: ['card'],
      metadata: {},
      created: Math.floor(Date.now() / 1000)
    };
  }

  private mapStripeStatus(status: string): PaymentTransaction['status'] {
    const statusMap: Record<string, PaymentTransaction['status']> = {
      'requires_payment_method': 'pending',
      'requires_confirmation': 'pending',
      'requires_action': 'pending',
      'processing': 'processing',
      'succeeded': 'success',
      'canceled': 'cancelled'
    };

    return statusMap[status] || 'failed';
  }

  async processRefund(transactionId: string, amount: number, reason?: string): Promise<RefundTransaction> {
    try {
      const refund = await this.createStripeRefund(transactionId, amount, reason);

      return {
        id: refund.id,
        amount: this.convertFromSmallestUnit(refund.amount, 'USD'),
        reason: reason || 'requested_by_customer',
        created_at: new Date().toISOString(),
        gateway_refund_id: refund.id,
        status: 'success'
      };

    } catch (error) {
      throw new Error(`Stripe refund failed: ${this.formatError(error)}`);
    }
  }

  private async createStripeRefund(paymentIntentId: string, amount: number, reason?: string): Promise<any> {
    // Mock refund response
    return {
      id: `re_${Date.now()}`,
      amount: this.convertToSmallestUnit(amount, 'USD'),
      currency: 'usd',
      payment_intent: paymentIntentId,
      reason: reason || 'requested_by_customer',
      status: 'succeeded'
    };
  }

  async getPaymentDetails(paymentId: string): Promise<PaymentProviderPaymentDetails> {
    const paymentIntent = await this.getStripePaymentIntent(paymentId);

    return {
      id: paymentIntent.id,
      status: paymentIntent.status,
      amount: this.convertFromSmallestUnit(paymentIntent.amount, paymentIntent.currency),
      currency: paymentIntent.currency.toUpperCase(),
      payment_method: paymentIntent.payment_method_types[0],
      created_at: new Date(paymentIntent.created * 1000).toISOString(),
      updated_at: new Date(paymentIntent.created * 1000).toISOString(),
      metadata: paymentIntent.metadata
    };
  }

  async handleWebhook(payload: any, signature: string): Promise<PaymentWebhookResult> {
    try {
      // Verify webhook signature
      const isValid = this.verifyStripeSignature(payload, signature);
      if (!isValid) {
        throw new Error('Invalid webhook signature');
      }

      const event = payload.type;
      const paymentIntent = payload.data?.object;

      let result: PaymentWebhookResult = { processed: false };

      switch (event) {
        case 'payment_intent.succeeded':
          result = await this.handlePaymentSucceeded(paymentIntent);
          break;
        case 'payment_intent.payment_failed':
          result = await this.handlePaymentFailed(paymentIntent);
          break;
        default:
          result = { processed: false, action_taken: 'ignored_unknown_event' };
      }

      return result;

    } catch (error) {
      return {
        processed: false,
        error: this.formatError(error)
      };
    }
  }

  private verifyStripeSignature(payload: any, signature: string): boolean {
    // In a real implementation, verify using Stripe's webhook secret
    return Boolean(signature && signature.length > 0);
  }

  private async handlePaymentSucceeded(paymentIntent: any): Promise<PaymentWebhookResult> {
    return {
      processed: true,
      payment_request_id: paymentIntent.metadata?.payment_request_id,
      action_taken: 'payment_succeeded'
    };
  }

  private async handlePaymentFailed(paymentIntent: any): Promise<PaymentWebhookResult> {
    return {
      processed: true,
      payment_request_id: paymentIntent.metadata?.payment_request_id,
      action_taken: 'payment_failed'
    };
  }

  private convertToSmallestUnit(amount: number, currency: string): number {
    // Convert to cents for USD/EUR/GBP, etc.
    const multipliers: Record<string, number> = {
      'USD': 100,
      'EUR': 100,
      'GBP': 100,
      'CAD': 100,
      'AUD': 100,
      'JPY': 1, // Yen has no subdivision
      'KRW': 1  // Won has no subdivision
    };

    return Math.round(amount * (multipliers[currency.toUpperCase()] || 100));
  }

  private convertFromSmallestUnit(amount: number, currency: string): number {
    const multipliers: Record<string, number> = {
      'USD': 100,
      'EUR': 100,
      'GBP': 100,
      'CAD': 100,
      'AUD': 100,
      'JPY': 1,
      'KRW': 1
    };

    return amount / (multipliers[currency.toUpperCase()] || 100);
  }
}

// =====================================================
// PAYPAL PROVIDER
// =====================================================

class PayPalProvider extends BasePaymentProvider {
  name = 'PayPal';
  type = 'paypal';
  private settings: PayPalSettings;

  constructor(gateway: PaymentGateway) {
    super();
    this.settings = gateway.settings as PayPalSettings;
  }

  async createPaymentRequest(request: PaymentRequest): Promise<PaymentProviderResponse> {
    try {
      const orderData: PayPalOrderRequest = {
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: request.currency,
            value: request.amount.toFixed(2)
          },
          description: request.description,
          custom_id: request.id,
          invoice_id: request.invoice_id
        }],
        application_context: {
          return_url: `${window.location.origin}/payment/${request.id}?gateway=paypal&status=success`,
          cancel_url: `${window.location.origin}/payment/${request.id}?gateway=paypal&status=cancelled`,
          brand_name: 'Kdadks',
          landing_page: 'BILLING',
          user_action: 'PAY_NOW'
        }
      };

      const order = await this.createPayPalOrder(orderData);
      const approvalUrl = order.links.find(link => link.rel === 'approve')?.href || '';

      return {
        success: true,
        paymentUrl: approvalUrl,
        orderId: request.id,
        providerOrderId: order.id
      };

    } catch (error) {
      return {
        success: false,
        paymentUrl: '',
        orderId: request.id,
        error: this.formatError(error)
      };
    }
  }

  private async createPayPalOrder(_orderData: PayPalOrderRequest): Promise<PayPalOrderResponse> {
    // This would be a server-side API call to PayPal
    // Mock response for demo
    return {
      id: `ORDER_${Date.now()}`,
      status: 'CREATED',
      links: [
        {
          href: `https://www.sandbox.paypal.com/checkoutnow?token=ORDER_${Date.now()}`,
          rel: 'approve',
          method: 'GET'
        },
        {
          href: `${window.location.origin}/api/paypal/capture`,
          rel: 'capture',
          method: 'POST'
        }
      ],
      create_time: new Date().toISOString(),
      update_time: new Date().toISOString()
    };
  }

  async verifyPayment(paymentId: string, request: PaymentRequest): Promise<PaymentTransaction> {
    try {
      const order = await this.getPayPalOrder(paymentId);

      const transaction: Omit<PaymentTransaction, 'id' | 'created_at'> = {
        payment_request_id: request.id,
        gateway_transaction_id: paymentId,
        amount: request.amount,
        currency: request.currency,
        status: this.mapPayPalStatus(order.status),
        payment_method: 'paypal',
        payment_method_details: {
          order_id: order.id
        },
        gateway_response: order,
        processed_at: new Date().toISOString()
      };

      return transaction as PaymentTransaction;

    } catch (error) {
      throw new Error(`PayPal payment verification failed: ${this.formatError(error)}`);
    }
  }

  private async getPayPalOrder(orderId: string): Promise<any> {
    // This would be a server-side API call to PayPal
    // Mock response for demo
    return {
      id: orderId,
      status: 'COMPLETED',
      create_time: new Date().toISOString(),
      update_time: new Date().toISOString()
    };
  }

  private mapPayPalStatus(status: string): PaymentTransaction['status'] {
    const statusMap: Record<string, PaymentTransaction['status']> = {
      'CREATED': 'pending',
      'SAVED': 'pending',
      'APPROVED': 'processing',
      'COMPLETED': 'success',
      'VOIDED': 'cancelled',
      'PAYER_ACTION_REQUIRED': 'pending'
    };

    return statusMap[status] || 'failed';
  }

  async processRefund(transactionId: string, amount: number, reason?: string): Promise<RefundTransaction> {
    try {
      const refund = await this.createPayPalRefund(transactionId, amount, reason);

      return {
        id: refund.id,
        amount: amount,
        reason: reason || 'requested_by_customer',
        created_at: new Date().toISOString(),
        gateway_refund_id: refund.id,
        status: 'success'
      };

    } catch (error) {
      throw new Error(`PayPal refund failed: ${this.formatError(error)}`);
    }
  }

  private async createPayPalRefund(captureId: string, amount: number, _reason?: string): Promise<any> {
    // Mock refund response
    return {
      id: `REFUND_${Date.now()}`,
      status: 'COMPLETED',
      amount: {
        currency_code: 'USD',
        value: amount.toFixed(2)
      }
    };
  }

  async getPaymentDetails(paymentId: string): Promise<PaymentProviderPaymentDetails> {
    const order = await this.getPayPalOrder(paymentId);

    return {
      id: order.id,
      status: order.status,
      amount: 0, // Amount would be extracted from order details
      currency: 'USD',
      payment_method: 'paypal',
      created_at: order.create_time,
      updated_at: order.update_time,
      metadata: order
    };
  }

  async handleWebhook(payload: any, signature: string): Promise<PaymentWebhookResult> {
    try {
      // Verify webhook signature
      const isValid = this.verifyPayPalSignature(payload, signature);
      if (!isValid) {
        throw new Error('Invalid webhook signature');
      }

      const eventType = payload.event_type;
      const resource = payload.resource;

      let result: PaymentWebhookResult = { processed: false };

      switch (eventType) {
        case 'PAYMENT.CAPTURE.COMPLETED':
          result = await this.handlePaymentCompleted(resource);
          break;
        case 'PAYMENT.CAPTURE.DENIED':
          result = await this.handlePaymentDenied(resource);
          break;
        default:
          result = { processed: false, action_taken: 'ignored_unknown_event' };
      }

      return result;

    } catch (error) {
      return {
        processed: false,
        error: this.formatError(error)
      };
    }
  }

  private verifyPayPalSignature(payload: any, signature: string): boolean {
    // In a real implementation, verify using PayPal's webhook verification
    return Boolean(signature && signature.length > 0);
  }

  private async handlePaymentCompleted(resource: any): Promise<PaymentWebhookResult> {
    return {
      processed: true,
      payment_request_id: resource.custom_id,
      action_taken: 'payment_completed'
    };
  }

  private async handlePaymentDenied(resource: any): Promise<PaymentWebhookResult> {
    return {
      processed: true,
      payment_request_id: resource.custom_id,
      action_taken: 'payment_denied'
    };
  }
}

// =====================================================
// PROVIDER FACTORY
// =====================================================

export function createPaymentProvider(gateway: PaymentGateway): PaymentProvider {
  switch (gateway.provider_type) {
    case 'stripe':
      return new StripeProvider(gateway);
    case 'paypal':
      return new PayPalProvider(gateway);
    default:
      throw new Error(`Unsupported payment provider: ${gateway.provider_type}`);
  }
}

// Export provider classes for direct use if needed
export { StripeProvider, PayPalProvider };

// =====================================================
// PAYMENT PROVIDER FACTORY
// =====================================================

export class PaymentProviderFactory {
  static createProvider(
    providerType: string,
    gateway: PaymentGateway
  ): BasePaymentProvider {
    switch (providerType.toLowerCase()) {
      case 'stripe':
        return new StripeProvider(gateway);
      case 'paypal':
        return new PayPalProvider(gateway);
      default:
        throw new Error(`Unsupported payment provider: ${providerType}`);
    }
  }

  static getSupportedProviders(): string[] {
    return ['stripe', 'paypal'];
  }

  static getProviderInfo(providerType: string) {
    const providers: Record<string, any> = {
      stripe: {
        name: 'Stripe',
        description: 'Global payment platform',
        supportedCurrencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'],
        features: ['International Cards', 'Local Payment Methods', '3D Secure']
      },
      paypal: {
        name: 'PayPal',
        description: 'Worldwide payment system',
        supportedCurrencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'],
        features: ['PayPal Balance', 'Cards', 'Bank Transfers']
      }
    };

    return providers[providerType.toLowerCase()] || null;
  }
}