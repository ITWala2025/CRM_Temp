/**
 * Autonomous CRM Agents & Copilot Module
 * Agent Audit Stream & Traceability Service
 */

import { AgentAuditRecord, AgentInsight } from '../types';
import { STORAGE_KEYS } from '../config';

class AgentAuditService {
  private memoryCache: AgentAuditRecord[] | null = null;

  private loadRecords(): AgentAuditRecord[] {
    if (this.memoryCache) return this.memoryCache;

    if (typeof window === 'undefined') return [];

    try {
      const stored = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
      if (stored) {
        this.memoryCache = JSON.parse(stored);
        return this.memoryCache || [];
      }
    } catch (e) {
      console.warn('Failed to load agent audit logs:', e);
    }

    // Initialize with recent default sample audit trails
    const initialRecords: AgentAuditRecord[] = [
      {
        id: 'audit-init-01',
        agentName: 'CollectionsAgent',
        actionType: 'DRAFT_CREATED',
        entityType: 'invoice',
        entityId: 'inv-sample-1',
        payload: {
          invoiceNumber: 'INV-2026-004',
          balanceDue: 4800,
          daysOverdue: 22,
          recipient: 'accounts@nordictech.io',
        },
        status: 'PENDING_REVIEW',
        timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
        actorName: 'Collections & Cash Flow Chaser Agent',
      },
      {
        id: 'audit-init-02',
        agentName: 'DealHealthAgent',
        actionType: 'RECOMMENDATION',
        entityType: 'quote',
        entityId: 'quote-sample-2',
        payload: {
          quoteNumber: 'QTE-2026-009',
          subtotal: 12500,
          discountAmount: 2500,
          discountPercentage: 20,
        },
        status: 'PENDING_REVIEW',
        timestamp: new Date(Date.now() - 3600000 * 8).toISOString(),
        actorName: 'Deal Health & CPQ Estimator Agent',
      },
      {
        id: 'audit-init-03',
        agentName: 'FinanceAuditor',
        actionType: 'ALERT',
        entityType: 'expense',
        entityId: 'exp-sample-3',
        payload: {
          expenseNumber: 'EXP-2026-015',
          vendorName: 'AWS Cloud Services',
          amount: 6200,
          flagReason: 'Discretionary spend exceeding 5,000 threshold',
        },
        status: 'APPLIED',
        timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
        actorName: 'Finance Auditor Agent',
        resolutionNotes: 'Flagged for Controller signoff queue',
      },
    ];

    this.saveRecords(initialRecords);
    return initialRecords;
  }

  private saveRecords(records: AgentAuditRecord[]): void {
    this.memoryCache = records;
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(records));
      }
    } catch (e) {
      console.error('Failed to save agent audit logs:', e);
    }
  }

  public getAuditRecords(filter?: {
    agentName?: string;
    actionType?: string;
    entityType?: string;
    status?: string;
  }): AgentAuditRecord[] {
    const list = this.loadRecords();
    if (!filter) return list;

    return list.filter((rec) => {
      if (filter.agentName && rec.agentName !== filter.agentName) return false;
      if (filter.actionType && rec.actionType !== filter.actionType) return false;
      if (filter.entityType && rec.entityType !== filter.entityType) return false;
      if (filter.status && rec.status !== filter.status) return false;
      return true;
    });
  }

  public recordAction(data: {
    agentName: AgentAuditRecord['agentName'];
    actionType: AgentAuditRecord['actionType'];
    entityType: AgentAuditRecord['entityType'];
    entityId: string;
    payload: Record<string, any>;
    status: AgentAuditRecord['status'];
    actorName?: string;
    resolutionNotes?: string;
  }): AgentAuditRecord {
    const list = this.loadRecords();
    const newRecord: AgentAuditRecord = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...data,
    };

    list.unshift(newRecord);
    this.saveRecords(list);
    return newRecord;
  }

  public recordFromInsight(
    insight: AgentInsight,
    status: AgentAuditRecord['status'],
    resolutionNotes?: string,
    actorName?: string
  ): AgentAuditRecord {
    return this.recordAction({
      agentName: insight.agentName,
      actionType: insight.actionType,
      entityType: insight.entityType,
      entityId: insight.entityId,
      payload: {
        title: insight.title,
        description: insight.description,
        severity: insight.severity,
        ...(insight.metadata || {}),
      },
      status,
      resolutionNotes,
      actorName: actorName || 'CRM Operator (Human-in-the-Loop)',
    });
  }

  public updateRecordStatus(
    id: string,
    status: AgentAuditRecord['status'],
    resolutionNotes?: string
  ): boolean {
    const list = this.loadRecords();
    const idx = list.findIndex((r) => r.id === id);
    if (idx === -1) return false;

    list[idx] = {
      ...list[idx],
      status,
      resolutionNotes: resolutionNotes || list[idx].resolutionNotes,
    };
    this.saveRecords(list);
    return true;
  }

  public exportToJson(): string {
    const records = this.loadRecords();
    return JSON.stringify(records, null, 2);
  }

  public exportToCsv(): string {
    const records = this.loadRecords();
    if (records.length === 0) return 'id,timestamp,agentName,actionType,entityType,entityId,status,actorName';

    const headers = ['id', 'timestamp', 'agentName', 'actionType', 'entityType', 'entityId', 'status', 'actorName', 'notes'];
    const rows = records.map((r) => {
      return [
        r.id,
        r.timestamp,
        r.agentName,
        r.actionType,
        r.entityType,
        r.entityId,
        r.status,
        `"${(r.actorName || '').replace(/"/g, '""')}"`,
        `"${(r.resolutionNotes || '').replace(/"/g, '""')}"`,
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  public clearAuditLog(): void {
    this.saveRecords([]);
  }
}

export const agentAuditService = new AgentAuditService();
export default agentAuditService;

