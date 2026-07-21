import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { SystemHealthCockpit } from './SystemHealthCockpit';
import { api } from '../../services/api';
import { 
  ShieldAlert, 
  Lock, 
  Mail, 
  ArrowRight, 
  Activity, 
  Loader2,
  Terminal,
  Building,
  Coins,
  MessageSquare,
  Users,
  CheckCircle,
  AlertCircle,
  Database,
  RefreshCw,
  TrendingUp,
  CreditCard,
  Layers,
  Cpu,
  Globe,
  Sliders,
  Play,
  Trash2,
  LockKeyhole,
  LogOut
} from 'lucide-react';

interface OnboardingStats {
  total_pods: number;
  total_entities: number;
  clinics: number;
  pharmacies: number;
  labs: number;
  total_profiles: number;
}

interface RevenueStats {
  total_gmv: number;
  platform_commission: number;
  paid_invoices: number;
  unpaid_invoices: number;
}

interface CostStats {
  waba_msgs_sent: number;
  waba_cost: number;
  ai_tasks_run: number;
  ai_cost: number;
}

interface PodInfo {
  id: string;
  name: string;
  location: string;
  clinic_code: string;
  is_active: boolean;
  created_at: string;
  daily_cost_budget: number;
  daily_spend: number;
  platform_fee_percent?: number;
  lifetime_platform_revenue?: number;
  pending_cash_balance?: number;
  is_verified_for_billing?: boolean;
}

interface RlsComplianceAudit {
  table_name: string;
  rls_enabled: boolean;
  policy_count: number;
  has_pod_isolation: boolean;
  status: 'secure' | 'vulnerable';
}

interface FailedSettlement {
  id: string;
  invoice_id: string | null;
  source_entity_name: string;
  destination_entity_name: string;
  transaction_type: string;
  gross_amount: number;
  commission_rate: number;
  net_payout: number;
  payment_status: string;
  created_at: string;
}

interface BlacklistedIp {
  ip: string;
  reason: string;
  created_at: string;
}

interface RateLimitRow {
  ip: string;
  request_count: number;
  window_start: string;
}

type ActiveTab = 'saas_health' | 'onboarding' | 'revenue' | 'costs' | 'firewall';

export const SaaSAdminPanel: React.FC = () => {
  // SECURITY: Never initialise from localStorage — it is client-writable.
  // The localStorage flag is kept only as a UI loading hint (e.g., hide spinner),
  // but the actual security gate is the async checkRole() below.
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [_localAdminHint] = useState<boolean>(() => {
    // purely cosmetic: used to avoid a flash-of-login-form when we know the user
    // was recently verified as admin. Does NOT gate any data access.
    return typeof window !== 'undefined' && localStorage.getItem('vitalsync_admin_logged_in') === 'true';
  });
  const [loadingProfile, setLoadingProfile] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('saas_health');
  
  // Credentials & Login gate state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // SaaS Operations Metrics
  const [onboardingStats, setOnboardingStats] = useState<OnboardingStats | null>(null);
  const [revenueStats, setRevenueStats] = useState<RevenueStats | null>(null);
  const [costStats, setCostStats] = useState<CostStats | null>(null);
  const [podsList, setPodsList] = useState<PodInfo[]>([]);
  const [metricsLoading, setMetricsLoading] = useState<boolean>(false);

  // Security Sentry: RLS compliance
  const [complianceList, setComplianceList] = useState<RlsComplianceAudit[]>([]);
  const [auditingRls, setAuditingRls] = useState<boolean>(false);

  // CFO: Failed split payout ledger
  const [failedSettlements, setFailedSettlements] = useState<FailedSettlement[]>([]);
  const [loadingSettlements, setLoadingSettlements] = useState<boolean>(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  // Cost Controller: Budget controls
  const [updatingBudgetPodId, setUpdatingBudgetPodId] = useState<string | null>(null);
  const [budgetInputs, setBudgetInputs] = useState<Record<string, string>>({});

  // DevSecOps: Firewall Console
  const [blacklistedIps, setBlacklistedIps] = useState<BlacklistedIp[]>([]);
  const [rateLimits, setRateLimits] = useState<RateLimitRow[]>([]);
  const [loadingFirewall, setLoadingFirewall] = useState<boolean>(false);
  const [newIp, setNewIp] = useState<string>('');
  const [newReason, setNewReason] = useState<string>('');
  const [addingIp, setAddingIp] = useState<boolean>(false);
  const [removingIp, setRemovingIp] = useState<string | null>(null);

  // Synthetic Profile Manager state
  const [syntheticProfiles, setSyntheticProfiles] = useState<any[]>([]);
  const [genCount, setGenCount] = useState<number>(10);

  // Sync synthetic profiles
  useEffect(() => {
    if (isAdmin) {
      setSyntheticProfiles(api.getSyntheticProfiles());
    }
  }, [isAdmin]);

  useEffect(() => {
    const syncProfiles = () => {
      setSyntheticProfiles(api.getSyntheticProfiles());
    };
    return api.subscribe(syncProfiles);
  }, []);

  // Check current profile role — uses getUser() for server-verified JWT auth
  const checkRole = useCallback(async () => {
    let aborted = false;
    try {
      // ── SECURITY: Use getUser() not getSession() ─────────────────────────────────
      // getSession() reads from localStorage — client-writable and unverified.
      // getUser() makes a round-trip to Supabase Auth to cryptographically verify
      // the JWT, so tampering with localStorage has no effect on this check.
      // ──────────────────────────────────────────────────────────────────────────
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (aborted) return;

      if (userErr || !user) {
        setIsAdmin(false);
        localStorage.removeItem('vitalsync_admin_logged_in');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (aborted) return;

      // Only trust the DB profile role — not app_metadata (settable client-side)
      const isProfileAdmin = profile?.role === 'admin' || profile?.role === 'platform_admin';

      if (isProfileAdmin) {
        setIsAdmin(true);
        localStorage.setItem('vitalsync_admin_logged_in', 'true');
      } else {
        setIsAdmin(false);
        localStorage.removeItem('vitalsync_admin_logged_in');
      }
    } catch (err) {
      if (aborted) return;
      console.error('[SaaS Admin] Failed to verify role:', err);
      // Fail closed — if we can't verify, deny access
      setIsAdmin(false);
      localStorage.removeItem('vitalsync_admin_logged_in');
    } finally {
      if (!aborted) setLoadingProfile(false);
    }
    return () => { aborted = true; };
  }, []);

  // Fetch aggregated SaaS statistics from RPCs
  const fetchSaaSMetrics = useCallback(async () => {
    if (!isAdmin) return;
    setMetricsLoading(true);
    try {
      const [
        { data: onboarding }, 
        { data: revenue }, 
        { data: costs },
        { data: pods }
      ] = await Promise.all([
        supabase.rpc('get_saas_onboarding_stats'),
        supabase.rpc('get_saas_revenue_stats'),
        supabase.rpc('get_saas_cost_stats'),
        supabase.from('pods').select('*').order('created_at', { ascending: false }).limit(20)
      ]);

      if (onboarding) setOnboardingStats(onboarding as OnboardingStats);
      if (revenue) setRevenueStats(revenue as RevenueStats);
      if (costs) setCostStats(costs as CostStats);
      
      if (pods) {
        // Enrich pods with cumulative daily spend values
        const enriched = await Promise.all(pods.map(async (pod: any) => {
          const { data: spend } = await supabase.rpc('get_pod_daily_spend', { p_pod_id: pod.id });
          return {
            ...pod,
            daily_spend: spend || 0.00
          };
        }));
        setPodsList(enriched as PodInfo[]);
        
        // Pre-populate budget inputs state
        const inputs: Record<string, string> = {};
        enriched.forEach((pod: any) => {
          inputs[pod.id] = (pod.daily_cost_budget ?? 500.00).toString();
        });
        setBudgetInputs(inputs);
      }
    } catch (err) {
      console.error('[SaaS Admin] Failed to fetch metrics aggregates:', err);
    } finally {
      setMetricsLoading(false);
    }
  }, [isAdmin]);

  // Security Scan Handler
  const runRlsComplianceScan = async () => {
    setAuditingRls(true);
    try {
      const { data, error } = await supabase.rpc('audit_rls_compliance');
      if (error) throw error;
      if (data) setComplianceList(data as RlsComplianceAudit[]);
      
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Compliance Scan Completed 🛡️',
          message: `Audited ${data.length} database tables.`,
          type: 'success'
        }
      }));
    } catch (err: any) {
      console.error('[SaaS Admin] Compliance scan failed:', err);
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Scan Failed ⚠️',
          message: err.message || 'Failed to audit database policies.',
          type: 'error'
        }
      }));
    } finally {
      setAuditingRls(false);
    }
  };

  // CFO Settlements Handler
  const fetchFailedSettlements = async () => {
    setLoadingSettlements(true);
    try {
      const { data, error } = await supabase.rpc('get_failed_settlements');
      if (error) throw error;
      if (data) setFailedSettlements(data as FailedSettlement[]);
    } catch (err) {
      console.error('[SaaS Admin] Failed to fetch failed settlements:', err);
    } finally {
      setLoadingSettlements(false);
    }
  };

  const handleForceRetrySplit = async (ledgerId: string) => {
    setRetryingId(ledgerId);
    try {
      const { data: success, error } = await supabase.rpc('retry_failed_settlement', { ledger_id: ledgerId });
      if (error) throw error;
      
      if (success) {
        window.dispatchEvent(new CustomEvent('mediflow-toast', {
          detail: {
            title: 'Payout Force-Retried 💸',
            message: 'Gateway retry triggered. Ledger state reverted to pending.',
            type: 'success'
          }
        }));
        fetchFailedSettlements();
        fetchSaaSMetrics(); // refresh revenue metrics too
      } else {
        throw new Error('Settlement retry failed. Row not found or not in failed state.');
      }
    } catch (err: any) {
      console.error('[SaaS Admin] Retry failed:', err);
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Retry Failed ⚠️',
          message: err.message || 'Connection failure while resetting payout status.',
          type: 'error'
        }
      }));
    } finally {
      setRetryingId(null);
    }
  };

  // Cost budgets Handler
  const handleUpdatePodBudget = async (podId: string) => {
    const inputValue = budgetInputs[podId];
    const newBudget = parseFloat(inputValue);
    if (isNaN(newBudget) || newBudget < 0) {
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Invalid Input ⚠️',
          message: 'Please enter a positive numeric value for the clinic budget.',
          type: 'error'
        }
      }));
      return;
    }

    setUpdatingBudgetPodId(podId);
    try {
      const { error } = await supabase
        .from('pods')
        .update({ daily_cost_budget: newBudget })
        .eq('id', podId);
      
      if (error) throw error;
      
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Budget Threshold Updated 🎯',
          message: `Clinic daily budget successfully capped at ₹${newBudget.toFixed(2)}.`,
          type: 'success'
        }
      }));
      
      // Update local list
      setPodsList(prev => prev.map(p => p.id === podId ? { ...p, daily_cost_budget: newBudget } : p));
    } catch (err: any) {
      console.error('[SaaS Admin] Failed to update budget:', err);
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Budget Save Failed ⚠️',
          message: err.message || 'Failed to update cost limits.',
          type: 'error'
        }
      }));
    } finally {
      setUpdatingBudgetPodId(null);
    }
  };

  // Toggle Pod Billing Verification
  const togglePodBillingVerification = async (podId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    try {
      const { error } = await supabase
        .from('pods')
        .update({ is_verified_for_billing: newStatus })
        .eq('id', podId);
      
      if (error) throw error;
      
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: newStatus ? 'Clinic Billing Active 💸' : 'Clinic Billing Suspended 🛑',
          message: newStatus ? 'Clinic has been verified and revenue split routing is live.' : 'Revenue splits halted. Clinic transactions suspended.',
          type: 'success'
        }
      }));
      
      // Refresh metrics list
      fetchSaaSMetrics();
    } catch (err: any) {
      console.error('[SaaS Admin] Failed to toggle billing status:', err);
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Operation Failed ⚠️',
          message: err.message || 'Failed to update billing verification status.',
          type: 'error'
        }
      }));
    }
  };

  // Update Pod Platform Fee Percent
  const updatePodPlatformFee = async (podId: string, currentFee: number) => {
    const feeStr = prompt('Enter new platform revenue share percentage (e.g. 2.5):', currentFee.toString());
    if (feeStr === null) return; // User cancelled
    
    const newFee = parseFloat(feeStr);
    if (isNaN(newFee) || newFee < 0 || newFee > 100) {
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Invalid Percentage ⚠️',
          message: 'Please enter a percentage value between 0 and 100.',
          type: 'error'
        }
      }));
      return;
    }

    try {
      const { error } = await supabase
        .from('pods')
        .update({ platform_fee_percent: newFee })
        .eq('id', podId);
      
      if (error) throw error;
      
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Platform Fee Updated 🎯',
          message: `Revenue share set to ${newFee}% for this clinic pod.`,
          type: 'success'
        }
      }));
      
      // Refresh metrics list
      fetchSaaSMetrics();
    } catch (err: any) {
      console.error('[SaaS Admin] Failed to update platform fee:', err);
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Fee Save Failed ⚠️',
          message: err.message || 'Failed to update platform fee percentage.',
          type: 'error'
        }
      }));
    }
  };

  // Send WhatsApp Billing Reminder for Cash Balance
  const sendCashBillingReminder = async (podId: string, clinicName: string, pendingCash: number) => {
    if (pendingCash <= 0) {
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'No Balance Due',
          message: `${clinicName} has ₹0.00 outstanding cash balance.`,
          type: 'info'
        }
      }));
      return;
    }

    try {
      // Fetch clinic owner profile (doctor) phone number dynamically
      const { data: staff } = await supabase
        .from('profiles')
        .select('phone, display_name')
        .eq('pod_id', podId)
        .eq('role', 'doctor')
        .limit(1);

      const phone = staff?.[0]?.phone || '9876543210';
      const name = staff?.[0]?.display_name || clinicName;

      const reminderText = `Namaste ${name}! 🏥 Mediflow Platform Administration. Aapke clinic pod ka outstanding platform fee pending balance *₹${pendingCash.toFixed(2)}* hai. Please settle this amount to ensure unhindered billing splits routing and live AI services. Thank you!`;

      // Dispatch the real conversational nudge to active session
      api.pushWhatsAppMessageFromBot(phone, reminderText);

      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Billing Reminder Sent 💬',
          message: `Sent WhatsApp invoice reminder for ₹${pendingCash.toFixed(2)} to ${name} (${phone}).`,
          type: 'success'
        }
      }));
    } catch (err: any) {
      console.error('[SaaS Admin] Failed to dispatch billing reminder:', err);
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Dispatch Failed ⚠️',
          message: err.message || 'Failed to resolve clinic owner credentials.',
          type: 'error'
        }
      }));
    }
  };

  // Settle Outstanding Cash Balance
  const settleCashBalance = async (podId: string, clinicName: string) => {
    const confirmSettle = window.confirm(`Are you sure you want to settle the outstanding cash balance for ${clinicName}?`);
    if (!confirmSettle) return;

    try {
      const { error } = await supabase
        .from('pods')
        .update({ pending_cash_balance: 0.00 })
        .eq('id', podId);
      
      if (error) throw error;
      
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Cash Balance Cleared 🤝',
          message: `Outstanding platform fee balance cleared for ${clinicName}.`,
          type: 'success'
        }
      }));

      // Refresh metrics list
      fetchSaaSMetrics();
    } catch (err: any) {
      console.error('[SaaS Admin] Failed to settle cash balance:', err);
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Settlement Failed ⚠️',
          message: err.message || 'Failed to clear outstanding cash balance.',
          type: 'error'
        }
      }));
    }
  };

  // DevSecOps Firewall Handlers
  const fetchFirewallData = async () => {
    setLoadingFirewall(true);
    try {
      const [
        { data: blacklistData, error: err1 },
        { data: rateLimitsData, error: err2 }
      ] = await Promise.all([
        supabase.from('blacklisted_ips').select('*').order('created_at', { ascending: false }),
        supabase.from('rate_limits').select('*').order('window_start', { ascending: false }).limit(20)
      ]);

      if (err1) throw err1;
      if (err2) throw err2;

      if (blacklistData) setBlacklistedIps(blacklistData as BlacklistedIp[]);
      if (rateLimitsData) setRateLimits(rateLimitsData as RateLimitRow[]);
    } catch (err) {
      console.error('[SaaS Admin] Failed to fetch firewall logs:', err);
    } finally {
      setLoadingFirewall(false);
    }
  };

  const handleAddIpToBlacklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIp) return;
    setAddingIp(true);
    try {
      const { error } = await supabase.from('blacklisted_ips').insert({
        ip: newIp.trim(),
        reason: newReason.trim() || 'Manual blacklist via Platform Operations console.'
      });

      if (error) throw error;

      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'IP Blacklisted Globally 🚫',
          message: `Connections from ${newIp} are now blocked at the edge gateway.`,
          type: 'success'
        }
      }));

      setNewIp('');
      setNewReason('');
      fetchFirewallData();
    } catch (err: any) {
      console.error('[SaaS Admin] Add blacklist failed:', err);
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Blacklist Action Failed ⚠️',
          message: err.message || 'Failed to blacklist IP address.',
          type: 'error'
        }
      }));
    } finally {
      setAddingIp(false);
    }
  };

  const handleRemoveIpFromBlacklist = async (ipAddress: string) => {
    setRemovingIp(ipAddress);
    try {
      const { error } = await supabase.from('blacklisted_ips').delete().eq('ip', ipAddress);
      if (error) throw error;

      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'IP Firewall Rule Deleted ✅',
          message: `IP ${ipAddress} was unblocked and allowed connection access.`,
          type: 'success'
        }
      }));

      fetchFirewallData();
    } catch (err: any) {
      console.error('[SaaS Admin] Remove blacklist failed:', err);
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Unblock Failed ⚠️',
          message: err.message || 'Failed to remove firewall rule.',
          type: 'error'
        }
      }));
    } finally {
      setRemovingIp(null);
    }
  };

  // Auth synchronization
  useEffect(() => {
    checkRole();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkRole();
    });
    return () => subscription.unsubscribe();
  }, [checkRole]);

  useEffect(() => {
    if (isAdmin) {
      fetchSaaSMetrics();
    }
  }, [isAdmin, fetchSaaSMetrics]);

  // Handle side effects when switching tabs
  useEffect(() => {
    if (!isAdmin) return;
    if (activeTab === 'onboarding' && complianceList.length === 0) {
      runRlsComplianceScan();
    } else if (activeTab === 'revenue') {
      fetchFailedSettlements();
    } else if (activeTab === 'firewall') {
      fetchFirewallData();
    }
  }, [isAdmin, activeTab]);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.removeItem('vitalsync_admin_logged_in');
      setIsAdmin(false);
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Signed Out Successfully 👋',
          message: 'Logged out from VitalSync SaaS Operations Panel.',
          type: 'info'
        }
      }));
    } catch (err) {
      console.error('Error during admin signout:', err);
    }
  };

  const handleAdminSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setAuthLoading(true);
    setErrorMsg(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      if (data?.user) {
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();

        if (profileErr) throw profileErr;

        if (profile?.role === 'admin' || profile?.role === 'platform_admin') {
          setIsAdmin(true);
          window.dispatchEvent(new CustomEvent('mediflow-toast', {
            detail: {
              title: 'Owner Portal Initialized 🔑',
              message: 'Access granted to VitalSync SaaS Operations Center.',
              type: 'success'
            }
          }));
        } else {
          await supabase.auth.signOut();
          setIsAdmin(false);
          throw new Error('Access Denied: This account does not possess Platform Owner authorization.');
        }
      }
    } catch (err: any) {
      console.error('[SaaS Admin] Login failed:', err);
      setErrorMsg(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setAuthLoading(false);
    }
  };

  if (loadingProfile) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-10 w-10 text-cyan-500 animate-spin" />
        <span className="text-xs text-slate-400 font-semibold tracking-wider uppercase">Loading security context...</span>
      </div>
    );
  }

  // Authorized Admin View
  if (isAdmin) {
    const agents = [
      { id: 'saas_health' as const, label: 'Health Auto Agent', desc: 'DevSecOps & Self-Healing', icon: Terminal },
      { id: 'onboarding'  as const, label: 'Onboarding Agent', desc: 'Pod & RLS Compliance', icon: Building },
      { id: 'revenue'     as const, label: 'CFO Finance Agent', desc: 'Split Retry & Ledger', icon: Coins },
      { id: 'costs'       as const, label: 'Cost Controller',    desc: 'Daily Budget Checker', icon: MessageSquare },
      { id: 'firewall'    as const, label: 'DevSecOps Sentry',   desc: 'IP Firewall & Blacklist', icon: ShieldAlert }
    ];

    return (
      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
        
        {/* ── Top Header Control Bar ───────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-200/10 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Terminal className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                VitalSync Platform Operations
                <span className="flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 text-[9px] font-bold text-indigo-700 tracking-wider uppercase animate-pulse">
                  Platform Owner View
                </span>
              </h2>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-extrabold mt-0.5">
                SaaS System Administration Control Panel
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              type="button"
              onClick={fetchSaaSMetrics}
              disabled={metricsLoading}
              className="inline-flex h-8 items-center justify-center gap-1.5 px-3 min-w-[110px] rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold disabled:opacity-50 transition-all cursor-pointer shadow-2xs whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-indigo-600 ${metricsLoading ? 'animate-spin' : ''}`} />
              Sync Metrics
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex h-8 items-center justify-center gap-1.5 px-3 min-w-[95px] rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold transition-all cursor-pointer shadow-2xs whitespace-nowrap shrink-0"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </div>
        </div>

        {/* ── Virtual Operations Team Navigation (Laptop Header) ───────────────── */}
        <div className="hidden lg:flex items-center gap-3 bg-slate-50/50 p-2.5 rounded-2xl border border-slate-200/60 mb-6 flex-wrap">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2 mr-2">
            Virtual Operations Team:
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            {agents.map(agent => {
              const Icon = agent.icon;
              const isActive = activeTab === agent.id;
              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => setActiveTab(agent.id)}
                  className={`flex items-center gap-2 py-2 px-3.5 rounded-xl border text-xs font-bold transition-all duration-200 cursor-pointer shadow-xs ${
                    isActive 
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/15 hover:bg-indigo-700 hover:border-indigo-700' 
                      : 'bg-white border-slate-200 text-slate-700 hover:scale-[1.01] hover:border-slate-350'
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{agent.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Active Workspace Screen ─────────────────────────────────────────── */}
        <div className="space-y-6 pb-20 lg:pb-0">

          {/* TAB: Health Autonomous Agent */}
          {activeTab === 'saas_health' && (
            <div className="animate-fade-in space-y-4">
              <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl flex items-start gap-3">
                <Activity className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Health Autonomous Agent Enabled</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                    This agent runs 24/7 scanning for database drifts, API timeouts, and React runtime crashes to guarantee system uptime.
                  </p>
                </div>
              </div>
              <SystemHealthCockpit />
            </div>
          )}

          {/* TAB: Onboarding Agent */}
          {activeTab === 'onboarding' && onboardingStats && (
            <div className="animate-fade-in space-y-6">

              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Total Clinics (Pods)', value: onboardingStats.total_pods, desc: 'Active isolated tenant spaces', icon: Building, color: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
                  { label: 'Total Storefronts', value: onboardingStats.total_entities, desc: 'Clinics, pharmacies, and labs', icon: Layers, color: 'text-cyan-600 bg-cyan-50 border-cyan-100' },
                  { label: 'Active User Accounts', value: onboardingStats.total_profiles, desc: 'Doctors, compounders, staff', icon: Users, color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
                ].map(stat => {
                  const Icon = stat.icon;
                  return (
                    <div key={stat.label} className={`p-5 rounded-2xl border ${stat.color} flex flex-col justify-between`}>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{stat.label}</span>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="mt-4">
                        <h4 className="text-2xl font-black text-slate-800">{stat.value}</h4>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-none">{stat.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

                {/* Subsystem breakdown */}
                <div className="p-5 rounded-3xl border border-slate-200 bg-white space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <Users className="h-4.5 w-4.5 text-indigo-500" />
                    Storefront Categories Allocation
                  </h4>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: 'Connected Clinics', value: onboardingStats.clinics, bg: 'bg-indigo-500' },
                      { label: 'Adjacent Pharmacies', value: onboardingStats.pharmacies, bg: 'bg-emerald-500' },
                      { label: 'Referral Laboratories', value: onboardingStats.labs, bg: 'bg-blue-500' }
                    ].map(type => (
                      <div key={type.label} className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 text-center">
                        <div className="text-lg font-extrabold text-slate-800">{type.value}</div>
                        <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">{type.label}</div>
                        <div className="w-full h-1 bg-slate-200 rounded-full mt-2 overflow-hidden">
                          <div className={`h-full ${type.bg}`} style={{ width: onboardingStats.total_entities > 0 ? `${(type.value / onboardingStats.total_entities) * 100}%` : '0%' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Security Sentry Auditor Panel */}
                <div className="p-5 rounded-3xl border border-slate-200 bg-white space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                    <div className="flex items-center gap-2">
                      <LockKeyhole className="h-5 w-5 text-indigo-600" />
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Security Sentry: RLS Policy Auditor</h4>
                        <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">Verify schema Row-Level Security isolation across multi-tenant clinical pods.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={runRlsComplianceScan}
                      disabled={auditingRls}
                      className="flex h-8 items-center gap-1.5 px-3 rounded-lg bg-indigo-600 text-white hover:bg-indigo-750 text-[10px] font-bold uppercase tracking-widest disabled:opacity-50 cursor-pointer shadow-sm transition-all"
                    >
                      {auditingRls ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Play className="h-3 w-3" />
                      )}
                      Scan Policies
                    </button>
                  </div>

                  {complianceList.length > 0 ? (
                    <div className="border border-slate-100 rounded-xl overflow-hidden max-h-[250px] overflow-y-auto overflow-x-auto responsive-table-container">
                      <table className="w-full text-left text-[11px] font-medium text-slate-600">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-150 text-[9px] uppercase text-slate-400 font-bold">
                            <th className="p-2.5 pl-3">Table Name</th>
                            <th className="p-2.5">RLS Config</th>
                            <th className="p-2.5 text-center">Policies</th>
                            <th className="p-2.5">Pod Isolation</th>
                            <th className="p-2.5 pr-3 text-right">Audit Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {complianceList.map(table => (
                            <tr key={table.table_name} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                              <td className="p-2.5 pl-3 font-mono font-bold text-slate-750">{table.table_name}</td>
                              <td className="p-2.5">
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                  table.rls_enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600 font-black animate-pulse'
                                }`}>
                                  {table.rls_enabled ? 'Active' : 'Missing RLS'}
                                </span>
                              </td>
                              <td className="p-2.5 text-center font-bold">{table.policy_count}</td>
                              <td className="p-2.5">
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                  table.has_pod_isolation ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'
                                }`}>
                                  {table.has_pod_isolation ? 'Isolated' : 'Cross-Pod'}
                                </span>
                              </td>
                              <td className="p-2.5 pr-3 text-right">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                  table.status === 'secure' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                }`}>
                                  {table.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-8 border border-dashed border-slate-200 rounded-xl text-center text-slate-400 text-[11px] font-semibold">
                      Security policy metrics not loaded. Click "Scan Policies" to audit RLS configurations.
                    </div>
                  )}
                </div>

                {/* Active Pods List */}
                <div className="p-5 rounded-3xl border border-slate-200 bg-white space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Active Tenant Pods (Revenue Share Configuration)</h4>
                  <div className="overflow-x-auto responsive-table-container">
                    <table className="w-full text-left text-xs font-medium text-slate-600">
                      <thead>
                        <tr className="border-b border-slate-200/60 text-[10px] uppercase text-slate-400 font-bold">
                          <th className="pb-2">Clinic Code</th>
                          <th className="pb-2">Name</th>
                          <th className="pb-2">Location</th>
                          <th className="pb-2">Platform Fee</th>
                          <th className="pb-2">Lifetime Rev</th>
                          <th className="pb-2">Pending Cash</th>
                          <th className="pb-2">Billing Status</th>
                          <th className="pb-2">Onboarded</th>
                          <th className="pb-2 pr-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {podsList.map(pod => (
                          <tr key={pod.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                            <td className="py-3 font-mono font-bold text-indigo-600">{pod.clinic_code}</td>
                            <td className="py-3 font-bold text-slate-800">{pod.name}</td>
                            <td className="py-3 text-slate-550">{pod.location || 'Patna, Bihar'}</td>
                            <td className="py-3 font-mono font-bold text-slate-700">
                              {pod.platform_fee_percent !== undefined ? `${pod.platform_fee_percent}%` : '2.5%'}
                            </td>
                            <td className="py-3 font-mono font-bold text-emerald-600">
                              ₹{pod.lifetime_platform_revenue !== undefined ? Number(pod.lifetime_platform_revenue).toFixed(2) : '0.00'}
                            </td>
                            <td className="py-3 font-mono font-bold text-rose-600">
                              ₹{pod.pending_cash_balance !== undefined ? Number(pod.pending_cash_balance).toFixed(2) : '0.00'}
                            </td>
                            <td className="py-3">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                pod.is_verified_for_billing 
                                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                                  : 'bg-rose-50 text-rose-600 border border-rose-100 animate-pulse'
                              }`}>
                                {pod.is_verified_for_billing ? 'Verified' : 'Pending Verification'}
                              </span>
                            </td>
                            <td className="py-3 text-slate-400 font-mono">{new Date(pod.created_at).toLocaleDateString()}</td>
                            <td className="py-3 pr-3 text-right space-x-2">
                              <button
                                type="button"
                                onClick={() => togglePodBillingVerification(pod.id, !!pod.is_verified_for_billing)}
                                className={`text-[10px] font-black uppercase cursor-pointer ${
                                  pod.is_verified_for_billing ? 'text-rose-600 hover:text-rose-800' : 'text-emerald-600 hover:text-emerald-800'
                                }`}
                              >
                                {pod.is_verified_for_billing ? 'Deactivate' : 'Verify Billing'}
                              </button>
                              <button
                                type="button"
                                onClick={() => updatePodPlatformFee(pod.id, pod.platform_fee_percent || 2.5)}
                                className="text-[10px] font-black text-slate-500 hover:text-slate-700 uppercase cursor-pointer"
                              >
                                Set Fee
                              </button>
                              {pod.pending_cash_balance && Number(pod.pending_cash_balance) > 0 ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => sendCashBillingReminder(pod.id, pod.name, Number(pod.pending_cash_balance))}
                                    className="text-[10px] font-black text-amber-600 hover:text-amber-800 uppercase cursor-pointer"
                                  >
                                    Remind
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => settleCashBalance(pod.id, pod.name)}
                                    className="text-[10px] font-black text-indigo-650 hover:text-indigo-850 uppercase cursor-pointer"
                                  >
                                    Settle
                                  </button>
                                </>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Synthetic User Profile Generation Control Panel */}
                <div className="p-5 rounded-3xl border border-slate-200 bg-white space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-indigo-600" />
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Synthetic Profile Manager</h4>
                        <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">Generate and manage synthetic/mock profiles for product demonstrations.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={genCount}
                        onChange={(e) => setGenCount(parseInt(e.target.value))}
                        className="h-8 rounded-lg border border-slate-200 px-2 text-xs font-bold text-slate-700 outline-none cursor-pointer bg-white"
                      >
                        {[5, 10, 20, 50, 100].map(c => (
                          <option key={c} value={c}>{c} Profiles</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          try {
                            api.generateSyntheticProfiles(genCount);
                            window.dispatchEvent(new CustomEvent('mediflow-toast', {
                              detail: {
                                title: 'Profiles Generated',
                                message: `Successfully generated ${genCount} synthetic profiles.`,
                                type: 'success'
                              }
                            }));
                          } catch (err: any) {
                            window.dispatchEvent(new CustomEvent('mediflow-toast', {
                              detail: {
                                title: 'Generation Failed',
                                message: err.message,
                                type: 'error'
                              }
                            }));
                          }
                        }}
                        className="flex h-8 items-center gap-1 px-3 rounded-lg bg-indigo-600 text-white hover:bg-indigo-750 text-[10px] font-bold uppercase tracking-widest cursor-pointer shadow-sm transition-all"
                      >
                        Generate
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          api.clearAllSyntheticProfiles();
                          window.dispatchEvent(new CustomEvent('mediflow-toast', {
                            detail: {
                              title: 'Profiles Cleared',
                              message: 'Cleared all synthetic profiles.',
                              type: 'info'
                            }
                          }));
                        }}
                        className="flex h-8 items-center gap-1 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-[10px] font-bold uppercase tracking-widest cursor-pointer shadow-sm transition-all"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  {syntheticProfiles.length > 0 ? (
                    <div className="border border-slate-100 rounded-xl overflow-hidden max-h-[300px] overflow-y-auto overflow-x-auto responsive-table-container">
                      <table className="w-full text-left text-[11px] font-medium text-slate-655">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-150 text-[9px] uppercase text-slate-400 font-bold">
                            <th className="p-2.5 pl-3">Profile Name</th>
                            <th className="p-2.5">Assigned Role</th>
                            <th className="p-2.5 text-center">Interactions</th>
                            <th className="p-2.5">Last Active</th>
                            <th className="p-2.5">Visual Label</th>
                            <th className="p-2.5 pr-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {syntheticProfiles.map(profile => (
                            <tr key={profile.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                              <td className="p-2.5 pl-3 font-bold text-slate-750">{profile.name}</td>
                              <td className="p-2.5">
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-650">
                                  {profile.role}
                                </span>
                              </td>
                              <td className="p-2.5 text-center font-bold font-mono">{profile.associatedActivityMetric.interactionsCount}</td>
                              <td className="p-2.5 text-slate-400 font-mono">{new Date(profile.associatedActivityMetric.lastActive).toLocaleTimeString()}</td>
                              <td className="p-2.5">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 border border-amber-500/25 animate-pulse">
                                  MOCK DATA
                                </span>
                              </td>
                              <td className="p-2.5 pr-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => api.deleteSyntheticProfile(profile.id)}
                                  className="text-rose-600 hover:text-rose-800 font-bold text-[10px] uppercase cursor-pointer"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-8 border border-dashed border-slate-200 rounded-xl text-center text-slate-400 text-[11px] font-semibold">
                      No synthetic profiles created yet. Generate them using the control bar above.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: CFO Revenue Agent */}
            {activeTab === 'revenue' && revenueStats && (
              <div className="animate-fade-in space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { label: 'Ecosystem sales (GMV)', value: `₹${revenueStats.total_gmv}`, desc: 'Total sales from clinics + medicine', icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
                    { label: 'Platform Commissions', value: `₹${revenueStats.platform_commission}`, desc: 'Dynamic transaction-based revenue splits', icon: Coins, color: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
                    { label: 'Settled Invoices', value: revenueStats.paid_invoices, desc: 'Unified invoice checkouts paid', icon: CheckCircle, color: 'text-cyan-600 bg-cyan-50 border-cyan-100' },
                  ].map(stat => {
                    const Icon = stat.icon;
                    return (
                      <div key={stat.label} className={`p-5 rounded-2xl border ${stat.color} flex flex-col justify-between`}>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{stat.label}</span>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="mt-4">
                          <h4 className="text-2xl font-black text-slate-800">{stat.value}</h4>
                          <p className="text-[10px] text-slate-500 mt-0.5 leading-none">{stat.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* CFO Financial Reconciler: Failed split payout retry ledger */}
                <div className="p-5 rounded-3xl border border-slate-200 bg-white space-y-4">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-indigo-600" />
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Financial Reconciler: Failed Split Payouts Ledger</h4>
                      <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">Monitor split transaction settlements that failed Cashfree disbursement routines. Force a gateway settlement retry.</p>
                    </div>
                  </div>

                  {loadingSettlements ? (
                    <div className="min-h-[120px] flex items-center justify-center">
                      <Loader2 className="h-6 w-6 text-indigo-500 animate-spin" />
                    </div>
                  ) : failedSettlements.length > 0 ? (
                    <div className="border border-slate-100 rounded-xl overflow-hidden overflow-x-auto responsive-table-container">
                      <table className="w-full text-left text-[11px] font-medium text-slate-655">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-150 text-[9px] uppercase text-slate-400 font-bold">
                            <th className="p-2.5 pl-3">Source Clinic</th>
                            <th className="p-2.5">Destination Partner</th>
                            <th className="p-2.5">Type</th>
                            <th className="p-2.5">Gross (₹)</th>
                            <th className="p-2.5">Net (₹)</th>
                            <th className="p-2.5">Fail Time</th>
                            <th className="p-2.5 pr-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {failedSettlements.map(ledger => (
                            <tr key={ledger.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                              <td className="p-2.5 pl-3 font-bold text-slate-750">{ledger.source_entity_name}</td>
                              <td className="p-2.5 font-bold text-slate-700">{ledger.destination_entity_name}</td>
                              <td className="p-2.5 font-mono text-slate-500">{ledger.transaction_type}</td>
                              <td className="p-2.5 text-slate-800 font-bold">{Number(ledger.gross_amount).toFixed(2)}</td>
                              <td className="p-2.5 text-rose-600 font-extrabold">{Number(ledger.net_payout).toFixed(2)}</td>
                              <td className="p-2.5 text-slate-400 font-mono">{new Date(ledger.created_at).toLocaleString()}</td>
                              <td className="p-2.5 pr-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleForceRetrySplit(ledger.id)}
                                  disabled={retryingId === ledger.id}
                                  className="h-7 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/50 rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all flex items-center justify-center gap-1 inline-flex"
                                >
                                  {retryingId === ledger.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    'Force Retry'
                                  )}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-8 border border-dashed border-slate-200 rounded-xl text-center text-slate-400 text-[11px] font-semibold">
                      🎉 Operations cleared. No failed settlements found in payment split retry ledger.
                    </div>
                  )}
                </div>

                {/* Cashfree Webhook Status Indicator */}
                <div className="p-5 rounded-3xl border border-slate-200 bg-white space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                      <CreditCard className="h-4.5 w-4.5 text-indigo-500" />
                      Payment Gateway Integration Status
                    </h4>
                    <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Operational
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">
                    The platform's split payout logic distributes doctor fees, lab fees, and pharmacy fees synchronously. Cashfree Vendor splits are computed and routed directly from B2B clinic gateways on checkout.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 border border-slate-200/50 rounded-xl space-y-1">
                      <span className="block text-[9px] text-slate-500 font-bold uppercase tracking-wider">Commission Rate</span>
                      <span className="block text-sm font-extrabold text-slate-850">3% per B2B split checkout</span>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200/50 rounded-xl space-y-1">
                      <span className="block text-[9px] text-slate-500 font-bold uppercase tracking-wider">Split Limit Policy</span>
                      <span className="block text-sm font-extrabold text-slate-850">Flat ₹10 low-value protection</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: Cost Controller Agent */}
            {activeTab === 'costs' && costStats && (
              <div className="animate-fade-in space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'WhatsApp Msg count', value: costStats.waba_msgs_sent, desc: 'Outbound templates sent', icon: MessageSquare, color: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
                    { label: 'WABA message costs', value: `₹${parseFloat(costStats.waba_cost.toString()).toFixed(2)}`, desc: 'Meta conversation usage fees', icon: Coins, color: 'text-rose-600 bg-rose-50 border-rose-100' },
                    { label: 'AI Summaries run', value: costStats.ai_tasks_run, desc: 'Agent Scribe completions', icon: Cpu, color: 'text-cyan-600 bg-cyan-50 border-cyan-100' },
                    { label: 'Est. OpenAI/LLM cost', value: `₹${parseFloat(costStats.ai_cost.toString()).toFixed(2)}`, desc: '₹0.50 per clinical script execution', icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
                  ].map(stat => {
                    const Icon = stat.icon;
                    return (
                      <div key={stat.label} className={`p-4 rounded-2xl border ${stat.color} flex flex-col justify-between`}>
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 leading-none">{stat.label}</span>
                          <Icon className="h-4.5 w-4.5 shrink-0" />
                        </div>
                        <div className="mt-4">
                          <h4 className="text-xl font-black text-slate-850 leading-none">{stat.value}</h4>
                          <p className="text-[9px] text-slate-500 mt-1 leading-none">{stat.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Clinic Daily Spending cap controller */}
                <div className="p-5 rounded-3xl border border-slate-200 bg-white space-y-4">
                  <div className="flex items-center gap-2">
                    <Sliders className="h-5 w-5 text-indigo-600" />
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Cost Guard: Clinic Spending Threshold Controller</h4>
                      <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">Enforce hard spending budget ceilings (AI processing + WhatsApp logs billing) dynamically per-clinic pod.</p>
                    </div>
                  </div>

                  <div className="border border-slate-100 rounded-xl overflow-hidden overflow-x-auto responsive-table-container">
                    <table className="w-full text-left text-[11px] font-medium text-slate-650">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-150 text-[9px] uppercase text-slate-400 font-bold">
                          <th className="p-2.5 pl-3">Clinic Code / Pod</th>
                          <th className="p-2.5">Cumulative Spend Today</th>
                          <th className="p-2.5">Active AI Tier</th>
                          <th className="p-2.5">Daily Budget Progress</th>
                          <th className="p-2.5 text-center">Threshold (₹)</th>
                          <th className="p-2.5 pr-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {podsList.map(pod => {
                          const budget = pod.daily_cost_budget ?? 500.00;
                          const pct = Math.min((pod.daily_spend / budget) * 100, 100);
                          const inputVal = budgetInputs[pod.id] || '';
                          
                          return (
                            <tr key={pod.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                              <td className="p-2.5 pl-3">
                                <div className="font-bold text-slate-850">{pod.name}</div>
                                <div className="text-[9px] font-mono text-indigo-600 mt-0.5 font-bold">{pod.clinic_code}</div>
                              </td>
                              <td className="p-2.5 font-bold text-slate-750">
                                ₹{Number(pod.daily_spend).toFixed(2)}
                              </td>
                              <td className="p-2.5">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                  pct >= 100 
                                    ? 'bg-rose-50 text-rose-600 border border-rose-100' 
                                    : pct >= 85 
                                      ? 'bg-amber-50 text-amber-600 border border-amber-100' 
                                      : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                }`}>
                                  {pct >= 100 ? 'Paused (Cap)' : pct >= 85 ? 'Gemini Flash' : 'Gemini Pro'}
                                </span>
                              </td>
                              <td className="p-2.5 w-1/4">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full rounded-full transition-all duration-300 ${
                                        pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                                      }`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <span className="text-[9px] font-bold text-slate-500">{pct.toFixed(0)}%</span>
                                </div>
                              </td>
                              <td className="p-2.5 text-center">
                                <input
                                  type="text"
                                  value={inputVal}
                                  onChange={(e) => setBudgetInputs(prev => ({ ...prev, [pod.id]: e.target.value }))}
                                  className="w-20 px-2 py-1 bg-slate-50 border border-slate-200 focus:border-cyan-500/50 outline-none rounded text-center text-xs font-mono font-bold"
                                />
                              </td>
                              <td className="p-2.5 pr-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleUpdatePodBudget(pod.id)}
                                  disabled={updatingBudgetPodId === pod.id}
                                  className="h-7 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all disabled:opacity-50"
                                >
                                  {updatingBudgetPodId === pod.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    'Save'
                                  )}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* API and consumption limit cards */}
                <div className="p-5 rounded-3xl border border-slate-200 bg-white space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <Database className="h-4.5 w-4.5 text-indigo-500" />
                    Infrastructure Usage & API Thresholds
                  </h4>
                  <div className="space-y-3.5">
                    {[
                      { name: 'Meta WhatsApp Business API limits', current: costStats.waba_msgs_sent, limit: 10000, color: 'bg-emerald-500' },
                      { name: 'AI Scribe (OpenAI GPT-4o rate limits)', current: costStats.ai_tasks_run, limit: 5000, color: 'bg-cyan-500' },
                      { name: 'Supabase DB Connection limit', current: 24, limit: 500, color: 'bg-indigo-500' },
                    ].map(lim => {
                      const pct = Math.min((lim.current / lim.limit) * 100, 100);
                      return (
                        <div key={lim.name} className="space-y-1">
                          <div className="flex justify-between text-[11px] font-bold">
                            <span className="text-slate-650">{lim.name}</span>
                            <span className="text-slate-500">{lim.current} / {lim.limit}</span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full ${lim.color} transition-all duration-500`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: DevSecOps Sentry (Firewall Console) */}
            {activeTab === 'firewall' && (
              <div className="animate-fade-in space-y-6">
                
                {/* Intro module */}
                <div className="p-5 rounded-3xl border border-slate-200 bg-white space-y-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl flex items-center justify-center">
                      <ShieldAlert className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Edge Sentry: IP Blacklist Firewall Console</h4>
                      <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">Monitor real-time edge API request frequencies, identify rate-limit triggers, and blacklist malicious client IPs globally.</p>
                    </div>
                  </div>

                  {/* Manual Blacklist Form */}
                  <form onSubmit={handleAddIpToBlacklist} className="bg-slate-50 p-4 border border-slate-200/60 rounded-xl space-y-3">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Blacklist Manual Rule Addition</div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={newIp}
                          onChange={(e) => setNewIp(e.target.value)}
                          placeholder="IP Address (e.g. 157.45.12.98)"
                          className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-200 focus:border-cyan-500/50 outline-none rounded-lg"
                          required
                        />
                      </div>
                      <div className="flex-[2]">
                        <input
                          type="text"
                          value={newReason}
                          onChange={(e) => setNewReason(e.target.value)}
                          placeholder="Reason (e.g. Malicious SQL Injection attempts)"
                          className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-200 focus:border-cyan-500/50 outline-none rounded-lg"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={addingIp}
                        className="h-9 px-4 bg-rose-600 hover:bg-rose-750 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest cursor-pointer transition-all disabled:opacity-50 flex items-center justify-center gap-1 shrink-0"
                      >
                        {addingIp ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          'Block IP'
                        )}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Firewall status details - Two lists */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* Left Column: Active Blacklist rules (7 columns) */}
                  <div className="lg:col-span-7 p-5 rounded-3xl border border-slate-200 bg-white space-y-3">
                    <div className="flex justify-between items-center">
                      <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <Lock className="h-4 w-4 text-rose-500" />
                        Active IP Firewall Blacklist
                      </h4>
                      <span className="text-[9px] font-bold text-slate-450 px-2 py-0.5 bg-slate-100 rounded-full">
                        {blacklistedIps.length} blocked
                      </span>
                    </div>

                    {loadingFirewall ? (
                      <div className="min-h-[100px] flex items-center justify-center">
                        <Loader2 className="h-5 w-5 text-slate-400 animate-spin" />
                      </div>
                    ) : blacklistedIps.length > 0 ? (
                      <div className="border border-slate-100 rounded-xl overflow-hidden max-h-[250px] overflow-y-auto overflow-x-auto responsive-table-container">
                        <table className="w-full text-left text-[11px] font-medium text-slate-600">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-150 text-[9px] uppercase text-slate-400 font-bold">
                              <th className="p-2.5 pl-3">IP Address</th>
                              <th className="p-2.5">Blocked Reason</th>
                              <th className="p-2.5 pr-3 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {blacklistedIps.map(rule => (
                              <tr key={rule.ip} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                                <td className="p-2.5 pl-3 font-mono font-bold text-rose-600">{rule.ip}</td>
                                <td className="p-2.5 text-slate-500 leading-normal">{rule.reason}</td>
                                <td className="p-2.5 pr-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveIpFromBlacklist(rule.ip)}
                                    disabled={removingIp === rule.ip}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all cursor-pointer inline-flex"
                                    title="Delete rule (Unblock IP)"
                                  >
                                    {removingIp === rule.ip ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-8 border border-dashed border-slate-200 rounded-xl text-center text-slate-400 text-[11px] font-semibold">
                        No active firewall rules. All IP traffic allowed.
                      </div>
                    )}
                  </div>

                  {/* Right Column: Rate Limiter Telemetry Logs (5 columns) */}
                  <div className="lg:col-span-5 p-5 rounded-3xl border border-slate-200 bg-white space-y-3">
                    <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Globe className="h-4 w-4 text-cyan-500" />
                      Edge Rate Limiter Logs (Recent)
                    </h4>

                    {loadingFirewall ? (
                      <div className="min-h-[100px] flex items-center justify-center">
                        <Loader2 className="h-5 w-5 text-slate-400 animate-spin" />
                      </div>
                    ) : rateLimits.length > 0 ? (
                      <div className="border border-slate-100 rounded-xl overflow-hidden max-h-[250px] overflow-y-auto overflow-x-auto responsive-table-container">
                        <table className="w-full text-left text-[11px] font-medium text-slate-600">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-150 text-[9px] uppercase text-slate-400 font-bold">
                              <th className="p-2.5 pl-3">Client IP</th>
                              <th className="p-2.5 text-center">Requests</th>
                              <th className="p-2.5 pr-3 text-right">Age</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rateLimits.map(log => {
                              const ageSec = Math.max(0, Math.floor((Date.now() - new Date(log.window_start).getTime()) / 1000));
                              return (
                                <tr key={log.ip} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                                  <td className="p-2.5 pl-3 font-mono text-slate-700">{log.ip}</td>
                                  <td className="p-2.5 text-center font-bold font-mono">
                                    <span className={log.request_count >= 15 ? 'text-amber-600 font-black animate-pulse' : 'text-slate-650'}>
                                      {log.request_count}
                                    </span>
                                  </td>
                                  <td className="p-2.5 pr-3 text-right text-slate-400 font-mono">
                                    {ageSec < 60 ? `${ageSec}s ago` : `${Math.floor(ageSec / 60)}m ago`}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-8 border border-dashed border-slate-200 rounded-xl text-center text-slate-400 text-[11px] font-semibold">
                        No active edge connection rate limits logged.
                      </div>
                    )}
                  </div>

                </div>

              </div>
            )}
        </div>

        {/* ── Virtual Operations Team Navigation (Mobile Footer) ───────────────── */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-950/95 backdrop-blur-lg border-t border-slate-200/50 dark:border-white/5 shadow-[0_-4px_12px_rgba(0,0,0,0.03)] px-2 pb-safe-bottom">
          <div className="flex justify-around items-center h-16 max-w-md mx-auto">
            {agents.map(agent => {
              const Icon = agent.icon;
              const isActive = activeTab === agent.id;
              
              const shortLabels: Record<string, string> = {
                saas_health: 'Health',
                onboarding: 'Onboard',
                revenue: 'Finance',
                costs: 'Costs',
                firewall: 'Sentry'
              };
              const shortLabel = shortLabels[agent.id] || agent.label;

              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => setActiveTab(agent.id)}
                  className={`flex flex-col items-center justify-center flex-1 py-1.5 transition-all cursor-pointer ${
                    isActive ? 'text-slate-900 dark:text-white font-extrabold scale-105' : 'text-slate-400 dark:text-zinc-500 font-semibold'
                  }`}
                >
                  <Icon className={`h-5 w-5 mb-0.5 ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-zinc-500'}`} />
                  <span className="text-[10px] font-bold uppercase tracking-wide leading-none">{shortLabel}</span>
                </button>
              );
            })}
          </div>
        </div>

      </div>
    );
  }

  // Unauthorized Login Gate Screen
  return (
    <div className="min-h-[600px] flex items-center justify-center p-4">
      <div className="w-full max-w-md relative">
        <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-cyan-500 via-teal-500 to-indigo-500 opacity-20 blur-xl pointer-events-none" />
        
        <div className="relative rounded-3xl border border-slate-200 bg-white p-8 shadow-xl flex flex-col space-y-6 text-slate-800">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-cyan-50 border border-cyan-100 flex items-center justify-center text-cyan-600 shadow-sm animate-pulse-subtle">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-800 tracking-tight">Platform Owner Gateway</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                Restricted Operational Network
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-500 text-center leading-relaxed font-medium">
            This dashboard contains real-time systems telemetry, database repair interfaces, and code compilation status. Access is restricted exclusively to VitalSync SaaS Platform Owners.
          </p>

          {errorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3.5 flex items-start gap-2.5">
              <ShieldAlert className="h-4 w-4 text-rose-500 mt-0.5 shrink-0" />
              <span className="text-xs text-rose-600 font-semibold leading-relaxed">{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleAdminSignIn} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                Owner Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@vitalsync.com"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-cyan-500/50 rounded-xl py-3 pl-10 pr-4 text-xs font-semibold outline-none transition-all shadow-inner font-sans"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                Security Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-cyan-500/50 rounded-xl py-3 pl-10 pr-4 text-xs font-semibold outline-none transition-all shadow-inner font-sans"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-cyan-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 font-sans"
            >
              {authLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Authenticate Owner <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
