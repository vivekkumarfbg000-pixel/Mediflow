import React, { useState, useEffect } from 'react';

// =============================================================================
// Mediflow — CashBillingPanel
// Used by compounders to record cash pharmacy/lab sales through the app.
// Automatically deducts 3% platform commission from the pod's commission pool.
// Transparent to the compounder — shows the ₹ amount going to platform.
// =============================================================================

interface LineItem {
  name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

interface CashBillingPanelProps {
  podId: string;
  entityId: string;
  entityType: 'pharmacy' | 'lab';
  supabaseClient: any; // pass in the supabase client
}

export const CashBillingPanel: React.FC<CashBillingPanelProps> = ({
  podId,
  entityId,
  entityType,
  supabaseClient,
}) => {
  const [items, setItems] = useState<LineItem[]>([
    { name: '', quantity: 1, unit_price: 0, line_total: 0 },
  ]);
  const [notes, setNotes] = useState('');
  const [poolBalance, setPoolBalance] = useState<number | null>(null);
  const [isPoolLow, setIsPoolLow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    commission: number;
    pool_status: string;
    session_id: string;
    pool_balance: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const COMMISSION_RATE = 0.03;

  // ── Load pool balance on mount ──────────────────────────────────────────────
  useEffect(() => {
    const fetchPoolStatus = async () => {
      try {
        const { data, error } = await supabaseClient.rpc('get_pool_status', {
          p_pod_id: podId,
        });
        if (!error && data) {
          setPoolBalance(data.pool_balance);
          setIsPoolLow(data.is_low);
        }
      } catch (_) {
        // ignore fetch error
      }
    };
    fetchPoolStatus();
  }, [podId, supabaseClient]);

  // ── Line item helpers ───────────────────────────────────────────────────────
  const updateItem = (index: number, field: keyof LineItem, value: string | number) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      if (field === 'quantity' || field === 'unit_price') {
        updated[index].line_total = updated[index].quantity * updated[index].unit_price;
      }
      return updated;
    });
  };

  const addItem = () =>
    setItems(prev => [...prev, { name: '', quantity: 1, unit_price: 0, line_total: 0 }]);

  const removeItem = (index: number) =>
    setItems(prev => prev.filter((_, i) => i !== index));

  const grossAmount = items.reduce((sum, i) => sum + i.line_total, 0);
  const commissionAmount = parseFloat((grossAmount * COMMISSION_RATE).toFixed(2));
  const isValid = items.every(i => i.name.trim() && i.quantity > 0 && i.unit_price > 0);

  // ── Submit cash bill ────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!isValid || grossAmount <= 0) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const token = sessionData?.session?.access_token;

      const response = await fetch(
        `${(supabaseClient as any).supabaseUrl}/functions/v1/cashfree-cash-bill`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            podId,
            entityId,
            saleType: entityType,
            grossAmount,
            items,
            notes: notes || undefined,
          }),
        }
      );

      const json = await response.json();

      if (!response.ok) {
        setError(json.error ?? 'Billing failed. Please try again.');
      } else {
        setResult({
          success: true,
          commission: json.commission_amount,
          pool_status: json.pool_status,
          session_id: json.session_id,
          pool_balance: json.pool_balance,
        });
        setPoolBalance(json.pool_balance);
        setIsPoolLow(json.is_pool_low);
        // Reset form
        setItems([{ name: '', quantity: 1, unit_price: 0, line_total: 0 }]);
        setNotes('');
      }
    } catch (e: any) {
      setError(e.message ?? 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-emerald-600">
              {entityType === 'pharmacy' ? 'medication' : 'biotech'}
            </span>
            Cash {entityType === 'pharmacy' ? 'Pharmacy' : 'Lab'} Billing
          </h2>
          <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">
            Bill a cash sale through Mediflow — 3% platform fee is auto-handled
          </p>
        </div>

        {/* Pool balance badge */}
        <div
          className={`text-right px-3 py-1.5 rounded-xl border text-xs font-bold ${
            isPoolLow
              ? 'border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
          }`}
        >
          <div className="text-[9px] uppercase tracking-widest font-mono opacity-70">Commission Pool</div>
          <div>
            {poolBalance !== null ? `₹${poolBalance.toLocaleString()}` : '—'}
          </div>
          {isPoolLow && (
            <div className="text-[9px] font-normal opacity-80">⚠ Low — commissions deferred</div>
          )}
        </div>
      </div>

      {/* Low pool notice */}
      {isPoolLow && (
        <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl px-4 py-3">
          <span className="material-symbols-outlined text-amber-600 text-base mt-0.5">warning</span>
          <p className="text-[11px] text-amber-700 dark:text-amber-300">
            Pool balance is below ₹200. Cash commissions will be deferred and collected from your next online payment settlements.
          </p>
        </div>
      )}

      {/* Line items */}
      <div className="space-y-2">
        <div className="grid grid-cols-12 gap-2 text-[9px] text-slate-400 uppercase tracking-widest font-bold px-1">
          <span className="col-span-5">Item Name</span>
          <span className="col-span-2 text-right">Qty</span>
          <span className="col-span-2 text-right">Unit ₹</span>
          <span className="col-span-2 text-right">Total</span>
          <span className="col-span-1" />
        </div>

        {items.map((item, idx) => (
          <div key={idx} className="grid grid-cols-12 gap-2 items-center">
            <input
              type="text"
              placeholder={entityType === 'pharmacy' ? 'Medicine name' : 'Test name'}
              value={item.name}
              onChange={e => updateItem(idx, 'name', e.target.value)}
              className="col-span-5 input-field py-1.5 text-xs"
            />
            <input
              type="number"
              min={1}
              value={item.quantity}
              onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
              className="col-span-2 input-field py-1.5 text-xs text-right"
            />
            <input
              type="number"
              min={0}
              step={0.5}
              placeholder="0.00"
              value={item.unit_price || ''}
              onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)}
              className="col-span-2 input-field py-1.5 text-xs text-right"
            />
            <div className="col-span-2 text-right text-xs font-bold text-slate-700 dark:text-slate-200 font-mono">
              ₹{item.line_total.toFixed(2)}
            </div>
            <button
              onClick={() => removeItem(idx)}
              disabled={items.length === 1}
              className="col-span-1 flex justify-center text-slate-400 hover:text-red-500 disabled:opacity-30 transition-colors"
            >
              <span className="material-symbols-outlined text-base">remove_circle</span>
            </button>
          </div>
        ))}

        <button
          onClick={addItem}
          className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 font-semibold transition-colors mt-1"
        >
          <span className="material-symbols-outlined text-base">add_circle</span>
          Add item
        </button>
      </div>

      {/* Notes */}
      <input
        type="text"
        placeholder="Notes (optional — e.g. patient name)"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        className="w-full input-field py-1.5 text-xs"
        maxLength={500}
      />

      {/* Summary */}
      {grossAmount > 0 && (
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl px-4 py-3 space-y-1.5 text-xs">
          <div className="flex justify-between text-slate-600 dark:text-slate-300">
            <span>Subtotal ({items.length} item{items.length !== 1 ? 's' : ''})</span>
            <span className="font-mono">₹{grossAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-indigo-600 dark:text-indigo-400">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[12px]">percent</span>
              Platform fee (3%)
            </span>
            <span className="font-mono font-bold">₹{commissionAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-500 dark:text-slate-400 text-[10px] border-t border-slate-200 dark:border-slate-700 pt-1.5">
            <span>Deducted from commission pool — patient pays ₹{grossAmount.toFixed(2)} in cash</span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/40 rounded-xl px-4 py-3">
          <span className="material-symbols-outlined text-red-500 text-base mt-0.5">error</span>
          <p className="text-[11px] text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Success receipt */}
      {result && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/40 rounded-xl px-4 py-3 space-y-1">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold text-sm">
            <span className="material-symbols-outlined text-base">check_circle</span>
            Cash bill recorded successfully
          </div>
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
            Session: {result.session_id.substring(0, 8).toUpperCase()}
          </p>
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
            ₹{result.commission.toFixed(2)} commission {result.pool_status === 'deferred' ? 'deferred (pool low)' : 'deducted from pool'} •
            Pool balance: ₹{result.pool_balance.toLocaleString()}
          </p>
        </div>
      )}

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={loading || !isValid || grossAmount <= 0}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors"
      >
        {loading ? (
          <>
            <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
            Recording...
          </>
        ) : (
          <>
            <span className="material-symbols-outlined text-base">receipt_long</span>
            Record ₹{grossAmount.toFixed(2)} Cash Sale
          </>
        )}
      </button>
    </div>
  );
};
