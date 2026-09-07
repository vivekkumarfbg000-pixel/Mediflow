// =============================================================================
// VitalSync Enterprise Single-Source-of-Truth (SSOT) Appointment Pipeline Engine
// Enforces:
// - Rule 1: Postgres CDC Field Normalization (snake_case + camelCase defensive guards)
// - Rule 3: Active Payment Clearance Gate (strictly isolates pending_payment)
// - Rule 4: Emergency SOS & VIP Priority #1 Chamber Routing
// - Rule 95: 100% reliable 24/7 IST date evaluation (UTC+5:30)
// =============================================================================

import { getIstDateString, getEffectiveAppointmentDate } from '../utils/dateUtils';
import type { Appointment } from '../types';

export interface OverviewMetrics {
  totalActiveToday: number;
  vipCount: number;
  regularCount: number;
  completedCount: number;
  upcomingAdvanceCount: number;
  pendingPaymentCount: number;
  totalPatientsToday: number;
}

export interface CategorizedAppointments {
  todayOpdQueue: Appointment[];
  upcomingAdvanceBookings: Appointment[];
  completedToday: Appointment[];
  emergencyVipPriority: Appointment[];
  pendingPaymentGate: Appointment[];
  overviewMetrics: OverviewMetrics;
}

/**
 * Checks if an appointment is a VIP or Emergency Priority Booking.
 * Covers all historical, live, and webhook flags defensively.
 */
export function isVipBooking(appt: Appointment | any): boolean {
  if (!appt) return false;
  return Boolean(
    appt.is_vip ||
    appt.isVip ||
    appt.is_emergency ||
    appt.isEmergency ||
    String(appt.source || '').toLowerCase().includes('vip') ||
    String(appt.source || '').toLowerCase().includes('sos') ||
    String(appt.source || '').toLowerCase().includes('emergency') ||
    String(appt.token_number || appt.tokenNumber || '').toUpperCase().startsWith('VIP-') ||
    String(appt.token_number || appt.tokenNumber || '').toUpperCase().includes('SOS') ||
    String(appt.token_number || appt.tokenNumber || '').toUpperCase().includes(' E') ||
    String(appt.token_number || appt.tokenNumber || '').toUpperCase().startsWith('#EM-')
  );
}

/**
 * Checks if an appointment is awaiting payment clearance (Payment Gate).
 * Rule 3: pending_payment appointments MUST remain hidden from active Doctor EMR
 * and Compounder queues until payment clears.
 */
export function isPendingPayment(appt: Appointment | any): boolean {
  if (!appt) return false;
  const status = String(appt.status || '').toLowerCase();
  const paymentStatus = String(appt.payment_status || '').toLowerCase();

  // If status is explicitly pending_payment
  if (status === 'pending_payment') {
    // If payment was already asserted or cleared, it is ready for consult / scheduled
    if (paymentStatus === 'asserted' || paymentStatus === 'cleared' || paymentStatus === 'paid') {
      return false;
    }
    return true;
  }

  return false;
}

/**
 * Extracts a numeric priority weight for token sorting.
 * e.g., 'VIP-01' -> 1, 'T-05' -> 5, '#TK-012' -> 12
 */
function extractTokenSeq(token?: string): number {
  if (!token) return 999999;
  const match = String(token).match(/\d+/);
  return match ? parseInt(match[0], 10) : 999999;
}

/**
 * Compares two appointments for OPD Queue ordering:
 * 1. VIP / Emergency Priority #1 always goes to the top.
 * 2. Within VIP: sorted by token sequence or creation time.
 * 3. Within Regular: sorted by token sequence or creation time.
 */
export function compareAppointmentsForQueue(a: Appointment, b: Appointment): number {
  const isVipA = isVipBooking(a);
  const isVipB = isVipBooking(b);

  if (isVipA && !isVipB) return -1;
  if (!isVipA && isVipB) return 1;

  // Both are VIP or both are Regular: compare token sequence
  const tokenA = (a.tokenNumber || (a as any).token_number || '');
  const tokenB = (b.tokenNumber || (b as any).token_number || '');
  const seqA = extractTokenSeq(tokenA);
  const seqB = extractTokenSeq(tokenB);

  if (seqA !== seqB) {
    return seqA - seqB;
  }

  // Fallback to creation timestamp
  const timeA = new Date(a.createdAt || (a as any).created_at || 0).getTime();
  const timeB = new Date(b.createdAt || (b as any).created_at || 0).getTime();
  return timeA - timeB;
}

/**
 * Centralized Single Source of Truth (SSOT) Pipeline Engine.
 * Transforms raw appointments into deterministic, mathematically synchronized categories.
 */
export function categorizeAppointments(
  appointments: Appointment[],
  targetDateStr?: string
): CategorizedAppointments {
  const todayStr = targetDateStr || getIstDateString();

  const todayOpdQueue: Appointment[] = [];
  const upcomingAdvanceBookings: Appointment[] = [];
  const completedToday: Appointment[] = [];
  const emergencyVipPriority: Appointment[] = [];
  const pendingPaymentGate: Appointment[] = [];

  const rawList = Array.isArray(appointments) ? appointments : [];

  for (const appt of rawList) {
    if (!appt || !appt.id) continue;

    const status = String(appt.status || '').toLowerCase();

    // 1. Filter out cancelled appointments
    if (status === 'cancelled') {
      continue;
    }

    // 2. Rule 3: Payment Gate Isolation
    if (isPendingPayment(appt)) {
      pendingPaymentGate.push(appt);
      continue;
    }

    const apptDate = getEffectiveAppointmentDate(appt);

    // 3. Completed appointments for today
    if (status === 'completed') {
      if (apptDate === todayStr) {
        completedToday.push(appt);
      }
      continue;
    }

    // 4. Future Advance Bookings (dates > todayStr)
    if (apptDate > todayStr) {
      upcomingAdvanceBookings.push(appt);
      continue;
    }

    // 5. Today's Active OPD Queue (dates === todayStr or same-day fallback)
    if (apptDate === todayStr) {
      todayOpdQueue.push(appt);
      if (isVipBooking(appt)) {
        emergencyVipPriority.push(appt);
      }
      continue;
    }

    // Past appointments (apptDate < todayStr) are preserved in database but not active today
  }

  // Sort queues deterministically
  todayOpdQueue.sort(compareAppointmentsForQueue);
  emergencyVipPriority.sort(compareAppointmentsForQueue);

  // Sort upcoming advance bookings by date ascending, then token
  upcomingAdvanceBookings.sort((a, b) => {
    const dateA = getEffectiveAppointmentDate(a);
    const dateB = getEffectiveAppointmentDate(b);
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return compareAppointmentsForQueue(a, b);
  });

  // Calculate Overview Metrics with 100% Mathematical Parity Guarantee
  const totalActiveToday = todayOpdQueue.length;
  const vipCount = emergencyVipPriority.length;
  const regularCount = Math.max(0, totalActiveToday - vipCount);
  const completedCount = completedToday.length;
  const upcomingAdvanceCount = upcomingAdvanceBookings.length;
  const pendingPaymentCount = pendingPaymentGate.length;
  const totalPatientsToday = totalActiveToday + completedCount;

  return {
    todayOpdQueue,
    upcomingAdvanceBookings,
    completedToday,
    emergencyVipPriority,
    pendingPaymentGate,
    overviewMetrics: {
      totalActiveToday,
      vipCount,
      regularCount,
      completedCount,
      upcomingAdvanceCount,
      pendingPaymentCount,
      totalPatientsToday
    }
  };
}
