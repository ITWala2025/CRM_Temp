// Backup email service using Web3Forms
// This provides a fallback when Netlify Functions are not working

export class BackupEmailService {
  private static readonly WEB3FORMS_ACCESS_KEY = '8f9e4b2a-1234-5678-9abc-def012345678'; // Replace with actual key

  static async sendEmailViaWeb3Forms(emailData: any) {
    try {
      const formData = new FormData();
      formData.append('access_key', this.WEB3FORMS_ACCESS_KEY);
      formData.append('subject', emailData.subject);
      formData.append('email', emailData.from || 'contact@kdadks.com');
      formData.append('message', emailData.text || emailData.html?.replace(/<[^>]*>/g, ''));
      formData.append('redirect', 'false');

      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        return {
          success: true,
          message: 'Email sent successfully via backup service',
          provider: 'web3forms'
        };
      } else {
        throw new Error(result.message || 'Web3Forms failed');
      }
    } catch (error) {
      console.error('Web3Forms backup failed:', error);
      throw error;
    }
  }

  // Create a simple contact form that sends directly to support email
  static createMailtoFallback(emailData: any) {
    const { subject, text, html } = emailData;
    const body = text || html?.replace(/<[^>]*>/g, '') || 'Message from KDADKS website';
    
    const mailtoUrl = `mailto:contact@kdadks.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    // Open in new window/tab
    window.open(mailtoUrl, '_blank');
    
    return {
      success: true,
      message: 'Email client opened. Please send manually if the form did not work.',
      fallback: true
    };
  }
}
