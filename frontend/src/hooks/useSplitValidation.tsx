import { useMemo } from 'react';

// =============================================================================
// useSplitValidation — UPI Split Payout Interruption Guard
// Validates Cashfree order_splits before payment is triggered.
// Blocks payment if:
//   - Any vendor_id is null/empty/undefined
//   - Any split amount is 0 on a non-zero gross bill
//   - Sum of split amounts exceeds gross amount (over-allocation)
//   - No splits exist but gross amount > 0 (unsplit order — soft warning only)
// =============================================================================

export interface SplitNode {
  vendor_id: string | null | undefined;
  amount: number | null | undefined;
  /** Optional human-readable label for error messages */
  label?: string;
}

export type ValidationSeverity = 'error' | 'warning' | 'ok';

export interface SplitValidationResult {
  /** True only when payment can safely proceed */
  isValid: boolean;
  /** Severity of the most critical issue found */
  severity: ValidationSeverity;
  /** List of invalid/missing nodes with human-readable reasons */
  invalidNodes: Array<{ label: string; reason: string }>;
  /** Single-line block reason for the payment button */
  blockReason: string | null;
  /** True when there are no splits at all (unsplit order — warning only) */
  isUnsplit: boolean;
  /** True when sum of splits exceeds gross amount */
  isOverAllocated: boolean;
}

const NODE_LABELS: Record<string, string> = {
  clinic: 'CLINIC_WALLET',
  doctor: 'DOCTOR_WALLET',
  pharmacy: 'PHARMACY_PARTNER_WALLET',
  lab: 'LAB_PARTNER_WALLET',
};

function resolveLabel(node: SplitNode, index: number): string {
  return node.label ?? NODE_LABELS[`node_${index}`] ?? `VENDOR_${index + 1}`;
}

export function useSplitValidation(
  splits: SplitNode[] | null | undefined,
  grossAmount: number
): SplitValidationResult {
  return useMemo<SplitValidationResult>(() => {
    const invalidNodes: Array<{ label: string; reason: string }> = [];

    // No splits at all — soft warning (unsplit order, platform gets everything)
    if (!splits || splits.length === 0) {
      return {
        isValid: true, // non-blocking — unsplit orders are allowed
        severity: 'warning',
        invalidNodes: [],
        blockReason: null,
        isUnsplit: true,
        isOverAllocated: false,
      };
    }

    let splitTotal = 0;

    for (let i = 0; i < splits.length; i++) {
      const node = splits[i];
      const label = resolveLabel(node, i);

      // Check: missing vendor routing address
      if (!node.vendor_id || node.vendor_id.trim() === '') {
        invalidNodes.push({
          label,
          reason: `${label} routing address unresolved — vendor not onboarded on Cashfree`,
        });
      }

      // Check: zero amount on non-zero bill
      const amount = node.amount ?? 0;
      if (grossAmount > 0 && amount <= 0) {
        invalidNodes.push({
          label,
          reason: `${label} split amount is ₹0 on a ₹${grossAmount.toFixed(2)} bill`,
        });
      }

      splitTotal += amount;
    }

    // Check: over-allocation (splits exceed gross)
    const isOverAllocated = splitTotal > grossAmount + 0.01; // 1 paisa tolerance
    if (isOverAllocated) {
      invalidNodes.push({
        label: 'SPLIT_TOTAL',
        reason: `Split total ₹${splitTotal.toFixed(2)} exceeds gross amount ₹${grossAmount.toFixed(2)}`,
      });
    }

    const isValid = invalidNodes.length === 0;
    const severity: ValidationSeverity = isValid ? 'ok' : 'error';

    // Build concise block reason for the payment button tooltip/message
    let blockReason: string | null = null;
    if (!isValid) {
      if (invalidNodes.length === 1) {
        blockReason = `⚠ ${invalidNodes[0].reason}`;
      } else {
        blockReason = `⚠ ${invalidNodes.length} split routing issues — resolve before payment`;
      }
    }

    return {
      isValid,
      severity,
      invalidNodes,
      blockReason,
      isUnsplit: false,
      isOverAllocated,
    };
  }, [splits, grossAmount]);
}

// ─── Companion UI: SplitValidationGate ───────────────────────────────────────
// Wraps any payment trigger button and shows the block reason inline.
// Import and use as: <SplitValidationGate validation={...}><button/></SplitValidationGate>

import React from 'react';

interface SplitValidationGateProps {
  validation: SplitValidationResult;
  children: React.ReactNode;
  /** If false, renders children without gate even if validation fails (useful for preview) */
  enforced?: boolean;
}

export const SplitValidationGate: React.FC<SplitValidationGateProps> = ({
  validation,
  children,
  enforced = true,
}) => {
  const showBlock = enforced && !validation.isValid;
  const showWarn = validation.isUnsplit;

  return (
    <div className="space-y-2">
      {/* Invalid node detail list */}
      {showBlock && validation.invalidNodes.length > 0 && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-950/30 px-3 py-2.5 space-y-1">
          <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400 text-[10px] font-black uppercase tracking-wider">
            <span className="material-symbols-outlined text-sm">block</span>
            Payment Blocked — Split Routing Errors
          </div>
          {validation.invalidNodes.map((node, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[10px] text-rose-600 dark:text-rose-400 font-mono">
              <span className="material-symbols-outlined text-[11px] mt-0.5 shrink-0">cancel</span>
              {node.reason}
            </div>
          ))}
        </div>
      )}

      {/* Unsplit order soft warning */}
      {showWarn && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 flex items-start gap-1.5">
          <span className="material-symbols-outlined text-amber-500 text-sm mt-0.5 shrink-0">info</span>
          <p className="text-[10px] text-amber-700 dark:text-amber-400">
            No vendor splits configured — full amount will settle to the platform master account. Onboard vendors via Settlement Settings to enable auto-splits.
          </p>
        </div>
      )}

      {/* Children (payment button) — disabled if blocked */}
      <div className={showBlock ? 'pointer-events-none opacity-50 select-none' : ''}>
        {children}
      </div>
    </div>
  );
};

SplitValidationGate.displayName = 'SplitValidationGate';
