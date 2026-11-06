import { supabase, isSupabaseConfigured } from '../config/supabase';
import { invoiceService } from './invoiceService';
import { EmailService } from './emailService';
import type { Customer } from '../types/invoice';

export interface CustomerLoginResult {
  success: boolean;
  customer?: Customer;
  mustChangePassword?: boolean;
  message?: string;
}

export class CustomerAuthService {
  private static readonly MAX_FAILED_ATTEMPTS = 5;
  private static readonly LOCK_DURATION_MINUTES = 30;

  /**
   * Hash password using Web Crypto PBKDF2 with SHA-256
   */
  private static async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const salt = crypto.getRandomValues(new Uint8Array(16));

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      data,
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      256
    );

    const hashArray = Array.from(new Uint8Array(derivedBits));
    const saltArray = Array.from(salt);

    return `pbkdf2:sha256:100000$${saltArray.map((b) => b.toString(16).padStart(2, '0')).join('')}$${hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')}`;
  }

  /**
   * Verify password against stored PBKDF2 hash
   */
  private static async verifyPassword(password: string, storedHash: string): Promise<boolean> {
    try {
      const parts = storedHash.split('$');
      if (parts.length !== 3 || !parts[0].startsWith('pbkdf2:sha256:')) {
        return false;
      }

      const iterations = parseInt(parts[0].split(':')[2], 10);
      const saltHex = parts[1];
      const hashHex = parts[2];

      const saltMatch = saltHex.match(/.{2}/g);
      const hashMatch = hashHex.match(/.{2}/g);

      if (!saltMatch || !hashMatch) return false;

      const salt = new Uint8Array(saltMatch.map((b) => parseInt(b, 16)));
      const storedHashBytes = new Uint8Array(hashMatch.map((b) => parseInt(b, 16)));

      const encoder = new TextEncoder();
      const data = encoder.encode(password);

      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        data,
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
      );

      const derivedBits = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: iterations,
          hash: 'SHA-256',
        },
        keyMaterial,
        256
      );

      const computedHashBytes = new Uint8Array(derivedBits);
      if (computedHashBytes.length !== storedHashBytes.length) return false;

      for (let i = 0; i < computedHashBytes.length; i++) {
        if (computedHashBytes[i] !== storedHashBytes[i]) return false;
      }

      return true;
    } catch (err) {
      console.error('CustomerAuthService.verifyPassword error:', err);
      return false;
    }
  }

  /**
   * Helper method to lookup a customer by ID UUID, Customer Code, Email, or Company Name
   */
  static async findCustomerForAuth(queryVal: string): Promise<Customer | null> {
    const trimmed = queryVal.trim();
    if (!trimmed) return null;

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);

    if (isSupabaseConfigured) {
      if (isUuid) {
        const { data, error } = await supabase
          .from('customers')
          .select('*, country:countries(*)')
          .eq('id', trimmed)
          .maybeSingle();

        if (!error && data) return data as Customer;
      }

      // Try exact match on email or customer_code
      const { data: exactData } = await supabase
        .from('customers')
        .select('*, country:countries(*)')
        .or(`email.ilike.${trimmed},customer_code.ilike.${trimmed}`);

      if (exactData && exactData.length > 0) {
        return exactData[0] as Customer;
      }
    }

    // Fallback search via invoiceService
    const res = await invoiceService.getCustomers({ search: trimmed }, 1, 50);
    const matched = res.data.find(
      (c) =>
        c.id === trimmed ||
        c.email?.toLowerCase() === trimmed.toLowerCase() ||
        c.customer_code?.toLowerCase() === trimmed.toLowerCase() ||
        c.customer_code?.toLowerCase().endsWith(trimmed.toLowerCase()) ||
        c.company_name?.toLowerCase().includes(trimmed.toLowerCase())
    );

    return matched || null;
  }

  /**
   * Authenticate customer using Customer Code, ID UUID, or Email and Passcode
   */
  static async login(emailOrCode: string, password?: string): Promise<CustomerLoginResult> {
    const queryVal = emailOrCode.trim();

    // Query customer by ID, code, or email
    const customer = await this.findCustomerForAuth(queryVal);

    if (!customer) {
      return { success: false, message: 'Invalid Customer Code, Email or Account ID. Record not found.' };
    }

    // Check account locking
    if (customer.locked_until && new Date(customer.locked_until) > new Date()) {
      return {
        success: false,
        message: `Account temporarily locked due to multiple failed login attempts. Try again after ${new Date(customer.locked_until).toLocaleTimeString()}.`,
      };
    }

    // If password is provided and stored hash exists, verify password
    if (password && customer.password_hash) {
      const isValid = await this.verifyPassword(password, customer.password_hash);
      if (!isValid) {
        // Increment failed attempts
        const attempts = (customer.failed_login_attempts || 0) + 1;
        let lockUntil: string | null = null;
        if (attempts >= this.MAX_FAILED_ATTEMPTS) {
          const lockTime = new Date();
          lockTime.setMinutes(lockTime.getMinutes() + this.LOCK_DURATION_MINUTES);
          lockUntil = lockTime.toISOString();
        }

        if (isSupabaseConfigured) {
          await supabase
            .from('customers')
            .update({ failed_login_attempts: attempts, locked_until: lockUntil })
            .eq('id', customer.id);
        }

        return { success: false, message: 'Incorrect security passcode or password.' };
      }
    }

    // Reset failed login attempts on successful login
    if (isSupabaseConfigured && (customer.failed_login_attempts || 0) > 0) {
      await supabase.from('customers').update({ failed_login_attempts: 0, locked_until: null }).eq('id', customer.id);
    }

    return {
      success: true,
      customer,
      mustChangePassword: customer.must_change_password ?? false,
    };
  }

  /**
   * Request Password Reset Email via Resend
   */
  static async requestPasswordReset(emailOrCode: string): Promise<{ success: boolean; message: string }> {
    const queryVal = emailOrCode.trim();
    const customer = await this.findCustomerForAuth(queryVal);

    if (!customer) {
      return { success: false, message: 'Customer account not found.' };
    }

    // Generate 24h reset token
    const token = `csreset_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    if (isSupabaseConfigured) {
      await supabase
        .from('customers')
        .update({
          password_reset_token: token,
          password_reset_expires_at: expiresAt.toISOString(),
        })
        .eq('id', customer.id);
    }

    const resetUrl = `${window.location.origin}/portal/reset-password?token=${token}`;
    await EmailService.sendCustomerPasswordResetEmail(customer, token, resetUrl);

    return {
      success: true,
      message: `Password reset instructions sent to ${customer.email || 'account email'}. Please check your inbox.`,
    };
  }

  /**
   * Reset Customer Password using 24h Token
   */
  static async resetPasswordWithToken(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    if (!token || !newPassword.trim()) {
      return { success: false, message: 'Invalid reset request params.' };
    }

    let customer: Customer | null = null;

    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('password_reset_token', token)
        .maybeSingle();

      if (error || !data) {
        return { success: false, message: 'Invalid or expired password reset token.' };
      }
      customer = data as Customer;
    }

    if (!customer) {
      return { success: false, message: 'Invalid or expired token.' };
    }

    if (customer.password_reset_expires_at && new Date(customer.password_reset_expires_at) < new Date()) {
      return { success: false, message: 'Password reset token has expired. Please request a new link.' };
    }

    const newHash = await this.hashPassword(newPassword.trim());

    if (isSupabaseConfigured) {
      await supabase
        .from('customers')
        .update({
          password_hash: newHash,
          must_change_password: false,
          password_reset_token: null,
          password_reset_expires_at: null,
          failed_login_attempts: 0,
          locked_until: null,
        })
        .eq('id', customer.id);
    }

    return { success: true, message: 'Password reset successfully! You can now sign in with your new password.' };
  }

  /**
   * Change Password inside Customer Portal for authenticated customer
   */
  static async changePassword(
    customerId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    const customer = await invoiceService.getCustomerById(customerId);
    if (!customer) return { success: false, message: 'Customer record not found.' };

    if (customer.password_hash) {
      const isValid = await this.verifyPassword(currentPassword, customer.password_hash);
      if (!isValid) return { success: false, message: 'Current password does not match our records.' };
    }

    const newHash = await this.hashPassword(newPassword.trim());

    if (isSupabaseConfigured) {
      await supabase
        .from('customers')
        .update({
          password_hash: newHash,
          must_change_password: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', customerId);
    }

    return { success: true, message: 'Password changed successfully.' };
  }

  /**
   * Set Initial/Temporary Passcode by Admin and Dispatch Welcome Email
   */
  static async setCustomerInitialPassword(
    customerId: string,
    tempPassword: string
  ): Promise<{ success: boolean; message: string }> {
    const customer = await invoiceService.getCustomerById(customerId);
    if (!customer) return { success: false, message: 'Customer record not found.' };

    const newHash = await this.hashPassword(tempPassword.trim());

    if (isSupabaseConfigured) {
      await supabase
        .from('customers')
        .update({
          password_hash: newHash,
          must_change_password: true,
          failed_login_attempts: 0,
          locked_until: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', customerId);
    }

    // Trigger Welcome Email via Resend API
    await EmailService.sendCustomerWelcomeCredentialsEmail(customer, tempPassword);

    return {
      success: true,
      message: `Initial passcode set for ${customer.company_name}. Welcome credentials email sent to ${customer.email || 'customer'}.`,
    };
  }
}

export default CustomerAuthService;
