// Global Supabase error handler for authentication issues
import { supabase } from '../config/supabase'

export class SupabaseErrorHandler {
  private static instance: SupabaseErrorHandler
  private errorCount: number = 0
  private lastErrorTime: number = 0

  static getInstance(): SupabaseErrorHandler {
    if (!SupabaseErrorHandler.instance) {
      SupabaseErrorHandler.instance = new SupabaseErrorHandler()
    }
    return SupabaseErrorHandler.instance
  }

  // Handle authentication errors globally
  handleAuthError(error: any): boolean {
    const now = Date.now()
    
    // Prevent error spam (max 1 error per 5 seconds)
    if (now - this.lastErrorTime < 5000) {
      return false
    }
    
    this.lastErrorTime = now
    this.errorCount++

    console.error('🚨 Supabase Auth Error:', {
      message: error.message,
      name: error.name,
      status: error.status,
      errorCount: this.errorCount
    })

    // Handle specific error types
    if (this.isRefreshTokenError(error)) {
      return this.handleRefreshTokenError()
    }

    if (this.isNetworkError(error)) {
      return this.handleNetworkError()
    }

    if (this.isConfigError(error)) {
      return this.handleConfigError()
    }

    return false
  }

  private isRefreshTokenError(error: any): boolean {
    return error.message && (
      error.message.includes('Invalid Refresh Token') ||
      error.message.includes('Refresh Token Not Found') ||
      error.message.includes('refresh_token_not_found')
    )
  }

  private isNetworkError(error: any): boolean {
    return error.message && (
      error.message.includes('Network Error') ||
      error.message.includes('fetch') ||
      error.name === 'NetworkError'
    )
  }

  private isConfigError(error: any): boolean {
    return error.message && (
      error.message.includes('Invalid API key') ||
      error.message.includes('Project not found') ||
      error.status === 401
    )
  }

  private handleRefreshTokenError(): boolean {
    console.warn('🔧 Handling refresh token error...')
    
    try {
      // Clear authentication state
      supabase.auth.signOut()
      
      // Clear browser storage
      localStorage.removeItem('supabase.auth.token')
      sessionStorage.removeItem('supabase.auth.token')
      
      // Clear any other Supabase-related storage
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-')) {
          localStorage.removeItem(key)
        }
      })
      
      console.log('✅ Cleared corrupted authentication state')
      
      // Show user-friendly message
      if (this.errorCount <= 2) { // Only show for first few errors
        console.warn('⚠️ Your session has expired. Please refresh the page if needed.')
      }
      
      return true
    } catch (clearError) {
      console.error('❌ Failed to clear auth state:', clearError)
      return false
    }
  }

  private handleNetworkError(): boolean {
    console.warn('🌐 Network error detected. Supabase may be temporarily unavailable.')
    return false
  }

  private handleConfigError(): boolean {
    console.error('⚙️ Supabase configuration error. Check your environment variables.')
    return false
  }

  // Reset error tracking
  reset(): void {
    this.errorCount = 0
    this.lastErrorTime = 0
  }
}

// Global error handler instance
export const globalSupabaseErrorHandler = SupabaseErrorHandler.getInstance()

// Auto-handle uncaught Supabase errors
window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason
  
  if (error && typeof error === 'object' && 'message' in error) {
    if (error.message.includes('supabase') || error.message.includes('Invalid Refresh Token')) {
      console.log('🔍 Caught unhandled Supabase error:', error.message)
      
      if (globalSupabaseErrorHandler.handleAuthError(error)) {
        event.preventDefault() // Prevent the error from showing in console
      }
    }
  }
})

// Add global debug functions for manual fixes
declare global {
  interface Window {
    clearSupabaseAuth: () => void
    debugSupabaseAuth: () => void
  }
}

// Manual auth state clearing function (available in browser console)
window.clearSupabaseAuth = () => {
  console.log('🧹 Manually clearing Supabase authentication state...')
  
  // Clear Supabase auth
  supabase.auth.signOut()
  
  // Clear all storage
  localStorage.clear()
  sessionStorage.clear()
  
  // Clear cookies (if any)
  document.cookie.split(";").forEach((c) => {
    document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/")
  })
  
  console.log('✅ Authentication state cleared. Refresh the page.')
}

// Debug function (available in browser console)
window.debugSupabaseAuth = () => {
  console.log('🔍 Supabase Authentication Debug Info:')
  const env = (import.meta as any).env || {};
  console.log('- Environment configured:', !!(env.VITE_SUPABASE_URL && (env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY)))
  
  supabase.auth.getSession().then(({ data, error }) => {
    console.log('- Current Session:', data.session ? 'Active' : 'None')
    console.log('- Session Error:', error?.message || 'None')
    
    if (data.session) {
      console.log('- User:', data.session.user?.email || 'Unknown')
      console.log('- Expires:', new Date(data.session.expires_at! * 1000))
    }
  })
  
  console.log('\n💡 Manual fix commands:')
  console.log('- clearSupabaseAuth() - Clear all auth data')
  console.log('- debugSupabaseAuth() - Show this debug info')
}

export default SupabaseErrorHandler
