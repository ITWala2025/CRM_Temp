export interface SubscriptionPlan {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency_code: string;
  billing_interval: 'monthly' | 'annual';
  plan_type: 'basic' | 'premium' | 'tiered' | 'add-on';
  company_settings_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomerSubscription {
  id: string;
  subscription_number?: string;
  customer_id: string;
  plan_id: string;
  company_settings_id?: string;
  status: 'draft' | 'active' | 'paused' | 'cancelled' | 'expired';
  start_date: string;
  end_date?: string;
  next_billing_date: string;
  notes?: string;
  created_by?: string;
  source_subscription_id?: string;
  created_at: string;
  updated_at: string;
  // Relations
  customer?: {
    id: string;
    company_name?: string;
    contact_person?: string;
    email?: string;
    customer_code?: string;
    company_settings_id?: string;
  };
  plan?: SubscriptionPlan;
  source_subscription?: CustomerSubscription;
}

export interface CreateSubscriptionPlanData {
  name: string;
  description?: string;
  price: number;
  currency_code: string;
  billing_interval: 'monthly' | 'annual';
  plan_type: 'basic' | 'premium' | 'tiered' | 'add-on';
  company_settings_id?: string;
}

export interface CreateCustomerSubscriptionData {
  customer_id: string;
  plan_id: string;
  start_date: string;
  end_date?: string;
  notes?: string;
  company_settings_id?: string;
  status?: CustomerSubscription['status'];
  subscription_number?: string;
  source_subscription_id?: string;
}

export interface SubscriptionFilters {
  status?: string;
  customer_id?: string;
  plan_id?: string;
  company_settings_id?: string;
}

