/**
 * Autonomous CRM Agents & Copilot Module
 * React Hook for Copilot State & Actions
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { AgentInsight, AgentDiagnosticsStats, AgentType, AgentSeverity } from '../types';
import { agentEngine } from '../services/agentEngine';
import { copilotSettingsService } from '../services/copilotSettingsService';
import { agentAuditService } from '../services/agentAuditService';
import { agentActionService } from '../services/agentActionService';

export type CopilotTab = 'all' | 'alerts' | 'recommendations' | 'drafts' | 'audit' | 'settings';

export function useAgentCopilot(companyId?: string) {
  const [isModuleEnabled, setIsModuleEnabled] = useState<boolean>(() =>
    copilotSettingsService.isModuleEnabled()
  );
  const [settings, setSettings] = useState(() => copilotSettingsService.getSettings());
  const [insights, setInsights] = useState<AgentInsight[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<CopilotTab>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<AgentSeverity | 'all'>('all');
  const [agentFilter, setAgentFilter] = useState<AgentType | 'all'>('all');
  const [selectedInsightForAction, setSelectedInsightForAction] = useState<AgentInsight | null>(null);
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);

  // Sync settings whenever they change
  useEffect(() => {
    const unsubscribe = copilotSettingsService.subscribe((updated) => {
      setSettings(updated);
      setIsModuleEnabled(updated.enabled);
    });
    return unsubscribe;
  }, []);

  // Run initial scan
  const scan = useCallback(async () => {
    if (!copilotSettingsService.isModuleEnabled()) {
      setInsights([]);
      return;
    }
    setIsRunning(true);
    try {
      const results = await agentEngine.runAllAgents(companyId);
      setInsights(results);
      setLastScanTime(new Date().toISOString());
    } catch (err) {
      console.error('Agent Copilot scan error:', err);
    } finally {
      setIsRunning(false);
    }
  }, [companyId]);

  // Trigger scan when companyId changes or module is enabled
  useEffect(() => {
    if (isModuleEnabled) {
      scan();
    }
  }, [companyId, isModuleEnabled, scan]);

  // Dismiss an insight
  const dismissInsight = useCallback((insight: AgentInsight, reason?: string) => {
    setInsights((prev) => prev.filter((i) => i.id !== insight.id));
    agentActionService.dismissInsight(insight, reason);
  }, []);

  // Remove insight from active list when action is applied
  const markApplied = useCallback((insightId: string) => {
    setInsights((prev) => prev.filter((i) => i.id !== insightId));
  }, []);

  // Filtered insights based on tab, search query, severity, and agent
  const filteredInsights = useMemo(() => {
    return insights.filter((i) => {
      // Tab filter
      if (activeTab === 'alerts' && i.actionType !== 'ALERT') return false;
      if (activeTab === 'recommendations' && i.actionType !== 'RECOMMENDATION') return false;
      if (activeTab === 'drafts' && i.actionType !== 'DRAFT_CREATED') return false;

      // Severity filter
      if (severityFilter !== 'all' && i.severity !== severityFilter) return false;

      // Agent filter
      if (agentFilter !== 'all' && i.agentName !== agentFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = i.title.toLowerCase().includes(q);
        const matchesDesc = i.description.toLowerCase().includes(q);
        const matchesAgent = i.agentLabel.toLowerCase().includes(q);
        const matchesEntity = i.entityType.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesAgent && !matchesEntity) return false;
      }

      return true;
    });
  }, [insights, activeTab, severityFilter, agentFilter, searchQuery]);

  // Compute diagnostics and agent pods statistics
  const stats: AgentDiagnosticsStats = useMemo(() => {
    const activeAnomalies = insights.filter((i) => i.actionType === 'ALERT').length;
    const pendingReview = insights.length;
    const auditLogs = agentAuditService.getAuditRecords();
    const appliedCount = auditLogs.filter((r) => r.status === 'APPLIED').length;
    const dismissedCount = auditLogs.filter((r) => r.status === 'DISMISSED').length;

    const agentStatsRecord = (agentType: AgentType) => {
      const isAgentActive = settings.agents[
        agentType === 'DealHealthAgent'
          ? 'dealHealth'
          : agentType === 'CollectionsAgent'
          ? 'collections'
          : agentType === 'ComplianceAgent'
          ? 'compliance'
          : agentType === 'FinanceAuditor'
          ? 'financeAuditor'
          : 'customerScout'
      ];
      return {
        activeCount: insights.filter((i) => i.agentName === agentType).length,
        lastRun: lastScanTime || new Date().toISOString(),
        status: !settings.enabled || !isAgentActive ? ('disabled' as const) : ('active' as const),
      };
    };

    return {
      totalScanned: insights.length + appliedCount + dismissedCount,
      activeAnomalies,
      pendingReview,
      appliedCount,
      dismissedCount,
      lastRunTimestamp: lastScanTime,
      agentStats: {
        DealHealthAgent: agentStatsRecord('DealHealthAgent'),
        CollectionsAgent: agentStatsRecord('CollectionsAgent'),
        ComplianceAgent: agentStatsRecord('ComplianceAgent'),
        FinanceAuditor: agentStatsRecord('FinanceAuditor'),
        CustomerScout: agentStatsRecord('CustomerScout'),
      },
    };
  }, [insights, lastScanTime, settings]);

  return {
    isModuleEnabled,
    settings,
    insights,
    filteredInsights,
    isRunning,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    severityFilter,
    setSeverityFilter,
    agentFilter,
    setAgentFilter,
    stats,
    selectedInsightForAction,
    setSelectedInsightForAction,
    scan,
    dismissInsight,
    markApplied,
  };
}

