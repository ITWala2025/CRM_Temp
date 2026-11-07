/**
 * Autonomous CRM Agents & Copilot Module
 * Main Public Module Export Barrel
 *
 * This module is completely self-contained and can be exported out of this
 * CRM app into an external package (e.g. @acme/crm-agent-copilot) or reused
 * in any other React/TypeScript application.
 */

// Components
export { AgentCopilotCenter } from './components/AgentCopilotCenter';
export { AgentActionModal } from './components/AgentActionModal';
export { AgentAuditLogView } from './components/AgentAuditLogView';
export { AgentSettingsCard } from './components/AgentSettingsCard';
export { AgentStatusCards } from './components/AgentStatusCards';
export { AgentFeatureGate } from './components/AgentFeatureGate';

// Hooks
export { useAgentCopilot } from './hooks/useAgentCopilot';

// Services & Engines
export { agentEngine, AgentEngine, defaultDataProvider } from './services/agentEngine';
export { agentAuditService } from './services/agentAuditService';
export { agentActionService } from './services/agentActionService';
export { copilotSettingsService } from './services/copilotSettingsService';

// Config & Metadata
export { DEFAULT_AGENT_SETTINGS, AGENT_ROSTER, STORAGE_KEYS } from './config';

// Types
export type {
  AgentType,
  AgentActionType,
  AgentSeverity,
  AgentEntityType,
  AgentInsightStatus,
  AgentActionPayload,
  AgentInsight,
  AgentAuditRecord,
  AgentModuleSettings,
  AgentDiagnosticsStats,
  AgentCopilotCenterProps,
  AgentDataProvider,
} from './types';

// Default export is the primary Copilot Center component
export { default } from './components/AgentCopilotCenter';

