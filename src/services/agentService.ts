/**
 * Agent Service
 * Wraps the modular agent engine: src/modules/agent-copilot
 */

import {
  agentEngine,
  AgentInsight,
  AgentAuditRecord,
  agentAuditService,
  agentActionService,
  copilotSettingsService,
} from '../modules/agent-copilot';

export type { AgentInsight, AgentAuditRecord };

export const agentService = {
  /**
   * Run Deal Health & Quote Estimator Agent
   */
  async runDealHealthAgent(companyId?: string): Promise<AgentInsight[]> {
    return agentEngine.runDealHealthAgent(companyId);
  },

  /**
   * Run Collections & Cash Flow Chaser Agent
   */
  async runCollectionsAgent(companyId?: string): Promise<AgentInsight[]> {
    return agentEngine.runCollectionsAgent(companyId);
  },

  /**
   * Run Contract Lifecycle & Compliance Agent
   */
  async runComplianceAgent(companyId?: string): Promise<AgentInsight[]> {
    return agentEngine.runComplianceAgent(companyId);
  },

  /**
   * Run Financial Anomaly & Expense Auditor Agent
   */
  async runFinanceAuditorAgent(companyId?: string): Promise<AgentInsight[]> {
    return agentEngine.runFinanceAuditorAgent(companyId);
  },

  /**
   * Run Customer 360 Scout Agent
   */
  async runCustomerScoutAgent(): Promise<AgentInsight[]> {
    return agentEngine.runCustomerScoutAgent();
  },

  /**
   * Run all agents and aggregate insights
   */
  async runAllAgents(companyId?: string): Promise<AgentInsight[]> {
    return agentEngine.runAllAgents(companyId);
  },

  /**
   * Audit and action services
   */
  audit: agentAuditService,
  actions: agentActionService,
  settings: copilotSettingsService,
};

export default agentService;
