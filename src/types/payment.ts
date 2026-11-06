// =====================================================
// Payment Gateway System Type Definitions
// =====================================================
// Comprehensive TypeScript types for the payment gateway system
// supporting Stripe and PayPal for international payments

// =====================================================
// CORE PAYMENT TYPES
// =====================================================

export interface PaymentGateway {
  id: string;
  name: string;
  provider_type: 'stripe' | 'paypal' | 'other';
  settings: PaymentGatewaySettings;
  is_active: boolean;
  is_sandbox: boolean;
  currency_support: string[]; // ISO currency codes
  transaction_fee_percentage?: number;
  transaction_fee_fixed?: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface PaymentGatewaySettings {
  // Common settings
  api_key?: string;
  secret_key?: string;
  webhook_secret?: string;
  environment?: 'sandbox' | 'production';
  
  // Stripe specific
  publishable_key?: string;
  secret_key_stripe?: string;
  
  // PayPal specific
  client_id?: string;
  client_secret?: string;
  
  // Additional provider-specific settings
  [key: string]: any;
}

export interface PaymentRequest {
  id: string;
  invoice_id?: string;
  gateway_id?: string;
  gateway?: PaymentGateway;
  invoice?: {
    id: string;
    invoice_number: string;
    invoice_date: string;
    due_date: string;
    status: string;
    payment_status: string;
  };
  amount: number;
  currency: string;
  description?: string;
  status: PaymentRequestStatus;
  
  // Customer information
  customer_email?: string;
  customer_phone?: string;
  customer_name?: string;
  
  // Gateway fields
  gateway_order_id?: string;
  gateway_payment_id?: string;
  
  // Lifecycle timestamps
  created_at: string;
  expires_at?: string;
  completed_at?: string;
  
  // Additional data
  metadata?: Record<string, any>;
  failure_reason?: string;
  
  // Audit
  created_by?: string;
  updated_at: string;
}

export type PaymentRequestStatus = 
  | 'pending' 
  | 'processing' 
  | 'completed' 
  | 'failed' 
  | 'cancelled' 
  | 'expired';

export interface PaymentTransaction {
  id: string;
  payment_request_id: string;
  gateway_transaction_id: string;
  amount: number;
  currency: string;
  status: PaymentTransactionStatus;
  
  // Payment details
  payment_method?: string;
  payment_method_details?: Record<string, any>;
  
  // Gateway data
  gateway_response?: Record<string, any>;
  gateway_fee?: number;
  
  // Timestamps
  created_at: string;
  processed_at?: string;
  
  // Failure handling
  failure_code?: string;
  failure_reason?: string;
  
  // Refund tracking
  refunded_amount?: number;
  refund_transactions?: RefundTransaction[];
}

export type PaymentTransactionStatus = 
  | 'pending' 
  | 'processing' 
  | 'success' 
  | 'failed' 
  | 'cancelled' 
  | 'refunded' 
  | 'partially_refunded';

export interface RefundTransaction {
  id: string;
  amount: number;
  reason?: string;
  created_at: string;
  gateway_refund_id?: string;
  status: 'pending' | 'success' | 'failed';
}

export interface PaymentLink {
  id: string;
  payment_request_id: string;
  link_type: PaymentLinkType;
  link_token: string;
  checkout_url: string;
  
  // Delivery details
  recipient_email?: string;
  recipient_phone?: string;
  delivery_status: PaymentLinkDeliveryStatus;
  
  // Tracking
  created_at: string;
  sent_at?: string;
  accessed_at?: string;
  access_count: number;
  
  // Template and delivery data
  template_used?: string;
  delivery_metadata?: Record<string, any>;
}

export type PaymentLinkType = 'email' | 'sms' | 'whatsapp' | 'direct';

export type PaymentLinkDeliveryStatus = 
  | 'pending' 
  | 'sent' 
  | 'delivered' 
  | 'failed' 
  | 'bounced';

export interface PaymentWebhook {
  id: string;
  gateway_type: string;
  event_type: string;
  payload: Record<string, any>;
  signature?: string;
  status: PaymentWebhookStatus;
  
  // Processing
  received_at: string;
  processed_at?: string;
  error_message?: string;
  retry_count: number;
  
  // Related entities
  payment_request_id?: string;
  transaction_id?: string;
}

export type PaymentWebhookStatus = 
  | 'received' 
  | 'processing' 
  | 'processed' 
  | 'failed' 
  | 'ignored';

export interface ExchangeRate {
  id: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  source: 'manual' | 'api' | 'bank';
  effective_date: string;
  created_at: string;
}

// =====================================================
// PAYMENT PROVIDER INTERFACES
// =====================================================

export interface PaymentProvider {
  name: string;
  type: string;
  createPaymentRequest(request: PaymentRequest): Promise<PaymentProviderResponse>;
  verifyPayment(paymentId: string, request: PaymentRequest): Promise<PaymentTransaction>;
  processRefund(transactionId: string, amount: number, reason?: string): Promise<RefundTransaction>;
  getPaymentDetails(paymentId: string): Promise<PaymentProviderPaymentDetails>;
  handleWebhook(payload: any, signature: string): Promise<PaymentWebhookResult>;
}

export interface PaymentProviderResponse {
  success: boolean;
  paymentUrl: string;
  orderId: string;
  providerOrderId?: string;
  error?: string;
  providerData?: Record<string, any>; // Provider-specific data for modals, redirects, etc.
}

export interface PaymentProviderPaymentDetails {
  id: string;
  status: string;
  amount: number;
  currency: string;
  payment_method?: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

export interface PaymentWebhookResult {
  processed: boolean;
  payment_request_id?: string;
  transaction_id?: string;
  action_taken?: string;
  error?: string;
}

// =====================================================
// STRIPE SPECIFIC TYPES
// =====================================================

export interface StripeSettings extends PaymentGatewaySettings {
  publishable_key: string;
  secret_key: string;
  webhook_secret?: string;
  environment: 'sandbox' | 'production';
}

export interface StripePaymentIntentRequest {
  amount: number; // Amount in smallest currency unit
  currency: string;
  payment_method_types?: string[];
  description?: string;
  receipt_email?: string;
  metadata?: Record<string, string>;
  return_url?: string;
}

export interface StripePaymentIntentResponse {
  id: string;
  object: 'payment_intent';
  amount: number;
  currency: string;
  status: 'requires_payment_method' | 'requires_confirmation' | 'requires_action' | 'processing' | 'requires_capture' | 'canceled' | 'succeeded';
  client_secret?: string;
  description?: string;
  receipt_email?: string;
  payment_method?: string;
  payment_method_types: string[];
  metadata: Record<string, string>;
  created: number;
  last_payment_error?: {
    code?: string;
    message?: string;
    type?: string;
  };
}

// =====================================================
// PAYPAL SPECIFIC TYPES
// =====================================================

export interface PayPalSettings extends PaymentGatewaySettings {
  client_id: string;
  client_secret: string;
  webhook_id?: string;
  environment: 'sandbox' | 'production';
}

export interface PayPalOrderRequest {
  intent: 'CAPTURE' | 'AUTHORIZE';
  purchase_units: Array<{
    amount: {
      currency_code: string;
      value: string;
    };
    description?: string;
    custom_id?: string;
    invoice_id?: string;
  }>;
  application_context?: {
    return_url?: string;
    cancel_url?: string;
    brand_name?: string;
    locale?: string;
    landing_page?: 'LOGIN' | 'BILLING' | 'NO_PREFERENCE';
    shipping_preference?: 'GET_FROM_FILE' | 'NO_SHIPPING' | 'SET_PROVIDED_ADDRESS';
    user_action?: 'CONTINUE' | 'PAY_NOW';
  };
}

export interface PayPalOrderResponse {
  id: string;
  status: 'CREATED' | 'SAVED' | 'APPROVED' | 'VOIDED' | 'COMPLETED' | 'PAYER_ACTION_REQUIRED';
  links: Array<{
    href: string;
    rel: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD' | 'CONNECT' | 'OPTIONS' | 'TRACE' | 'PATCH';
  }>;
  create_time: string;
  update_time: string;
}

// =====================================================
// API REQUEST/RESPONSE TYPES
// =====================================================

export interface CreatePaymentRequestData {
  invoice_id?: string;
  gateway_id?: string;
  amount: number;
  currency: string;
  description?: string;
  customer_email?: string;
  customer_phone?: string;
  customer_name?: string;
  expires_in_hours?: number;
  metadata?: Record<string, any>;
}

export interface UpdatePaymentRequestData {
  status?: PaymentRequestStatus;
  gateway_id?: string;
  gateway_order_id?: string;
  gateway_payment_id?: string;
  failure_reason?: string;
  metadata?: Record<string, any>;
}

export interface CreatePaymentLinkData {
  payment_request_id: string;
  link_type: PaymentLinkType;
  recipient_email?: string;
  recipient_phone?: string;
  template_used?: string;
  send_immediately?: boolean;
  custom_message?: string;
}

export interface PaymentFilters {
  status?: PaymentRequestStatus | PaymentRequestStatus[];
  gateway_id?: string;
  currency?: string;
  customer_email?: string;
  date_from?: string;
  date_to?: string;
  amount_min?: number;
  amount_max?: number;
}

export interface PaymentAnalytics {
  total_amount: number;
  total_count: number;
  success_count: number;
  failed_count: number;
  success_rate: number;
  average_amount: number;
  currency_breakdown: Record<string, {
    amount: number;
    count: number;
  }>;
  gateway_breakdown: Record<string, {
    amount: number;
    count: number;
    success_rate: number;
  }>;
  payment_method_breakdown: Record<string, {
    amount: number;
    count: number;
  }>;
  daily_stats: Array<{
    date: string;
    amount: number;
    count: number;
    success_count: number;
  }>;
}

// =====================================================
// CURRENCY AND FORMATTING TYPES
// =====================================================

export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
  decimal_places: number;
  smallest_unit: number; // e.g., 100 for paise/cents
}

export interface PaymentAmount {
  value: number;
  currency: string;
  formatted: string;
  smallest_unit_value: number; // Amount in smallest currency unit
}

// =====================================================
// ERROR TYPES
// =====================================================

export interface PaymentError {
  code: string;
  message: string;
  type: 'validation' | 'gateway' | 'network' | 'configuration' | 'system';
  details?: Record<string, any>;
  gateway_error?: {
    code?: string;
    message?: string;
    type?: string;
  };
}

// =====================================================
// WEBHOOK EVENT TYPES
// =====================================================

export interface WebhookEvent {
  id: string;
  type: string;
  gateway: string;
  data: Record<string, any>;
  created_at: string;
  signature?: string;
}

// Stripe webhook events  
export type StripeWebhookEventType =
  | 'payment_intent.succeeded'
  | 'payment_intent.payment_failed'
  | 'payment_intent.requires_action'
  | 'charge.dispute.created'
  | 'invoice.payment_succeeded'
  | 'invoice.payment_failed';

// PayPal webhook events
export type PayPalWebhookEventType =
  | 'PAYMENT.CAPTURE.COMPLETED'
  | 'PAYMENT.CAPTURE.DENIED'
  | 'PAYMENT.CAPTURE.PENDING'
  | 'BILLING.SUBSCRIPTION.ACTIVATED'
  | 'BILLING.SUBSCRIPTION.CANCELLED';

// =====================================================
// UTILITY TYPES
// =====================================================

export type PaginatedResponse<T> = {
  data: T[];
  pagination: {
    current_page: number;
    per_page: number;
    total_pages: number;
    total_count: number;
    has_next: boolean;
    has_prev: boolean;
  };
};

export type PaymentServiceResponse<T> = {
  success: boolean;
  data?: T;
  error?: PaymentError;
};

// =====================================================
// CONFIGURATION TYPES
// =====================================================

export interface PaymentSystemConfig {
  default_currency: string;
  supported_currencies: string[];
  default_expiry_hours: number;
  max_amount_per_transaction: number;
  min_amount_per_transaction: number;
  webhook_timeout_seconds: number;
  retry_failed_webhooks: boolean;
  max_webhook_retries: number;
  enable_email_notifications: boolean;
  enable_sms_notifications: boolean;
}

// =====================================================
// INTEGRATION TYPES
// =====================================================

export interface InvoicePaymentData {
  amount: number;
  paymentMethod: string;
  referenceNumber: string;
  paymentDate: string;
  currency?: string;
  gateway?: string;
  transaction_id?: string;
}

// Re-export commonly used types
export type {
  PaymentGateway as Gateway,
  PaymentRequest as Request,
  PaymentTransaction as Transaction,
  PaymentLink as Link
};