import { supabase, isSupabaseConfigured } from '../config/supabase'
import type { User, Session } from '@supabase/supabase-js'

export interface SimpleUser {
  id: string
  email: string
  username: string
}

// Debug function to check Supabase configuration
const debugSupabase = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const url = (import.meta as any).env?.VITE_SUPABASE_URL
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const key = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY
  
  console.log('Supabase Debug Info:')
  console.log('- URL:', url || 'MISSING')
  console.log('- Key:', key ? 'Present' : 'MISSING')
  console.log('- Configured:', isSupabaseConfigured)
  console.log('- Client:', supabase ? 'Initialized' : 'Not initialized')
  
  if (!url || !key) {
    console.error('❌ Supabase environment variables are missing!')
    return false
  }
  
  console.log('✅ Supabase configuration looks good')
  return true
}

export const simpleAuth = {
  // Clear authentication state (useful for handling token errors)
  async clearAuthState(): Promise<void> {
    try {
      await supabase.auth.signOut()
      // Also clear any potential stored session data
      localStorage.removeItem('supabase.auth.token')
      sessionStorage.removeItem('supabase.auth.token')
      console.log('✅ Authentication state cleared')
    } catch (error) {
      console.error('Error clearing auth state:', error)
    }
  },

  // Check if user is currently authenticated
  async isAuthenticated(): Promise<boolean> {
    debugSupabase() // Debug Supabase config
    
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      
      // Handle invalid refresh token error
      if (error && error.message.includes('Invalid Refresh Token')) {
        console.warn('⚠️ Invalid refresh token detected, clearing auth state...')
        await this.clearAuthState()
        return false
      }
      
      console.log('Auth check result:', { session: !!session, error })
      return !error && !!session
    } catch (error) {
      console.error('Auth check error:', error)
      
      // If it's a refresh token error, clear the state
      if (error instanceof Error && error.message.includes('Invalid Refresh Token')) {
        console.warn('⚠️ Clearing corrupted auth state...')
        await this.clearAuthState()
      }
      
      return false
    }
  },

  // Get current user
  async getCurrentUser(): Promise<SimpleUser | null> {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      
      if (error || !user) {
        return null
      }

      return {
        id: user.id,
        email: user.email || '',
        username: user.email?.split('@')[0] || 'admin'
      }
    } catch (error) {
      console.error('Get current user error:', error)
      return null
    }
  },

  // Login with email and password
  async login(email: string, password: string): Promise<{success: true, user: User, session: Session} | {success: false, error: string}> {
    console.log('=== simpleAuth.login called ===')
    console.log('- Email:', email)
    console.log('- Password length:', password.length)
    
    debugSupabase() // Check config first
    
    try {
      console.log('Calling supabase.auth.signInWithPassword...')
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      console.log('=== Supabase Response ===')
      console.log('- Data:', data)
      console.log('- Error:', error)
      console.log('- User exists:', !!data?.user)
      console.log('- Session exists:', !!data?.session)

      if (error) {
        console.log('Supabase error details:', {
          message: error.message,
          status: error.status,
          name: error.name
        })
        return {
          success: false,
          error: error.message
        }
      }

      if (data?.user?.email) {
        try {
          const knownRaw = localStorage.getItem('kdadks_known_auth_users');
          const known: any[] = knownRaw ? JSON.parse(knownRaw) : [];
          const userEmail = data.user.email.toLowerCase().trim();
          if (!known.some(u => (u.email || '').toLowerCase().trim() === userEmail)) {
            known.unshift({
              id: data.user.id,
              email: data.user.email,
              full_name: data.user.user_metadata?.full_name || data.user.email.split('@')[0],
              created_at: data.user.created_at,
            });
            localStorage.setItem('kdadks_known_auth_users', JSON.stringify(known));
          }
        } catch (e) {
          // ignore
        }
      }

      const result = {
        success: true as const,
        user: data.user,
        session: data.session
      }
      
      console.log('Login successful, returning:', result)
      return result
      
    } catch (error) {
      console.log('=== Login Error ===')
      console.error('Error details:', error)
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed'
      }
    }
  },

  // Logout
  async logout() {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Logout error:', error)
      }
    } catch (error) {
      console.error('Logout error:', error)
    }
  },

  // Create user
  async createUser(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/admin/dashboard`
        }
      })

      if (error) {
        throw new Error(error.message)
      }

      return {
        success: true,
        user: data.user
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'User creation failed'
      }
    }
  }
}
