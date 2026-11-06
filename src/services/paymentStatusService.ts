// Payment Status Service
import { supabase } from '../config/supabase';

export class PaymentStatusService {
  /**
   * Get payment status from database
   */
  static async getPaymentStatus(paymentRequestId: string) {
    try {
      const { data: paymentRequest, error: requestError } = await supabase
        .from('payment_requests')
        .select(`
          *,
          payment_transactions (*)
        `)
        .eq('id', paymentRequestId)
        .single();

      if (requestError) {
        console.error('❌ Error fetching payment status:', requestError);
        return null;
      }

      return paymentRequest;

    } catch (error) {
      console.error('❌ Error getting payment status:', error);
      return null;
    }
  }
}
