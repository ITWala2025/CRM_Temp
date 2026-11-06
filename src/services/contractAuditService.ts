import { supabase } from '../config/supabase';
import { simpleAuth } from '../utils/simpleAuth';
import type { ContractAuditLog } from '../types/contract';

class ContractAuditService {
  async log(
    contractId: string,
    action: ContractAuditLog['action'],
    fieldName?: string,
    oldValue?: string,
    newValue?: string
  ): Promise<void> {
    try {
      const user = await simpleAuth.getCurrentUser();
      await supabase.from('contract_audit_logs').insert({
        contract_id: contractId,
        user_id: user?.id ?? null,
        user_email: user?.email ?? null,
        action,
        field_name: fieldName ?? null,
        old_value: oldValue ?? null,
        new_value: newValue ?? null,
      });
    } catch (err) {
      // Audit logging is non-blocking — never throws
      console.warn('Audit log failed:', err);
    }
  }

  async getLogsForContract(contractId: string): Promise<ContractAuditLog[]> {
    const { data, error } = await supabase
      .from('contract_audit_logs')
      .select('*')
      .eq('contract_id', contractId)
      .order('changed_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as ContractAuditLog[];
  }
}

export const contractAuditService = new ContractAuditService();
