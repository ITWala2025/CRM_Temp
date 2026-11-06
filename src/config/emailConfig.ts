// Microsoft 365 Exchange SMTP Configuration
export const EMAIL_CONFIG = {
  SMTP_SERVER: 'smtp.office365.com',
  PORT: 587,
  SECURE: false, // STARTTLS on port 587
  // Note: Credentials should be set via environment variables for security
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  USERNAME: (import.meta as any).env?.VITE_SMTP_USER || '',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PASSWORD: (import.meta as any).env?.VITE_SMTP_PASSWORD || '',
}

export interface EmailData {
  to: string
  from: string
  subject: string
  text: string
  html?: string
}

export interface ContactFormData {
  name: string
  email: string
  company?: string
  message: string
  recaptchaToken?: string
  recaptchaAction?: string
}
