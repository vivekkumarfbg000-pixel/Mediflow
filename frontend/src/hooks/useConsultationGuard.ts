import { useState, useEffect, useCallback, useRef } from 'react';

// =============================================================================
// useConsultationGuard — Active Patient Loop State Safety Hook
// Tracks whether a consultation is in progress and:
//   1. Emits a warning when the doctor navigates away mid-consultation
//   2. Snapshots state to sessionStorage on every meaningful change
//   3. Provides a restore function for crash/refresh recovery
// =============================================================================

const STORAGE_KEY = 'mediflow_consultation_snapshot';

export interface ConsultationSnapshot {
  patientId: string;
  patientName: string;
  notes: string;
  medicationCount: number;
  testCount: number;
  savedAt: string;
}

interface ConsultationGuardOptions {
  selectedPatientId: string | null;
  selectedPatientName: string | null;
  notes: string;
  medicationCount: number;
  testCount: number;
  activeTab: string;
  consultationTab: string; // the tab key that holds the consultation
}

interface ConsultationGuardResult {
  /** True when a consultation is in progress (patient selected + data entered) */
  isConsultationActive: boolean;
  /** True when user has switched away from the consultation tab mid-session */
  showNavigationWarning: boolean;
  /** Dismiss the warning banner manually */
  dismissWarning: () => void;
  /** Recover snapshot from sessionStorage (call on mount) */
  recoverSnapshot: () => ConsultationSnapshot | null;
  /** Clear snapshot after encounter is saved */
  clearSnapshot: () => void;
  /** Human-readable status summary for the warning banner */
  warningDetail: string;
}

export function useConsultationGuard(options: ConsultationGuardOptions): ConsultationGuardResult {
  const {
    selectedPatientId,
    selectedPatientName,
    notes,
    medicationCount,
    testCount,
    activeTab,
    consultationTab,
  } = options;

  const [showNavigationWarning, setShowNavigationWarning] = useState(false);
  const [warningDismissed, setWarningDismissed] = useState(false);
  const prevTabRef = useRef(activeTab);

  // A consultation is "active" if patient is selected AND any data has been entered
  const isConsultationActive =
    !!selectedPatientId && (medicationCount > 0 || testCount > 0 || notes.trim().length > 5);

  // ── Snapshot state to sessionStorage on every meaningful change ─────────────
  useEffect(() => {
    if (!isConsultationActive || !selectedPatientId) return;

    const snapshot: ConsultationSnapshot = {
      patientId: selectedPatientId,
      patientName: selectedPatientName ?? 'Unknown Patient',
      notes,
      medicationCount,
      testCount,
      savedAt: new Date().toISOString(),
    };

    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch (_) {
      // sessionStorage may be unavailable in some environments — fail silently
    }
  }, [isConsultationActive, selectedPatientId, selectedPatientName, notes, medicationCount, testCount]);

  // ── Detect tab navigation away from consultation ────────────────────────────
  useEffect(() => {
    const tabChanged = activeTab !== consultationTab;
    const wasOnConsultation = prevTabRef.current === consultationTab;

    if (tabChanged && wasOnConsultation && isConsultationActive && !warningDismissed) {
      setShowNavigationWarning(true);
    } else if (activeTab === consultationTab) {
      // Returned to consultation tab — reset warning state
      setShowNavigationWarning(false);
      setWarningDismissed(false);
    }

    prevTabRef.current = activeTab;
  }, [activeTab, consultationTab, isConsultationActive, warningDismissed]);

  // ── Reset warning when consultation ends (patient cleared) ──────────────────
  useEffect(() => {
    if (!selectedPatientId) {
      setShowNavigationWarning(false);
      setWarningDismissed(false);
    }
  }, [selectedPatientId]);

  const dismissWarning = useCallback(() => {
    setWarningDismissed(true);
    setShowNavigationWarning(false);
  }, []);

  const recoverSnapshot = useCallback((): ConsultationSnapshot | null => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const snap = JSON.parse(raw) as ConsultationSnapshot;
      // Only recover if snapshot is less than 4 hours old
      const age = Date.now() - new Date(snap.savedAt).getTime();
      if (age > 4 * 60 * 60 * 1000) {
        sessionStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return snap;
    } catch (_) {
      return null;
    }
  }, []);

  const clearSnapshot = useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (_) {
      // ignore clear error
    }
  }, []);

  // Build human-readable warning detail
  const parts: string[] = [];
  if (medicationCount > 0) parts.push(`${medicationCount} medication${medicationCount !== 1 ? 's' : ''}`);
  if (testCount > 0) parts.push(`${testCount} test${testCount !== 1 ? 's' : ''}`);
  if (notes.trim().length > 5) parts.push('clinical notes');
  const warningDetail = parts.length > 0 ? parts.join(', ') : 'session data';

  return {
    isConsultationActive,
    showNavigationWarning,
    dismissWarning,
    recoverSnapshot,
    clearSnapshot,
    warningDetail,
  };
}
