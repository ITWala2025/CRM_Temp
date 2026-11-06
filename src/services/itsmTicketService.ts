import { supabase, isSupabaseConfigured } from '../config/supabase';
import { simpleAuth } from '../utils/simpleAuth';
import {
  ITSMTicket,
  ITSMComment,
  ITSMAuditLog,
  ITSMTicketCategory,
  TicketFilters,
  TicketFormData,
  BulkActionData,
  TriageDeskMetrics,
  TicketStatus,
  TicketPriority,
  TicketType,
} from '../types/itsm';
import { ITSMSlaService } from './itsmSlaService';
import { ITSMAttachmentService } from './itsmAttachmentService';
import { ITSMCsatService } from './itsmCsatService';
import { EmailService } from './emailService';

export class ITSMTicketService {
  /**
   * Generates a unique, formatted ITSM ticket number (e.g. INC-20260903-0001)
   */
  static async generateTicketNumber(ticketType: TicketType = 'incident'): Promise<string> {
    const prefix = ticketType === 'service_request' ? 'REQ' : ticketType === 'problem' ? 'PRB' : 'INC';
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('get_next_itsm_ticket_number', {
          p_ticket_type: ticketType,
        });
        if (!error && data) return data as string;
      } catch (err) {
        console.warn('RPC get_next_itsm_ticket_number failed, using client sequence fallback:', err);
      }
    }

    const randNum = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${dateStr}-${randNum}`;
  }

  /**
   * Create a new ITSM ticket with initial attachments & email notification
   */
  static async createTicket(formData: TicketFormData): Promise<ITSMTicket> {
    const user = await simpleAuth.getCurrentUser();
    const ticketNumber = await this.generateTicketNumber(formData.ticket_type);

    // Calculate SLA Targets (Mon-Fri 09:00 - 18:00)
    const responseHours = ITSMSlaService.DEFAULT_SLA_HOURS[formData.priority]?.responseHours || 4;
    const resolutionHours = ITSMSlaService.DEFAULT_SLA_HOURS[formData.priority]?.resolutionHours || 24;

    const now = new Date();
    const targetResponseAt = ITSMSlaService.calculateBusinessDeadline(now, responseHours).toISOString();
    const targetResolutionAt = ITSMSlaService.calculateBusinessDeadline(now, resolutionHours).toISOString();

    const payload = {
      ticket_number: ticketNumber,
      ticket_type: formData.ticket_type,
      company_settings_id: formData.company_settings_id || null,
      customer_id: formData.customer_id,
      contact_id: formData.contact_id || null,
      contract_id: formData.contract_id || null,
      subscription_id: formData.subscription_id || null,
      product_id: formData.product_id || null,
      category_id: formData.category_id || null,
      title: formData.title.trim(),
      description: formData.description.trim(),
      priority: formData.priority,
      status: 'new' as TicketStatus,
      sla_target_response_at: targetResponseAt,
      sla_target_resolution_at: targetResolutionAt,
      is_sla_paused: false,
      created_by: user?.id || null,
    };

    let createdTicket: ITSMTicket;

    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('itsm_tickets')
        .insert([payload])
        .select(`
          *,
          customer:customers(*),
          contact:customer_contacts(*),
          contract:contracts(*),
          category:itsm_ticket_categories(*)
        `)
        .single();

      if (error) {
        console.error('Failed to create ticket in database:', error);
        throw error;
      }
      createdTicket = data as ITSMTicket;
    } else {
      createdTicket = {
        id: `tkt-${Date.now()}`,
        ...payload,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as ITSMTicket;
    }

    // Upload initial attachments if provided
    if (formData.initial_attachments && formData.initial_attachments.length > 0) {
      for (const file of formData.initial_attachments) {
        await ITSMAttachmentService.uploadAttachment(createdTicket.id, file, undefined, user?.id);
      }
    }

    // Record audit log
    await this.logAuditEntry(createdTicket.id, 'ticket_created', {
      created_by: user?.email || 'Customer Portal',
      priority: formData.priority,
      ticket_type: formData.ticket_type,
    });

    // Trigger Resend email acknowledgment
    try {
      const recipientEmail = createdTicket.contact?.email || createdTicket.customer?.email || user?.email;
      const recipientName = createdTicket.contact?.name || createdTicket.customer?.company_name || 'Customer';
      if (recipientEmail) {
        EmailService.sendTicketCreatedEmail(
          createdTicket.ticket_number,
          createdTicket.title,
          createdTicket.priority,
          recipientEmail,
          recipientName,
          true
        );
      }
    } catch (emailErr) {
      console.warn('Non-blocking ticket creation email error:', emailErr);
    }

    return createdTicket;
  }

  /**
   * Fetch tickets matching multi-parameter triage filters
   */
  static async getTickets(filters?: TicketFilters): Promise<ITSMTicket[]> {
    if (!isSupabaseConfigured) {
      return this.getMockTickets();
    }

    try {
      let query = supabase
        .from('itsm_tickets')
        .select(`
          *,
          customer:customers(*),
          contact:customer_contacts(*),
          contract:contracts(*),
          subscription:customer_subscriptions(*),
          category:itsm_ticket_categories(*),
          company_settings:company_settings(*),
          csat_survey:itsm_csat_surveys(*)
        `)
        .order('created_at', { ascending: false });

      if (filters) {
        if (filters.company_settings_id !== undefined && filters.company_settings_id !== 'all') {
          if (filters.company_settings_id === null) {
            query = query.is('company_settings_id', null);
          } else {
            query = query.eq('company_settings_id', filters.company_settings_id);
          }
        }

        if (filters.customer_id && filters.customer_id !== 'all') {
          query = query.eq('customer_id', filters.customer_id);
        }

        if (filters.category_id && filters.category_id !== 'all') {
          query = query.eq('category_id', filters.category_id);
        }

        if (filters.priority && filters.priority !== 'all') {
          query = query.eq('priority', filters.priority);
        }

        if (filters.ticket_type && filters.ticket_type !== 'all') {
          query = query.eq('ticket_type', filters.ticket_type);
        }

        if (filters.contract_id && filters.contract_id !== 'all') {
          query = query.eq('contract_id', filters.contract_id);
        }

        if (filters.is_escalated) {
          query = query.eq('is_escalated', true);
        }

        if (filters.status && filters.status !== 'all') {
          if (filters.status === 'open') {
            query = query.not('status', 'in', '("closed","canceled")');
          } else {
            query = query.eq('status', filters.status);
          }
        }

        if (filters.assigned_agent_id && filters.assigned_agent_id !== 'all') {
          if (filters.assigned_agent_id === 'unassigned') {
            query = query.is('assigned_agent_id', null);
          } else if (filters.assigned_agent_id === 'my_assigned') {
            const user = await simpleAuth.getCurrentUser();
            if (user?.id) query = query.eq('assigned_agent_id', user.id);
          } else {
            query = query.eq('assigned_agent_id', filters.assigned_agent_id);
          }
        }

        if (filters.searchQuery && filters.searchQuery.trim()) {
          const q = `%${filters.searchQuery.trim()}%`;
          query = query.or(`ticket_number.ilike.${q},title.ilike.${q},description.ilike.${q}`);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ITSMTicket[];
    } catch (err) {
      console.error('ITSMTicketService.getTickets error:', err);
      return this.getMockTickets();
    }
  }

  /**
   * Fetch single ticket with complete workspace details (comments, attachments, timeline)
   */
  static async getTicketById(ticketId: string): Promise<ITSMTicket | null> {
    if (!isSupabaseConfigured) {
      const mock = this.getMockTickets().find((t) => t.id === ticketId);
      return mock || null;
    }

    try {
      const { data: ticket, error } = await supabase
        .from('itsm_tickets')
        .select(`
          *,
          customer:customers(*),
          contact:customer_contacts(*),
          contract:contracts(*),
          subscription:customer_subscriptions(*),
          category:itsm_ticket_categories(*),
          company_settings:company_settings(*),
          csat_survey:itsm_csat_surveys(*)
        `)
        .eq('id', ticketId)
        .single();

      if (error || !ticket) return null;

      // Parallel fetch comments, attachments, audit logs
      const [commentsRes, attachmentsRes, auditLogsRes] = await Promise.all([
        supabase.from('itsm_comments').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true }),
        ITSMAttachmentService.getAttachmentsForTicket(ticketId),
        supabase.from('itsm_audit_logs').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: false }),
      ]);

      return {
        ...ticket,
        comments: (commentsRes.data || []) as ITSMComment[],
        attachments: attachmentsRes,
        audit_logs: (auditLogsRes.data || []) as ITSMAuditLog[],
      } as ITSMTicket;
    } catch (err) {
      console.error('ITSMTicketService.getTicketById error:', err);
      return null;
    }
  }

  /**
   * Validated Lifecycle State Machine Transitions
   */
  static async transitionTicketStatus(
    ticketId: string,
    targetStatus: TicketStatus,
    reasonOrNotes?: string,
    assignedAgentId?: string,
    linkedPolicyId?: string
  ): Promise<ITSMTicket> {
    const existing = await this.getTicketById(ticketId);
    if (!existing) throw new Error('Ticket not found');

    const user = await simpleAuth.getCurrentUser();
    const updatePayload: Partial<ITSMTicket> = {
      status: targetStatus,
      updated_at: new Date().toISOString(),
    };

    // State Transition Guard Checks & SLA stopwatch actions
    if (targetStatus === 'assigned') {
      if (assignedAgentId) updatePayload.assigned_agent_id = assignedAgentId;
    } else if (targetStatus === 'in_progress') {
      // First agent response stops TTO clock
      if (!existing.first_responded_at) {
        updatePayload.first_responded_at = new Date().toISOString();
      }
      updatePayload.is_sla_paused = false; // Resume TTR if coming back from pending_customer
    } else if (targetStatus === 'pending_customer') {
      // Pause TTR stopwatch
      updatePayload.is_sla_paused = true;
    } else if (targetStatus === 'resolved') {
      if (!reasonOrNotes || reasonOrNotes.trim().length < 10) {
        throw new Error('Resolution notes (min 10 characters) are mandatory when resolving a ticket.');
      }
      updatePayload.resolution_notes = reasonOrNotes.trim();
      updatePayload.resolved_at = new Date().toISOString();
      updatePayload.is_sla_paused = false;
      if (linkedPolicyId) updatePayload.linked_kb_policy_id = linkedPolicyId;
    } else if (targetStatus === 'closed') {
      updatePayload.closed_at = new Date().toISOString();
    } else if (targetStatus === 'canceled') {
      if (!reasonOrNotes) throw new Error('Cancellation reason is required.');
      updatePayload.cancellation_reason = reasonOrNotes.trim();
      updatePayload.canceled_at = new Date().toISOString();
    }

    // Customer rejection reopens ticket
    if (existing.status === 'resolved' && targetStatus === 'in_progress') {
      updatePayload.reopen_count = (existing.reopen_count || 0) + 1;
    }

    let updated: ITSMTicket;
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('itsm_tickets')
        .update(updatePayload)
        .eq('id', ticketId)
        .select(`*, customer:customers(*), contact:customer_contacts(*)`)
        .single();

      if (error) throw error;
      updated = data as ITSMTicket;
    } else {
      updated = { ...existing, ...updatePayload };
    }

    // Audit log
    await this.logAuditEntry(ticketId, `status_changed_to_${targetStatus}`, {
      old_status: existing.status,
      new_status: targetStatus,
      actor: user?.email || 'System User',
      notes: reasonOrNotes,
    });

    // Send Resend emails for updates/resolutions
    try {
      const recipientEmail = updated.contact?.email || updated.customer?.email;
      const recipientName = updated.contact?.name || updated.customer?.company_name || 'Customer';

      if (recipientEmail) {
        if (targetStatus === 'resolved') {
          EmailService.sendTicketResolvedEmail(
            updated.ticket_number,
            updated.title,
            recipientEmail,
            recipientName,
            reasonOrNotes || 'Issue has been resolved by our support engineers.'
          );
        } else {
          EmailService.sendTicketStatusUpdateEmail(
            updated.ticket_number,
            updated.title,
            targetStatus,
            recipientEmail,
            recipientName
          );
        }
      }
    } catch (emailErr) {
      console.warn('Non-blocking status update email error:', emailErr);
    }

    return updated;
  }

  /**
   * Post public comment or private agent note (is_internal = true)
   */
  static async addComment(
    ticketId: string,
    content: string,
    isInternal: boolean = false,
    mentions: string[] = [],
    attachmentFiles: File[] = []
  ): Promise<ITSMComment> {
    const user = await simpleAuth.getCurrentUser();
    if (!user) throw new Error('User authentication required to comment.');

    const commentPayload = {
      ticket_id: ticketId,
      author_id: user.id,
      is_internal: isInternal,
      content: content.trim(),
      mentions: mentions,
    };

    let comment: ITSMComment;
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('itsm_comments')
        .insert([commentPayload])
        .select()
        .single();

      if (error) throw error;
      comment = {
        ...data,
        author_name: user.username || user.email,
        author_email: user.email,
      } as ITSMComment;
    } else {
      comment = {
        id: `cmt-${Date.now()}`,
        ...commentPayload,
        author_name: user.username || user.email,
        author_email: user.email,
        created_at: new Date().toISOString(),
      } as ITSMComment;
    }

    // Upload comment attachments
    if (attachmentFiles.length > 0) {
      for (const file of attachmentFiles) {
        await ITSMAttachmentService.uploadAttachment(ticketId, file, comment.id, user.id);
      }
    }

    // If public comment by agent to customer, auto-transition if needed & send email
    const ticket = await this.getTicketById(ticketId);
    if (ticket && !isInternal) {
      // If ticket is in_progress, update customer
      try {
        const recipientEmail = ticket.contact?.email || ticket.customer?.email;
        const recipientName = ticket.contact?.name || ticket.customer?.company_name || 'Customer';
        if (recipientEmail) {
          EmailService.sendTicketStatusUpdateEmail(
            ticket.ticket_number,
            ticket.title,
            ticket.status,
            recipientEmail,
            recipientName,
            content
          );
        }
      } catch (err) {
        console.warn('Non-blocking comment email error:', err);
      }
    }

    return comment;
  }

  /**
   * Bulk Operations Toolbar Actions
   */
  static async executeBulkAction(bulkData: BulkActionData): Promise<number> {
    let successCount = 0;
    for (const ticketId of bulkData.ticket_ids) {
      try {
        if (bulkData.action === 'assign_agent' && bulkData.assigned_agent_id) {
          await this.transitionTicketStatus(ticketId, 'assigned', 'Bulk Agent Assignment', bulkData.assigned_agent_id);
        } else if (bulkData.action === 'override_priority' && bulkData.priority) {
          if (isSupabaseConfigured) {
            await supabase.from('itsm_tickets').update({ priority: bulkData.priority }).eq('id', ticketId);
          }
          await this.logAuditEntry(ticketId, 'bulk_priority_override', { new_priority: bulkData.priority });
        } else if (bulkData.action === 'reassign_category' && bulkData.category_id) {
          if (isSupabaseConfigured) {
            await supabase.from('itsm_tickets').update({ category_id: bulkData.category_id }).eq('id', ticketId);
          }
          await this.logAuditEntry(ticketId, 'bulk_category_reassigned', { category_id: bulkData.category_id });
        } else if (bulkData.action === 'transition_status' && bulkData.status) {
          await this.transitionTicketStatus(ticketId, bulkData.status, bulkData.reason || 'Bulk Status Update');
        }
        successCount++;
      } catch (err) {
        console.error(`Bulk action failed for ticket ${ticketId}:`, err);
      }
    }
    return successCount;
  }

  /**
   * Fetch Triage Desk Executive KPI summary metrics
   */
  static async getTriageMetrics(companySettingsId?: string | null): Promise<TriageDeskMetrics> {
    const tickets = await this.getTickets({ company_settings_id: companySettingsId, status: 'all' });
    const now = new Date();

    const openTickets = tickets.filter((t) => !['closed', 'canceled'].includes(t.status));
    const unassigned = openTickets.filter((t) => t.status === 'new' || !t.assigned_agent_id);

    let breachedCount = 0;
    let warningCount = 0;

    openTickets.forEach((t) => {
      const status = ITSMSlaService.getSlaStopwatchStatus(t, now);
      if (status.ttoBadgeColor === 'red' || status.ttrBadgeColor === 'red') breachedCount++;
      if (status.ttoBadgeColor === 'yellow' || status.ttrBadgeColor === 'yellow') warningCount++;
    });

    const csatData = await ITSMCsatService.getAverageCsat(companySettingsId);

    return {
      total_open: openTickets.length,
      unassigned_count: unassigned.length,
      sla_breached_count: breachedCount,
      sla_warning_count: warningCount,
      avg_csat: csatData.avgRating,
      csat_total_surveys: csatData.count,
    };
  }

  /**
   * Fetch available ITSM Categories
   */
  static async getCategories(companySettingsId?: string | null): Promise<ITSMTicketCategory[]> {
    if (!isSupabaseConfigured) return this.getMockCategories();

    try {
      let query = supabase.from('itsm_ticket_categories').select('*').eq('is_active', true);
      if (companySettingsId) query = query.or(`company_settings_id.eq.${companySettingsId},company_settings_id.is.null`);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ITSMTicketCategory[];
    } catch (err) {
      console.error('getCategories error:', err);
      return this.getMockCategories();
    }
  }

  /**
   * Helper to write audit trail entries
   */
  private static async logAuditEntry(ticketId: string, action: string, changes: Record<string, any>): Promise<void> {
    const user = await simpleAuth.getCurrentUser();
    if (!isSupabaseConfigured) return;

    try {
      await supabase.from('itsm_audit_logs').insert([
        {
          ticket_id: ticketId,
          actor_id: user?.id || null,
          action,
          changes_json: changes,
        },
      ]);
    } catch (err) {
      console.warn('Failed to insert audit log:', err);
    }
  }

  /** Mock Categories Fallback */
  private static getMockCategories(): ITSMTicketCategory[] {
    return [
      {
        id: 'cat-1',
        name: 'Technical Infrastructure & Cloud',
        code: 'INFRA',
        default_priority: 'P2_high',
        sla_response_hours_p1: 1,
        sla_resolution_hours_p1: 4,
        sla_response_hours_p2: 2,
        sla_resolution_hours_p2: 8,
        sla_response_hours_p3: 4,
        sla_resolution_hours_p3: 24,
        sla_response_hours_p4: 8,
        sla_resolution_hours_p4: 48,
        is_active: true,
      },
      {
        id: 'cat-2',
        name: 'Software Application & CRM Bug',
        code: 'SOFTWARE',
        default_priority: 'P3_medium',
        sla_response_hours_p1: 1,
        sla_resolution_hours_p1: 4,
        sla_response_hours_p2: 2,
        sla_resolution_hours_p2: 8,
        sla_response_hours_p3: 4,
        sla_resolution_hours_p3: 24,
        sla_response_hours_p4: 8,
        sla_resolution_hours_p4: 48,
        is_active: true,
      },
      {
        id: 'cat-3',
        name: 'Billing, Invoices & Payments',
        code: 'BILLING',
        default_priority: 'P3_medium',
        sla_response_hours_p1: 1,
        sla_resolution_hours_p1: 4,
        sla_response_hours_p2: 2,
        sla_resolution_hours_p2: 8,
        sla_response_hours_p3: 4,
        sla_resolution_hours_p3: 24,
        sla_response_hours_p4: 8,
        sla_resolution_hours_p4: 48,
        is_active: true,
      },
    ];
  }

  /** Mock Tickets Fallback */
  private static getMockTickets(): ITSMTicket[] {
    const now = new Date();
    return [
      {
        id: 'mock-1',
        ticket_number: 'INC-20260903-0001',
        ticket_type: 'incident',
        title: 'Production Server Latency Spikes in EU West Region',
        description: 'Multiple users reporting intermittent HTTP 504 errors on European API endpoints.',
        priority: 'P1_critical',
        status: 'in_progress',
        customer_id: 'cust-1',
        created_at: new Date(now.getTime() - 2 * 3600 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
        sla_target_response_at: new Date(now.getTime() + 1 * 3600 * 1000).toISOString(),
        sla_target_resolution_at: new Date(now.getTime() + 3 * 3600 * 1000).toISOString(),
        first_responded_at: new Date(now.getTime() - 1 * 3600 * 1000).toISOString(),
        customer: {
          id: 'cust-1',
          company_name: 'Acme Tech Europe Ltd',
          customer_code: 'IRL-2026-0042',
          email: 'support@acmetech.ie',
        } as any,
      },
      {
        id: 'mock-2',
        ticket_number: 'REQ-20260903-0002',
        ticket_type: 'service_request',
        title: 'Request Additional User Access to Billing Dashboard',
        description: 'Please grant Finance Manager view access to invoice reports.',
        priority: 'P3_medium',
        status: 'new',
        customer_id: 'cust-2',
        created_at: new Date(now.getTime() - 5 * 3600 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
        sla_target_response_at: new Date(now.getTime() + 2 * 3600 * 1000).toISOString(),
        sla_target_resolution_at: new Date(now.getTime() + 20 * 3600 * 1000).toISOString(),
        customer: {
          id: 'cust-2',
          company_name: 'Bharat Enterprises Pvt Ltd',
          customer_code: 'IND-2026-0001',
          email: 'contact@bharatent.in',
        } as any,
      },
    ];
  }
}

export default ITSMTicketService;
