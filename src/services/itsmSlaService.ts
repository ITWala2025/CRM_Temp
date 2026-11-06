import { ITSMTicket, TicketPriority, SlaStopwatchStatus } from '../types/itsm';

/**
 * Service for calculating Mon-Fri 09:00 - 18:00 Business Hours SLAs,
 * calculating target deadlines, and evaluating stopwatch badge states.
 */
export class ITSMSlaService {
  /** Default business hours per priority (Response / Resolution in Hours) */
  static readonly DEFAULT_SLA_HOURS: Record<TicketPriority, { responseHours: number; resolutionHours: number }> = {
    P1_critical: { responseHours: 1, resolutionHours: 4 },
    P2_high: { responseHours: 2, resolutionHours: 8 },
    P3_medium: { responseHours: 4, resolutionHours: 24 },
    P4_low: { responseHours: 8, resolutionHours: 48 },
  };

  /**
   * Calculates a target deadline given a start date and target business hours (Mon-Fri 09:00 - 18:00).
   */
  static calculateBusinessDeadline(startTime: Date | string, businessHours: number): Date {
    let curr = new Date(startTime);
    let remainingMinutes = Math.round(businessHours * 60);

    while (remainingMinutes > 0) {
      const day = curr.getDay(); // 0 = Sun, 6 = Sat

      // Skip weekend
      if (day === 0 || day === 6) {
        curr.setDate(curr.getDate() + 1);
        curr.setHours(9, 0, 0, 0);
        continue;
      }

      const workStart = new Date(curr);
      workStart.setHours(9, 0, 0, 0);

      const workEnd = new Date(curr);
      workEnd.setHours(18, 0, 0, 0);

      if (curr < workStart) {
        curr = workStart;
      } else if (curr >= workEnd) {
        curr.setDate(curr.getDate() + 1);
        curr.setHours(9, 0, 0, 0);
        continue;
      }

      const availableTodayMinutes = (workEnd.getTime() - curr.getTime()) / (1000 * 60);

      if (remainingMinutes <= availableTodayMinutes) {
        curr = new Date(curr.getTime() + remainingMinutes * 60 * 1000);
        remainingMinutes = 0;
      } else {
        remainingMinutes -= availableTodayMinutes;
        curr.setDate(curr.getDate() + 1);
        curr.setHours(9, 0, 0, 0);
      }
    }

    return curr;
  }

  /**
   * Calculates remaining business minutes between two dates (Mon-Fri 09:00 - 18:00).
   */
  static getRemainingBusinessMinutes(targetTime: Date | string, nowTime: Date = new Date()): number {
    const target = new Date(targetTime);
    if (isNaN(target.getTime())) return 0;

    const diffMs = target.getTime() - nowTime.getTime();
    if (diffMs <= 0) return 0;

    // Convert raw difference to business minutes approximation
    let minutes = 0;
    let curr = new Date(nowTime);

    while (curr < target) {
      const day = curr.getDay();
      if (day !== 0 && day !== 6) {
        const hour = curr.getHours();
        if (hour >= 9 && hour < 18) {
          minutes++;
        }
      }
      curr = new Date(curr.getTime() + 60 * 1000);
    }

    return minutes;
  }

  /**
   * Computes the live SLA Stopwatch status and badge styles for a ticket.
   */
  static getSlaStopwatchStatus(ticket: ITSMTicket, now: Date = new Date()): SlaStopwatchStatus {
    const isPaused = ticket.is_sla_paused || ticket.status === 'pending_customer';

    // 1. TTO (Time To Own / Initial Response)
    let ttoBadgeColor: SlaStopwatchStatus['ttoBadgeColor'] = 'green';
    let ttoLabel = 'TTO: OK';
    let ttoRemainingMinutes = 0;

    if (ticket.first_responded_at) {
      ttoBadgeColor = 'completed';
      ttoLabel = 'TTO Met';
    } else if (isPaused) {
      ttoBadgeColor = 'paused';
      ttoLabel = 'TTO Paused';
    } else if (ticket.sla_target_response_at) {
      const target = new Date(ticket.sla_target_response_at);
      if (now >= target) {
        ttoBadgeColor = 'red';
        ttoLabel = 'TTO BREACHED';
      } else {
        const defaultHours = ITSMSlaService.DEFAULT_SLA_HOURS[ticket.priority]?.responseHours || 4;
        const totalMinutes = defaultHours * 60;
        const rem = ITSMSlaService.getRemainingBusinessMinutes(target, now);
        ttoRemainingMinutes = rem;

        if (rem <= 0) {
          ttoBadgeColor = 'red';
          ttoLabel = 'TTO Breached';
        } else if (rem / totalMinutes <= 0.25) {
          ttoBadgeColor = 'yellow';
          ttoLabel = `TTO: ${rem}m remaining`;
        } else {
          ttoBadgeColor = 'green';
          ttoLabel = `TTO: ${Math.round(rem / 60)}h remaining`;
        }
      }
    }

    // 2. TTR (Time To Resolve)
    let ttrBadgeColor: SlaStopwatchStatus['ttrBadgeColor'] = 'green';
    let ttrLabel = 'TTR: OK';
    let ttrRemainingMinutes = 0;

    if (ticket.resolved_at || ticket.closed_at) {
      ttrBadgeColor = 'completed';
      ttrLabel = 'TTR Met';
    } else if (isPaused) {
      ttrBadgeColor = 'paused';
      ttrLabel = 'TTR Paused';
    } else if (ticket.sla_target_resolution_at) {
      const target = new Date(ticket.sla_target_resolution_at);
      if (now >= target) {
        ttrBadgeColor = 'red';
        ttrLabel = 'TTR BREACHED';
      } else {
        const defaultHours = ITSMSlaService.DEFAULT_SLA_HOURS[ticket.priority]?.resolutionHours || 24;
        const totalMinutes = defaultHours * 60;
        const rem = ITSMSlaService.getRemainingBusinessMinutes(target, now);
        ttrRemainingMinutes = rem;

        if (rem <= 0) {
          ttrBadgeColor = 'red';
          ttrLabel = 'TTR Breached';
        } else if (rem / totalMinutes <= 0.25) {
          ttrBadgeColor = 'yellow';
          ttrLabel = `TTR: ${rem}m remaining`;
        } else {
          ttrBadgeColor = 'green';
          ttrLabel = `TTR: ${Math.round(rem / 60)}h remaining`;
        }
      }
    }

    return {
      ttoRemainingMinutes,
      ttrRemainingMinutes,
      ttoBadgeColor,
      ttrBadgeColor,
      ttoLabel,
      ttrLabel,
      isPaused,
    };
  }
}

export default ITSMSlaService;
