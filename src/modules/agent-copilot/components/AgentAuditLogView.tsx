/**
 * Autonomous CRM Agents & Copilot Module
 * Agent Audit Trail & Governance Viewer
 */

import React, { useState, useEffect } from 'react';
import {
  Download,
  Filter,
  CheckCircle2,
  Clock,
  ShieldCheck,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { AgentAuditRecord } from '../types';
import { agentAuditService } from '../services/agentAuditService';

export const AgentAuditLogView: React.FC = () => {
  const [records, setRecords] = useState<AgentAuditRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const loadLogs = () => {
    setRecords(agentAuditService.getAuditRecords());
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const handleExportCsv = () => {
    const csvContent = agentAuditService.exportToCsv();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `agent-audit-trail-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJson = () => {
    const jsonContent = agentAuditService.exportToJson();
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `agent-audit-trail-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredRecords = records.filter((rec) => {
    if (statusFilter !== 'all' && rec.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchActor = (rec.actorName || '').toLowerCase().includes(q);
      const matchAgent = rec.agentName.toLowerCase().includes(q);
      const matchEntity = rec.entityType.toLowerCase().includes(q);
      const matchNotes = (rec.resolutionNotes || '').toLowerCase().includes(q);
      if (!matchActor && !matchAgent && !matchEntity && !matchNotes) return false;
    }
    return true;
  });

  const getStatusBadge = (status: AgentAuditRecord['status']) => {
    switch (status) {
      case 'APPLIED':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800">Applied</span>;
      case 'APPROVED':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-800">Approved</span>;
      case 'DISMISSED':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-700">Dismissed</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800">Pending Review</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
        <div className="flex items-center space-x-2">
          <input
            type="text"
            placeholder="Search audit trail..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48 sm:w-64"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="all">All Statuses</option>
            <option value="APPLIED">Applied</option>
            <option value="APPROVED">Approved</option>
            <option value="DISMISSED">Dismissed</option>
            <option value="PENDING_REVIEW">Pending Review</option>
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={loadLogs}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            title="Refresh logs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleExportCsv}
            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center space-x-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
          <button
            onClick={handleExportJson}
            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center space-x-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>JSON</span>
          </button>
        </div>
      </div>

      {/* Audit Log Stream */}
      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
        {filteredRecords.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            No audit records found matching your filters.
          </div>
        ) : (
          filteredRecords.map((rec) => (
            <div key={rec.id} className="p-3.5 hover:bg-slate-50 transition-colors flex items-start justify-between space-x-3 text-xs">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-slate-900">{rec.agentName}</span>
                  <span className="text-slate-400">&bull;</span>
                  <span className="font-mono text-[10px] text-slate-500 uppercase">{rec.entityType} ({rec.entityId})</span>
                  {getStatusBadge(rec.status)}
                </div>
                {rec.resolutionNotes && (
                  <p className="text-slate-600 text-xs">{rec.resolutionNotes}</p>
                )}
                <div className="flex items-center space-x-2 text-[10px] text-slate-400">
                  <span>Actor: {rec.actorName || 'System'}</span>
                  <span>&bull;</span>
                  <span>{new Date(rec.timestamp).toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AgentAuditLogView;

