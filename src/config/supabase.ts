import { createClient } from '@supabase/supabase-js';

const env = (import.meta as any).env || {};
const supabaseUrl = env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || 'placeholder-key';

// Only considered configured if user provides an actual live URL and key, and VITE_USE_MOCK is not explicitly true
export const isSupabaseConfigured = Boolean(
  env.VITE_SUPABASE_URL &&
  (env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY) &&
  env.VITE_USE_MOCK !== 'true'
);

export const isMockMode = !isSupabaseConfigured || env.VITE_USE_MOCK === 'true';

if (isMockMode) {
  console.info('CRM Template running in Mock Mode (using localStorage and rich seed data).');
} else {
  console.info('CRM Template connected to Supabase backend.');
}

// Always export a valid client instance to prevent syntax or runtime crashes
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      'x-application-name': 'enterprise-crm-template',
    },
  },
});

export default supabase;

