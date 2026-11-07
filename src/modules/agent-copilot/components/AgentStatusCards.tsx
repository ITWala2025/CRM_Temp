/**
 * Autonomous CRM Agents & Copilot Module
 * Agent Status Pods & Overview Cards
 */

import React from 'react';
import {
  FileText,
  DollarSign,
  FileSignature,
  ShieldAlert,
  Compass,
} from 'lucide-react';
import { AgentType, AgentDiagnosticsStats } from '../types';
import { AGENT_ROSTER } from '../config';

interface AgentStatusCardsProps {
  stats: AgentDiagnosticsStats;
  selectedAgent: AgentType | 'all';
  onSelectAgent: (agent: AgentType | 'all') => void;
  isScanning: boolean;
}

export const AgentStatusCards: React.FC<AgentStatusCardsProps> = ({
  stats,
  selectedAgent,
  onSelectAgent,
  isScanning,
}) => {
  const getAgentIcon = (type: AgentType) => {
    switch (type) {
      case 'DealHealthAgent':
        return <FileText className="w-4 h-4 text-blue-600" />;
      case 'CollectionsAgent':
        return <DollarSign className="w-4 h-4 text-emerald-600" />;
      case 'ComplianceAgent':
        return <FileSignature className="w-4 h-4 text-purple-600" />;
      case 'FinanceAuditor':
        return <ShieldAlert className="w-4 h-4 text-amber-600" />;
      case 'CustomerScout':
        return <Compass className="w-4 h-4 text-indigo-600" />;
    }
  };

  const agents: AgentType[] = [
    'DealHealthAgent',
    'CollectionsAgent',
    'ComplianceAgent',
    'FinanceAuditor',
    'CustomerScout',
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 p-3 bg-slate-50 border-b border-slate-200 text-xs">
      {agents.map((agentType) => {
        const meta = AGENT_ROSTER[agentType];
        const agentStat = stats.agentStats[agentType];
        const isSelected = selectedAgent === agentType;
        const isDisabled = agentStat?.status === 'disabled';
        const count = agentStat?.activeCount || 0;

        return (
          <button
            key={agentType}
            onClick={() => onSelectAgent(isSelected ? 'all' : agentType)}
            disabled={isDisabled}
            className={`p-2.5 rounded-xl border text-left transition-all relative ${
              isSelected
                ? 'bg-white border-indigo-600 ring-2 ring-indigo-500/20 shadow-sm'
                : 'bg-white/80 border-slate-200 hover:border-slate-300 hover:bg-white'
            } ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className={`p-1.5 rounded-lg ${meta.themeColor.bg}`}>
                {getAgentIcon(agentType)}
              </div>
              {count > 0 ? (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700">
                  {count}
                </span>
              ) : (
                <span className="flex h-2 w-2 relative">
                  {isScanning ? (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                  ) : (
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  )}
                </span>
              )}
            </div>
            <p className="font-bold text-slate-800 text-[11px] truncate">{meta.shortLabel}</p>
            <p className="text-[10px] text-slate-500 truncate mt-0.5">
              {isDisabled ? 'Disabled in Plan' : isScanning ? 'Scanning...' : count > 0 ? `${count} items flagged` : 'Optimal'}
            </p>
          </button>
        );
      })}
    </div>
  );
};

export default AgentStatusCards;

