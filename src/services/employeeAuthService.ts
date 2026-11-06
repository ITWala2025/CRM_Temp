import { supabase } from '../config/supabase';
import type { Employee } from '../types/employee';

interface LoginResult {
  success: boolean;
  employee?: Employee;
  requirePasswordChange?: boolean;
  passwordExpiringSoon?: boolean;
  daysUntilExpiry?: number;
  message?: string;
}

interface PasswordChangeResult {
  success: boolean;
  message: string;
}

class EmployeeAuthService {
  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly LOCK_DURATION_MINUTES = 30;

  /**
   * Hash password using bcrypt-compatible method
   * In production, this should use bcrypt or similar library
   */
  private async hashPassword(password: string): Promise<string> {
    // For browser compatibility, using Web Crypto API with PBKDF2
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
        hash: 'SHA-256'
      },
      keyMaterial,
      256
    );

    const hashArray = Array.from(new Uint8Array(derivedBits));
    const saltArray = Array.from(salt);
    
    // Combine salt and hash for storage
    return `pbkdf2:sha256:100000$${saltArray.map(b => b.toString(16).padStart(2, '0')).join('')}$${hashArray.map(b => b.toString(16).padStart(2, '0')).join('')}`;
  }

  /**
   * Verify password against stored hash
   */
  private async verifyPassword(password: string, storedHash: string): Promise<boolean> {
    try {
      const parts = storedHash.split('$');
      if (parts.length !== 3 || !parts[0].startsWith('pbkdf2:sha256:')) {
        return false;
      }

      const iterations = parseInt(parts[0].split(':')[2]);
      const saltHex = parts[1];
      const hashHex = parts[2];

      // Convert hex strings back to Uint8Array
      const saltMatch = saltHex.match(/.{2}/g);
      const hashMatch = hashHex.match(/.{2}/g);
      
      if (!saltMatch || !hashMatch) {
        return false;
      }

      const salt = new Uint8Array(saltMatch.map(byte => parseInt(byte, 16)));
      const storedHashBytes = new Uint8Array(hashMatch.map(byte => parseInt(byte, 16)));

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
          hash: 'SHA-256'
        },
        keyMaterial,
        256
      );

      const derivedArray = new Uint8Array(derivedBits);
      
      // Constant-time comparison
      return this.constantTimeCompare(derivedArray, storedHashBytes);
    } catch (error) {
      console.error('Password verification error:', error);
      return false;
    }
  }

  /**
   * Constant-time comparison to prevent timing attacks
   */
  private constantTimeCompare(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a[i] ^ b[i];
    }
    return result === 0;
  }

  /**
   * Generate random temporary password
   */
  generateTemporaryPassword(length: number = 12): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*';
    const allChars = uppercase + lowercase + numbers + symbols;

    let password = '';
    // Ensure at least one of each type
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];

    // Fill rest randomly
    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Shuffle password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  /**
   * Login employee with email and password
   */
  async login(email: string, password: string): Promise<LoginResult> {
    try {
      // Fetch employee by email (case-insensitive)
      const { data: employee, error } = await supabase
        .from('employees')
        .select('*')
        .ilike('email', email)
        .eq('employment_status', 'active')
        .single();

      if (error || !employee) {
        return {
          success: false,
          message: 'Invalid email or password'
        };
      }

      // Check if account is locked
      if (employee.account_locked && employee.locked_until) {
        const lockedUntil = new Date(employee.locked_until);
        if (lockedUntil > new Date()) {
          const minutesLeft = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000);
          return {
            success: false,
            message: `Account is locked. Try again in ${minutesLeft} minutes.`
          };
        } else {
          // Unlock account if lock period expired
          await this.unlockAccount(employee.id);
          employee.account_locked = false;
          employee.failed_login_attempts = 0;
        }
      }

      // Verify password
      if (!employee.password_hash) {
        return {
          success: false,
          message: 'Password not set. Contact administrator.'
        };
      }

      const isPasswordValid = await this.verifyPassword(password, employee.password_hash);

      if (!isPasswordValid) {
        // Increment failed attempts
        await this.handleFailedLogin(employee.id, employee.failed_login_attempts || 0);
        
        const remainingAttempts = this.MAX_FAILED_ATTEMPTS - (employee.failed_login_attempts || 0) - 1;
        
        if (remainingAttempts <= 0) {
          return {
            success: false,
            message: `Account locked due to too many failed attempts. Try again in ${this.LOCK_DURATION_MINUTES} minutes.`
          };
        }

        return {
          success: false,
          message: `Invalid email or password. ${remainingAttempts} attempts remaining.`
        };
      }

      // Check 90-day password expiry policy before granting access
      const PASSWORD_EXPIRY_DAYS = 90;
      const PASSWORD_WARNING_DAYS = 10;
      let passwordExpiringSoon = false;
      let daysUntilExpiry: number | undefined;

      if (employee.password_changed_at && !employee.is_first_login) {
        const lastChanged = new Date(employee.password_changed_at);
        const daysSinceChange = Math.floor((Date.now() - lastChanged.getTime()) / (1000 * 60 * 60 * 24));
        const remaining = PASSWORD_EXPIRY_DAYS - daysSinceChange;
        if (remaining <= 0) {
          // Password expired — deny login entirely
          return {
            success: false,
            message: 'Your password has expired and your account is locked. Please contact your administrator to reinstate access.'
          };
        } else if (remaining <= PASSWORD_WARNING_DAYS) {
          passwordExpiringSoon = true;
          daysUntilExpiry = remaining;
        }
      }

      // Successful login — reset failed attempts and update last login
      await supabase
        .from('employees')
        .update({
          failed_login_attempts: 0,
          last_login_at: new Date().toISOString()
        })
        .eq('id', employee.id);

      return {
        success: true,
        employee,
        requirePasswordChange: employee.is_first_login || false,
        passwordExpiringSoon,
        daysUntilExpiry
      };

    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        message: 'An error occurred during login. Please try again.'
      };
    }
  }

  /**
   * Handle failed login attempt
   */
  private async handleFailedLogin(employeeId: string, currentAttempts: number): Promise<void> {
    const newAttempts = currentAttempts + 1;
    
    const updates: Record<string, unknown> = {
      failed_login_attempts: newAttempts
    };

    // Lock account if max attempts reached
    if (newAttempts >= this.MAX_FAILED_ATTEMPTS) {
      const lockUntil = new Date();
      lockUntil.setMinutes(lockUntil.getMinutes() + this.LOCK_DURATION_MINUTES);
      
      updates.account_locked = true;
      updates.locked_until = lockUntil.toISOString();
    }

    await supabase
      .from('employees')
      .update(updates)
      .eq('id', employeeId);
  }

  /**
   * Unlock employee account
   */
  private async unlockAccount(employeeId: string): Promise<void> {
    await supabase
      .from('employees')
      .update({
        account_locked: false,
        failed_login_attempts: 0,
        locked_until: null
      })
      .eq('id', employeeId);
  }

  /**
   * Change password for first-time login or password reset
   */
  async changePassword(
    employeeId: string,
    oldPassword: string,
    newPassword: string,
    isFirstLogin: boolean = false
  ): Promise<PasswordChangeResult> {
    try {
      // Validate password strength
      const validation = this.validatePasswordStrength(newPassword);
      if (!validation.isValid) {
        return {
          success: false,
          message: validation.message || 'Password does not meet requirements'
        };
      }

      // Fetch current employee data
      const { data: employee, error: fetchError } = await supabase
        .from('employees')
        .select('password_hash, is_first_login')
        .eq('id', employeeId)
        .single();

      if (fetchError || !employee) {
        return {
          success: false,
          message: 'Employee not found'
        };
      }

      // For non-first login, verify old password
      if (!isFirstLogin && employee.password_hash) {
        const isOldPasswordValid = await this.verifyPassword(oldPassword, employee.password_hash);
        if (!isOldPasswordValid) {
          return {
            success: false,
            message: 'Current password is incorrect'
          };
        }
      }

      // Hash new password
      const newPasswordHash = await this.hashPassword(newPassword);

      // Update password
      const { error: updateError } = await supabase
        .from('employees')
        .update({
          password_hash: newPasswordHash,
          is_first_login: false,
          password_changed_at: new Date().toISOString()
        })
        .eq('id', employeeId);

      if (updateError) {
        throw updateError;
      }

      return {
        success: true,
        message: 'Password changed successfully. Please login with your new password.'
      };

    } catch (error) {
      console.error('Password change error:', error);
      return {
        success: false,
        message: 'An error occurred while changing password. Please try again.'
      };
    }
  }

  /**
   * Set temporary password for new employee (admin function)
   */
  async setTemporaryPassword(employeeId: string, temporaryPassword: string): Promise<PasswordChangeResult> {
    try {
      const passwordHash = await this.hashPassword(temporaryPassword);

      const { error } = await supabase
        .from('employees')
        .update({
          password_hash: passwordHash,
          is_first_login: true,
          password_changed_at: new Date().toISOString()
        })
        .eq('id', employeeId);

      if (error) {
        throw error;
      }

      return {
        success: true,
        message: 'Temporary password set successfully'
      };

    } catch (error) {
      console.error('Set temporary password error:', error);
      return {
        success: false,
        message: 'Failed to set temporary password'
      };
    }
  }

  /**
   * Validate password strength
   */
  validatePasswordStrength(password: string): { isValid: boolean; message?: string } {
    if (password.length < 8) {
      return { isValid: false, message: 'Password must be at least 8 characters long' };
    }

    if (!/[A-Z]/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one uppercase letter' };
    }

    if (!/[a-z]/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one lowercase letter' };
    }

    if (!/[0-9]/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one number' };
    }

    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one special character' };
    }

    return { isValid: true };
  }

  /**
   * Logout employee
   */
  logout(): void {
    // Clear session storage
    sessionStorage.removeItem('employee_session');
    localStorage.removeItem('employee_session');
  }
}

export const employeeAuthService = new EmployeeAuthService();
