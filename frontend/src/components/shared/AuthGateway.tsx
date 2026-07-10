import React, { useState, useEffect } from 'react';
import { BrandMark } from './BrandMark';
import { supabase, isMissingEnv } from '../../lib/supabaseClient';
import { 
  Shield, Mail, ArrowRight, Activity, Lock, Eye, EyeOff, Loader2,
  Key, Copy, Check, Sparkles, AlertCircle, X, ArrowLeft, FileText,
  Users
} from 'lucide-react';
import { supabaseCircuit } from '../../services/autoHealerAgent';

interface LoginAttempt {
  email: string;
  timestamp: string;
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
}

interface ErrorDetails {
  code: string;
  message: string;
  description: string;
  diagnostic: string;
}

const ERROR_DICTIONARY: Record<string, ErrorDetails> = {
  ERR_INVALID_CREDENTIALS: {
    code: 'ERR_INVALID_CREDENTIALS',
    message: 'Invalid Credentials',
    description: 'The email address or security password entered does not match any clinician account.',
    diagnostic: 'Double-check email spelling or request a password reset from your system administrator.'
  },
  ERR_RATE_LIMIT_EXCEEDED: {
    code: 'ERR_RATE_LIMIT_EXCEEDED',
    message: 'Rate Limit Exceeded',
    description: 'Too many login attempts. Please try again in 1 minute.',
    diagnostic: 'A maximum of 5 login attempts within a 1-minute time frame is allowed.'
  },
  ERR_ACCOUNT_LOCKED: {
    code: 'ERR_ACCOUNT_LOCKED',
    message: 'Account Lockout Active',
    description: 'This clinician node is temporarily locked due to 5 consecutive failed login attempts. Locked for 30 minutes.',
    diagnostic: 'Wait 30 minutes before trying again, or contact support to manually unlock the account.'
  },
  ERR_NETWORK_FAILURE: {
    code: 'ERR_NETWORK_FAILURE',
    message: 'Network Connectivity Failure',
    description: 'Could not establish connection to the VitalSync clinical authentication servers.',
    diagnostic: 'Verify local internet connection, check DNS resolution, and retry.'
  },
  ERR_SERVER_ERROR: {
    code: 'ERR_SERVER_ERROR',
    message: 'Clinical Pod Server Error',
    description: 'An unexpected exception occurred on the database engine or auth microservice.',
    diagnostic: 'Ensure database migrations have run and Supabase schema is up to date.'
  },
  // Legacy compatibility:
  ERR_AUTH_INVALID_CREDENTIALS: {
    code: 'ERR_AUTH_INVALID_CREDENTIALS',
    message: 'Invalid Credentials',
    description: 'The email address or security password entered does not match any clinician account.',
    diagnostic: 'Double-check email spelling or request a password reset.'
  },
  ERR_AUTH_ACCOUNT_LOCKOUT: {
    code: 'ERR_AUTH_ACCOUNT_LOCKOUT',
    message: 'Account Lockout Active',
    description: 'This clinician node is temporarily locked due to 5 consecutive failed login attempts.',
    diagnostic: 'Wait 60 seconds before trying again.'
  },
  ERR_AUTH_NETWORK_OFFLINE: {
    code: 'ERR_AUTH_NETWORK_OFFLINE',
    message: 'Network Connectivity Failure',
    description: 'Could not establish connection to the VitalSync clinical authentication servers.',
    diagnostic: 'Verify local internet connection.'
  },
  ERR_AUTH_SERVER_ERROR: {
    code: 'ERR_AUTH_SERVER_ERROR',
    message: 'Clinical Pod Server Error',
    description: 'An unexpected exception occurred on the database engine.',
    diagnostic: 'Check server logs.'
  }
};

const getLoginAttempts = (): LoginAttempt[] => {
  try {
    const raw = localStorage.getItem('mediflow_login_attempts');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveLoginAttempt = (attempt: LoginAttempt) => {
  try {
    const attempts = getLoginAttempts();
    attempts.unshift(attempt);
    localStorage.setItem('mediflow_login_attempts', JSON.stringify(attempts.slice(0, 20)));
  } catch (err) {
    console.error('Failed to save login attempt log:', err);
  }
};

const getConsecutiveFailures = (email: string): number => {
  const attempts = getLoginAttempts();
  let count = 0;
  for (const attempt of attempts) {
    if (attempt.email.trim().toLowerCase() === email.trim().toLowerCase()) {
      if (attempt.success) {
        break;
      }
      count++;
    }
  }
  return count;
};

const checkLockout = (email: string): { locked: boolean; remainingSeconds: number } => {
  const failures = getConsecutiveFailures(email);
  if (failures < 5) return { locked: false, remainingSeconds: 0 };
  
  const attempts = getLoginAttempts().filter(a => a.email.trim().toLowerCase() === email.trim().toLowerCase());
  if (attempts.length === 0) return { locked: false, remainingSeconds: 0 };
  
  const lastFailureTime = new Date(attempts[0].timestamp).getTime();
  const now = new Date().getTime();
  const diffSeconds = Math.floor((now - lastFailureTime) / 1000);
  const lockoutPeriod = 60; // 60 seconds
  
  if (diffSeconds < lockoutPeriod) {
    return { locked: true, remainingSeconds: lockoutPeriod - diffSeconds };
  }
  return { locked: false, remainingSeconds: 0 };
};

// Retry mechanism for transient network issues (max 3 retries)
const retryRequest = async <T,>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> => {
  try {
    return await fn();
  } catch (_err) {
    const err = _err as any;
    const isTransient = !navigator.onLine || err.message?.includes('Failed to fetch') || err.message?.includes('network') || err.status === 0;
    if (isTransient && retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryRequest(fn, retries - 1, delay * 2);
    }
    throw err;
  }
};

// Check lockout and rate limit via database sentry
const verifyLoginAllowed = async (emailToVerify: string): Promise<{ allowed: boolean; errorCode?: string; msg?: string }> => {
  try {
    const data = await supabaseCircuit.execute(async () => {
      const { data: res, error } = await retryRequest(async () => {
        return await supabase.rpc('check_login_sentry', {
          p_email: emailToVerify.trim(),
          p_ip: null
        });
      });
      if (error) throw error;
      return res;
    });

    if (data && !data.allowed) {
      return {
        allowed: false,
        errorCode: data.error_code,
        msg: data.message
      };
    }
    return { allowed: true };
  } catch (_err) {
    const err = _err as any;
    console.error('[Mediflow Auth] Sentry check failed or circuit open, falling back to local client-side guard:', err);
    const localLockout = checkLockout(emailToVerify);
    if (localLockout.locked) {
      return {
        allowed: false,
        errorCode: 'ERR_ACCOUNT_LOCKED',
        msg: `This clinician node is temporarily locked due to consecutive failed login attempts. Please try again in ${localLockout.remainingSeconds}s.`
      };
    }
    return { allowed: true };
  }
};

// Log attempt to database audit trail
const logAttemptToDatabase = async (
  attemptEmail: string,
  success: boolean,
  errorCode?: string,
  userId?: string
) => {
  try {
    let resolvedCode = errorCode;
    if (!success && !resolvedCode) {
      resolvedCode = 'ERR_SERVER_ERROR';
    }

    await supabaseCircuit.execute(async () => {
      const { error } = await retryRequest(async () => {
        return await supabase.rpc('log_login_attempt', {
          p_email: attemptEmail.trim(),
          p_ip: null,
          p_user_agent: navigator.userAgent,
          p_status: success ? 'success' : 'failure',
          p_error_code: resolvedCode || null,
          p_user_id: userId || null
        });
      });
      if (error) throw error;
    });
  } catch (err) {
    console.error('[Mediflow Auth] Failed to log login attempt to database or circuit open:', err);
  }
};

interface AuthGatewayProps {
  onAuthSuccess: (session: any, profile: any) => void;
  allowSignup?: boolean;
  initialSignupTab?: 'signin' | 'register' | 'join' | 'ops';
}

const getIsSingleDomain = (hostname: string): boolean => {
  if (hostname === 'localhost' || hostname === '127.0.0.1') return false;
  if (hostname.endsWith('.localhost')) return false;
  if (hostname === 'vitalsync.in' || hostname === 'www.vitalsync.in') return false;
  if (hostname.endsWith('.vitalsync.in')) return false;
  return true;
};

export const AuthGateway: React.FC<AuthGatewayProps> = ({ 
  onAuthSuccess,
  allowSignup = false,
  initialSignupTab = 'signin'
}) => {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isDashboardSubdomain = hostname === 'app.vitalsync.in' || hostname.startsWith('app.');
  const [activeTab, setActiveTab] = useState<'signin' | 'register' | 'join' | 'ops' | 'forgot'>('signin');
  const [joinSubMode, setJoinSubMode] = useState<'signin' | 'register'>('signin');

  // Handle updates to initialSignupTab from LandingPage
  useEffect(() => {
    if (initialSignupTab) {
      setActiveTab(initialSignupTab);
      if (initialSignupTab === 'join') {
        setJoinSubMode('register');
      }
    }
  }, [initialSignupTab]);

  // Gating safety guard: reset signup tabs if allowSignup becomes false
  useEffect(() => {
    if (!allowSignup) {
      if (activeTab === 'register') {
        setActiveTab('signin');
      }
      if (activeTab === 'join' && joinSubMode === 'register') {
        setJoinSubMode('signin');
      }
    }
  }, [activeTab, joinSubMode, allowSignup]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeErrorCode, setActiveErrorCode] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  // New Redesigned Sign-up States
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [registrationStep, setRegistrationStep] = useState(1);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [tosAccepted, setTosAccepted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  // Common Registration states (compat)
  const [displayName, setDisplayName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);

  // Clinic Registration specific states
  const [clinicName, setClinicName] = useState('');
  const [specialization, setSpecialization] = useState('General Medicine');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');

  // Google OAuth Onboarding States
  const [sessionWithNoProfile, setSessionWithNoProfile] = useState<any | null>(null);
  const [oauthOnboardingRole, setOauthOnboardingRole] = useState<'doctor' | 'partner' | null>(null);

  // Partner Join specific states
  const [clinicCode, setClinicCode] = useState('');
  const [partnerType, setPartnerType] = useState<'pharmacy' | 'lab' | 'compounder'>('pharmacy');
  const [validatingCode, setValidatingCode] = useState(false);
  const [validatedClinicName, setValidatedClinicName] = useState<string | null>(null);

  // Clear form errors and states when switching context
  const handleTabSelect = (tab: 'signin' | 'register' | 'join' | 'ops' | 'forgot') => {
    if (!allowSignup && tab === 'register') {
      return;
    }
    setActiveTab(tab);
    setEmail('');
    setPassword('');
    setErrorMsg(null);
    setActiveErrorCode(null);
    setValidationErrors({});
    setRegistrationStep(1);
    setTosAccepted(false);
    setResetSent(false);
  };

  const handleJoinSubModeSelect = (mode: 'signin' | 'register') => {
    if (!allowSignup && mode === 'register') {
      return;
    }
    setJoinSubMode(mode);
    setErrorMsg(null);
    setActiveErrorCode(null);
    setValidationErrors({});
    setRegistrationStep(1);
    setTosAccepted(false);
    setResetSent(false);
  };

  const recordAttempt = (attemptEmail: string, success: boolean, err?: any) => {
    let code: string | undefined = undefined;
    let msg: string | undefined = undefined;

    if (!success && err) {
      msg = err.message || 'Authentication failed';
      if (err.code) {
        code = err.code;
      } else if (!navigator.onLine || err.message?.includes('Failed to fetch') || err.message?.includes('network') || err.status === 0) {
        code = 'ERR_NETWORK_FAILURE';
      } else if (err.message?.includes('lockout') || err.message?.includes('Locked')) {
        code = 'ERR_ACCOUNT_LOCKED';
      } else if (err.message?.includes('Invalid login credentials') || err.message?.includes('not match') || err.message?.includes('Access Denied')) {
        code = 'ERR_INVALID_CREDENTIALS';
      } else {
        code = 'ERR_SERVER_ERROR';
      }
    }

    const newAttempt: LoginAttempt = {
      email: attemptEmail,
      timestamp: new Date().toISOString(),
      success,
      errorCode: code,
      errorMessage: msg
    };

    saveLoginAttempt(newAttempt);
    
    // Log to database asynchronously
    logAttemptToDatabase(attemptEmail, success, code, err?.user_id);

    if (code) {
      setActiveErrorCode(code);
    }
    return code;
  };

  // Success States
  const [registeredClinicCode, setRegisteredClinicCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Pre-seeded Enterprise Demo Roles for E2E testing
  // These IDs must match the auth.users IDs in Supabase (created via migrations)
  const demoUsers = [
    {
      id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101',
      name: 'Dr. Vivek Kumar',
      role: 'doctor',
      entity: 'Kankarbagh Connected Clinic',
      icon: '🏥',
      specialization: 'General Medicine',
      authEmail: 'doctor@mediflow.com'
    },
    {
      id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317102',
      name: 'Lalit Prasad',
      role: 'lab_technician',
      entity: 'Patna Central Pathology Lab',
      icon: '🧪',
      specialization: 'General Medicine',
      authEmail: 'labtech@mediflow.com'
    },
    {
      id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317103',
      name: 'Prakash Yadav',
      role: 'pharmacist',
      entity: 'Kankarbagh Smart Pharmacy',
      icon: '💊',
      specialization: 'General Medicine',
      authEmail: 'pharmacist@mediflow.com'
    },
    {
      id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317104',
      name: 'Dr. Amit Arya',
      role: 'doctor',
      entity: 'Patna Eye Care Center',
      icon: '👁️',
      specialization: 'Ophthalmology',
      authEmail: 'doctor@mediflow.com'
    },
    {
      id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317105',
      name: 'Karan Johar',
      role: 'lab_technician',
      entity: 'Patna Eye Diagnostics',
      icon: '🔬',
      specialization: 'Ophthalmology',
      authEmail: 'labtech@mediflow.com'
    },
    {
      id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317106',
      name: 'Suresh Raina',
      role: 'pharmacist',
      entity: 'Patna Optical Shop',
      icon: '👓',
      specialization: 'Ophthalmology',
      authEmail: 'pharmacist@mediflow.com'
    },
    {
      id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317109',
      name: 'System Admin',
      role: 'platform_admin',
      entity: 'VitalSync HQ Operations',
      icon: '🔑',
      specialization: 'System Engineering',
      authEmail: 'owner@mediflow.com'
    }
  ];
  // Auto-validate Clinic Code in Partner Join flow
  useEffect(() => {
    if (activeTab !== 'join' || clinicCode.length < 7) {
      setValidatedClinicName(null);
      return;
    }

    const validateCode = async () => {
      setValidatingCode(true);
      try {
        let clinicName: string | null = null;

        // 1. Try validation via secure RPC
        const { data: rpcData, error: rpcError } = await supabase.rpc('validate_clinic_code', {
          p_code: clinicCode.trim().toUpperCase()
        });

        if (!rpcError) {
          clinicName = rpcData;
        } else if (rpcError.code === '42883') {
          // If RPC is not deployed yet, fallback to direct query (for local dev transition)
          const { data: tableData } = await supabase
            .from('pods')
            .select('name')
            .eq('clinic_code', clinicCode.trim().toUpperCase())
            .single();
          if (tableData) {
            clinicName = tableData.name;
          }
        }

        setValidatedClinicName(clinicName);
      } catch (err) {
        setValidatedClinicName(null);
      } finally {
        setValidatingCode(false);
      }
    };

    const delayDebounce = setTimeout(() => {
      validateCode();
    }, 500);

    return () => clearTimeout(delayDebounce);
  }, [clinicCode, activeTab]);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined') {
        (window as any).__mediflow_registering = false;
      }
    };
  }, []);

  useEffect(() => {
    if (isMissingEnv) {
      setErrorMsg('VITE_SUPABASE_ANON_KEY environment variable is not configured. Please add it in Vercel settings and trigger a redeploy.');
      setActiveErrorCode('ERR_AUTH_SERVER_ERROR');
    }
  }, []);



  // Check if session exists but profile is missing (Google OAuth redirect landing)
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // Check if profile exists
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          const email = session.user.email;
          const isPlatformAdminEmail = email === 'owner@mediflow.com' || email === 'vivekkumarfbg000@gmail.com';
          const isStaleAdminRole = profile && isPlatformAdminEmail && profile.role !== 'platform_admin';

          if (error || !profile || isStaleAdminRole) {
            // Check if they are platform owners/admins (hardened in RPC)
            if (isPlatformAdminEmail) {
              // Trigger auto-healing reconcile
              try {
                await supabase.rpc('reconcile_profile_role');
                const { data: healedProfile } = await supabase
                  .from('profiles')
                  .select('*')
                  .eq('id', session.user.id)
                  .single();
                if (healedProfile) {
                  onAuthSuccess(session, healedProfile);
                  return;
                }
              } catch (healErr) {
                console.error('[OAuth Onmount] Failed to reconcile platform owner profile:', healErr);
              }
            }

            // Check if there is temporary OAuth onboarding data in sessionStorage
            const tempOnboardingData = sessionStorage.getItem('mediflow_oauth_onboarding_temp');
            if (tempOnboardingData) {
              try {
                const temp = JSON.parse(tempOnboardingData);
                setSessionWithNoProfile(session);
                setOauthOnboardingRole(temp.role || null);
                
                // Pre-fill form fields
                if (temp.role === 'doctor') {
                  setClinicName(temp.clinicName || '');
                  setSpecialization(temp.specialization || 'General Medicine');
                  setAddress(temp.address || '');
                  setPhone(temp.phone || '');
                } else if (temp.role === 'partner') {
                  setClinicCode(temp.clinicCode || '');
                  setPartnerType(temp.partnerType || 'pharmacy');
                  setDisplayName(temp.displayName || '');
                  setPhone(temp.phone || '');
                  setAddress(temp.address || '');
                }
                
                sessionStorage.removeItem('mediflow_oauth_onboarding_temp');
                setLoading(false);
                return;
              } catch (parseErr) {
                console.error('[OAuth Onmount] Failed to parse temp onboarding data:', parseErr);
              }
            }

            // User exists but has no clinical profile in Mediflow database
            // Block sign in, sign them out, and display a registration warning
            try {
              await supabase.auth.signOut();
            } catch (signOutErr) {
              console.error('[OAuth Check] Failed to sign out invalid OAuth user:', signOutErr);
            }
            setErrorMsg('No Mediflow account found for this Google email. Please register your clinic or partner account manually first.');
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('[OAuth Onmount] Session check failed:', err);
      }
    };
    checkSession();
  }, [onAuthSuccess]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // Save any partial signup input to sessionStorage so we can pre-fill it when we return
      if (activeTab === 'register') {
        sessionStorage.setItem('mediflow_oauth_onboarding_temp', JSON.stringify({
          role: 'doctor',
          clinicName,
          specialization,
          address,
          phone
        }));
      } else if (activeTab === 'join' && joinSubMode === 'register') {
        sessionStorage.setItem('mediflow_oauth_onboarding_temp', JSON.stringify({
          role: 'partner',
          clinicCode,
          partnerType,
          displayName: `${firstName} ${lastName}`.trim(),
          phone,
          address
        }));
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (_err) {
      const err = _err as any;
      console.error('[Mediflow Auth] Google Sign-In failed:', err);
      setErrorMsg(err.message || 'Failed to authenticate with Google. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthRegisterClinic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionWithNoProfile) return;
    if (!clinicName || !phone || !address) {
      setErrorMsg('Please fill in all clinic fields.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);

    try {
      // 1. Call register_clinic_network RPC function
      const { data: rpcData, error: rpcError } = await supabase.rpc('register_clinic_network', {
        p_clinic_name: clinicName.trim(),
        p_clinic_phone: phone.trim(),
        p_clinic_address: address.trim(),
        p_specialization: specialization
      });

      if (rpcError) throw rpcError;

      // 2. Clear the pending registration flag
      await supabase.auth.updateUser({
        data: { pending_registration: false }
      });

      // 3. Wait a split second and fetch profile
      await new Promise(resolve => setTimeout(resolve, 800));
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sessionWithNoProfile.user.id)
        .single();

      if (profileErr || !profile) {
        throw new Error('Clinic registered successfully, but we could not load your user profile.');
      }

      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Clinic Registered successfully! 🎉',
          message: 'Welcome to Mediflow Care Console.',
          type: 'success'
        }
      }));

      onAuthSuccess(sessionWithNoProfile, profile);
    } catch (_err) { // Force rebuild of AuthGateway to clear compiler error
      const err = _err as any;
      console.error('[OAuth Onboarding] Register Clinic failed:', err);
      setErrorMsg(err.message || 'Onboarding failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthJoinClinic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionWithNoProfile) return;
    if (!clinicCode || !phone || !displayName || !address) {
      setErrorMsg('Please fill in all partner fields.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);

    try {
      // 1. Call join_clinic_network RPC function
      const { error: rpcError } = await supabase.rpc('join_clinic_network', {
        p_clinic_code: clinicCode.trim().toUpperCase(),
        p_partner_type: partnerType,
        p_partner_name: displayName.trim(),
        p_partner_phone: phone.trim(),
        p_partner_address: address.trim()
      });

      if (rpcError) throw rpcError;

      // 2. Clear the pending registration flag
      await supabase.auth.updateUser({
        data: { pending_registration: false }
      });

      // 3. Wait a split second and fetch profile
      await new Promise(resolve => setTimeout(resolve, 800));
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sessionWithNoProfile.user.id)
        .single();

      if (profileErr || !profile) {
        throw new Error('Joined clinic successfully, but we could not load your user profile.');
      }

      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Join Request Submitted! 🎉',
          message: 'Welcome to Mediflow. Please request your doctor to approve your profile.',
          type: 'success'
        }
      }));

      onAuthSuccess(sessionWithNoProfile, profile);
    } catch (_err) {
      const err = _err as any;
      console.error('[OAuth Onboarding] Join Clinic failed:', err);
      setErrorMsg(err.message || 'Onboarding failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut({ scope: 'local' });
      setSessionWithNoProfile(null);
      setOauthOnboardingRole(null);
    } catch (err) {
      console.error('[OAuth Onboarding] Sign out failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setErrorMsg(null);
    setActiveErrorCode(null);

    // Global 20-second watchdog: if ANY part of this handler hangs (network freeze,
    // sentry RPC timeout, Supabase auth slow response), force the spinner off so the
    // user isn't stuck with an infinite loader.
    const handlerTimeout = setTimeout(() => {
      setLoading(false);
      setErrorMsg('Login is taking longer than expected. Please check your internet connection and try again.');
      setActiveErrorCode('ERR_NETWORK_FAILURE');
    }, 20000);

    try {
      // 1. Verify lockout and rate limit via database sentry (with 5s timeout fallback)
      let check: { allowed: boolean; errorCode?: string; msg?: string } = { allowed: true };
      try {
        const sentryTimeout = new Promise<{ allowed: boolean }>((resolve) =>
          setTimeout(() => resolve({ allowed: true }), 5000) // silent pass-through on timeout
        );
        check = await Promise.race([verifyLoginAllowed(email), sentryTimeout]);
      } catch {
        // If sentry check fails entirely, allow login to proceed (don't block on infra issue)
        check = { allowed: true };
      }

      if (!check.allowed) {
        setErrorMsg(check.msg || 'Login is temporarily blocked.');
        if (check.errorCode) {
          setActiveErrorCode(check.errorCode);
          await logAttemptToDatabase(email, false, check.errorCode);
        }
        setLoading(false);
        return;
      }

      // 2. Perform authentication with a 15s timeout to prevent infinite loading
      const signInPromise = supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      const signInTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(Object.assign(new Error('Authentication request timed out. Please check your connection.'), { code: 'ERR_NETWORK_FAILURE' })), 15000)
      );

      const { data, error } = await Promise.race([signInPromise, signInTimeout]) as any;

      if (error) {
        if (error.message?.includes('Invalid login credentials')) {
          const authErr = new Error('Invalid email or password.');
          (authErr as any).code = 'ERR_INVALID_CREDENTIALS';
          throw authErr;
        }
        throw error;
      }

      if (!data?.session) {
        throw new Error('Sign in succeeded but no session was returned. Please try again.');
      }

      // 3. Verify profile and role
      const { data: profileData, error: profileErr } = await retryRequest(async () => {
        return await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();
      });
      let profile = profileData;

      if (profileErr || !profile) {
        const jwtRole = data.user?.user_metadata?.role || data.user?.app_metadata?.role;
        if (jwtRole === 'doctor' || jwtRole === 'admin' || jwtRole === 'platform_admin') {
          console.log('[Mediflow Auth] No DB profile — synthesizing from JWT metadata.');
          profile = {
            id: data.user.id,
            role: jwtRole,
            display_name: data.user?.user_metadata?.display_name || data.user?.email?.split('@')[0] || 'Clinician',
            email: data.user.email,
          };
        } else {
          throw new Error(profileErr?.message || 'Authenticated, but your Mediflow profile could not be loaded.');
        }
      }

      if (!['doctor', 'admin', 'platform_admin'].includes(profile.role)) {
        await supabase.auth.signOut({ scope: 'local' });
        const accessErr = new Error('Access Denied: Restricted to Doctors and Platform Admin.');
        (accessErr as any).code = 'ERR_INVALID_CREDENTIALS';
        throw accessErr;
      }

      // Cross-origin guard: admin accounts must ONLY authenticate on admin.vitalsync.in.
      // If an admin logs in on vitalsync.in / app.vitalsync.in, the session is stored in
      // that origin's localStorage and will be invisible to admin.vitalsync.in.
      if (profile?.role === 'admin' || profile?.role === 'platform_admin') {
        const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
        const isSingleDomain = getIsSingleDomain(hostname);
        const isAdminSubdomain = hostname === 'admin.vitalsync.in' || hostname.startsWith('admin.') || isSingleDomain;
        if (!isAdminSubdomain) {
          await supabase.auth.signOut({ scope: 'local' });
          const adminUrl = hostname === 'localhost' || hostname === '127.0.0.1'
            ? `http://admin.localhost:${window.location.port || '5173'}`
            : 'https://admin.vitalsync.in';
          console.log('[Mediflow Auth] Admin account detected on wrong origin. Redirecting to:', adminUrl);
          window.location.href = adminUrl;
          return;
        }
      }

      // Record successful attempt
      recordAttempt(email, true, { user_id: data.user.id });
      
      // Dispatch toast manually on login success
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Professional Portal Initialized',
          message: `Successfully authenticated as ${profile.display_name}. Role: ${profile.role.toUpperCase()}`,
          type: 'success'
        }
      }));
    } catch (_err) {
      const err = _err as any;
      console.error('[Mediflow Auth] Login failed:', err);
      let mappedCode = err.code;
      if (!mappedCode) {
        if (!navigator.onLine || err.message?.includes('Failed to fetch') || err.message?.includes('network') || err.status === 0 || err.message?.includes('timed out')) {
          mappedCode = 'ERR_NETWORK_FAILURE';
        } else if (err.message?.includes('Invalid login credentials') || err.message?.includes('invalid') || err.status === 400) {
          mappedCode = 'ERR_INVALID_CREDENTIALS';
        } else {
          mappedCode = 'ERR_SERVER_ERROR';
        }
      }

      recordAttempt(email, false, { ...err, code: mappedCode });

      if (mappedCode && ERROR_DICTIONARY[mappedCode]) {
        setErrorMsg(ERROR_DICTIONARY[mappedCode].description);
        setActiveErrorCode(mappedCode);
      } else {
        setErrorMsg(err.message || 'Authentication failed. Please verify credentials.');
      }
    } finally {
      clearTimeout(handlerTimeout);
      if (typeof window !== 'undefined') {
        (window as any).__mediflow_registering = false;
      }
      setLoading(false);
    }
  };

  const handlePartnerSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setErrorMsg(null);
    setActiveErrorCode(null);

    // Global 20-second watchdog for partner sign-in
    const handlerTimeout = setTimeout(() => {
      setLoading(false);
      setErrorMsg('Login is taking longer than expected. Please check your internet connection and try again.');
      setActiveErrorCode('ERR_NETWORK_FAILURE');
    }, 20000);

    try {
      // 1. Verify lockout and rate limit via database sentry (with 5s timeout fallback)
      let check: { allowed: boolean; errorCode?: string; msg?: string } = { allowed: true };
      try {
        const sentryTimeout = new Promise<{ allowed: boolean }>((resolve) =>
          setTimeout(() => resolve({ allowed: true }), 5000)
        );
        check = await Promise.race([verifyLoginAllowed(email), sentryTimeout]);
      } catch {
        check = { allowed: true };
      }

      if (!check.allowed) {
        setErrorMsg(check.msg || 'Login is temporarily blocked.');
        if (check.errorCode) {
          setActiveErrorCode(check.errorCode);
          await logAttemptToDatabase(email, false, check.errorCode);
        }
        setLoading(false);
        return;
      }

      // 2. Perform authentication with 15s timeout
      const signInPromise = supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      const signInTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(Object.assign(new Error('Authentication request timed out. Please check your connection.'), { code: 'ERR_NETWORK_FAILURE' })), 15000)
      );

      const { data, error } = await Promise.race([signInPromise, signInTimeout]) as any;

      if (error) {
        if (error.message?.includes('Invalid login credentials')) {
          const authErr = new Error('Invalid email or password.');
          (authErr as any).code = 'ERR_INVALID_CREDENTIALS';
          throw authErr;
        }
        throw error;
      }

      if (!data?.session) {
        throw new Error('Sign in succeeded but no session was returned. Please try again.');
      }

      // 3. Verify profile and role
      const { data: profile, error: profileErr } = await retryRequest(async () => {
        return await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();
      });

      if (profileErr || !profile) {
        throw new Error('Authenticated, but your Mediflow profile could not be loaded.');
      }

      if (!['pharmacist', 'lab_technician', 'compounder'].includes(profile.role)) {
        await supabase.auth.signOut({ scope: 'local' });
        const accessErr = new Error('Access Denied: This account is not registered as a partner.');
        (accessErr as any).code = 'ERR_INVALID_CREDENTIALS';
        throw accessErr;
      }

      recordAttempt(email, true, { user_id: data.user.id });
      
      // Dispatch toast manually on login success
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Professional Portal Initialized',
          message: `Successfully authenticated as ${profile.display_name}. Role: ${profile.role.toUpperCase()}`,
          type: 'success'
        }
      }));
    } catch (_err) {
      const err = _err as any;
      console.error('[Mediflow Auth] Partner login failed:', err);
      let mappedCode = err.code;
      if (!mappedCode) {
        if (!navigator.onLine || err.message?.includes('Failed to fetch') || err.message?.includes('network') || err.status === 0 || err.message?.includes('timed out')) {
          mappedCode = 'ERR_NETWORK_FAILURE';
        } else if (err.message?.includes('Invalid login credentials') || err.message?.includes('invalid') || err.status === 400) {
          mappedCode = 'ERR_INVALID_CREDENTIALS';
        } else {
          mappedCode = 'ERR_SERVER_ERROR';
        }
      }

      recordAttempt(email, false, { ...err, code: mappedCode });

      if (mappedCode && ERROR_DICTIONARY[mappedCode]) {
        setErrorMsg(ERROR_DICTIONARY[mappedCode].description);
        setActiveErrorCode(mappedCode);
      } else {
        setErrorMsg(err.message || 'Authentication failed. Please check your credentials.');
      }
    } finally {
      clearTimeout(handlerTimeout);
      if (typeof window !== 'undefined') {
        (window as any).__mediflow_registering = false;
      }
      setLoading(false);
    }
  };

  const validateStep1 = () => {
    const errors: Record<string, string> = {};
    
    if (!firstName.trim()) {
      errors.firstName = 'First name is required';
    } else if (firstName.trim().length < 2) {
      errors.firstName = 'Must be at least 2 characters';
    }

    if (!lastName.trim()) {
      errors.lastName = 'Last name is required';
    } else if (lastName.trim().length < 2) {
      errors.lastName = 'Must be at least 2 characters';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      errors.email = 'Email address is required';
    } else if (!emailRegex.test(email.trim())) {
      errors.email = 'Enter a valid email address';
    }

    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 6) {
      errors.password = 'Must be at least 6 characters';
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Confirmation is required';
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    if (!tosAccepted) {
      errors.tos = 'You must accept the Terms and Privacy Policy';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateDoctorStep2 = () => {
    const errors: Record<string, string> = {};
    
    if (!clinicName.trim()) {
      errors.clinicName = 'Clinic business name is required';
    }
    
    if (!phone.trim()) {
      errors.phone = 'Phone number is required';
    } else if (!/^\d{10,}$/.test(phone.trim().replace(/[-+() ]/g, ''))) {
      errors.phone = 'Enter a valid phone number (at least 10 digits)';
    }

    if (!address.trim()) {
      errors.address = 'Clinic physical address is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleClinicRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateDoctorStep2()) {
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    if (typeof window !== 'undefined') {
      (window as any).__mediflow_registering = true;
    }

    const finalDisplayName = `${firstName.trim()} ${lastName.trim()}`;

    try {
      // 1. Perform auth signUp with timeout protection
      const signUpPromise = supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            display_name: finalDisplayName,
            role: 'doctor',
            clinic_name: clinicName.trim(),
            clinic_phone: phone.trim(),
            clinic_address: address.trim(),
            specialization: specialization,
            pending_registration: true
          }
        }
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Network request timed out. Please check your connectivity and try again.')), 12000)
      );

      const { data: authData, error: authError } = await Promise.race([signUpPromise, timeoutPromise]) as any;

      if (authError) {
        if (authError.message?.toLowerCase().includes('already registered') || authError.message?.toLowerCase().includes('use')) {
          throw new Error('This email address is already in use. If you already have an account, please sign in.');
        }
        throw authError;
      }
      if (!authData?.user || !authData.session) {
        throw new Error('SignUp completed, but email confirmation is required. Please check your email or verify auth configs.');
      }

      // 2. Wait a split second to allow on_auth_user_created trigger to run
      await new Promise(resolve => setTimeout(resolve, 800));

      // 3. Call the register_clinic_network RPC function
      const { data: rpcData, error: rpcError } = await supabase.rpc('register_clinic_network', {
        p_clinic_name: clinicName.trim(),
        p_clinic_phone: phone.trim(),
        p_clinic_address: address.trim(),
        p_specialization: specialization
      });

      if (rpcError) throw rpcError;

      // Clear the pending registration flag since we successfully onboarding synchronously
      await supabase.auth.updateUser({
        data: { pending_registration: false }
      });

      // 4. Show registration success screen with generated clinic code!
      const generatedCode = Array.isArray(rpcData) ? rpcData[0]?.clinic_code : rpcData?.clinic_code;
      setRegisteredClinicCode(generatedCode);
      if (typeof window !== 'undefined') {
        (window as any).__mediflow_registering = false;
      }

      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Clinic Registered successfully! 🎉',
          message: `Welcome ${finalDisplayName}! Your clinical network code is active.`,
          type: 'success'
        }
      }));

    } catch (_err) {
      const err = _err as any;
      if (typeof window !== 'undefined') {
        (window as any).__mediflow_registering = false;
      }
      console.error('[Mediflow Auth] Clinic registration failed:', err);
      setErrorMsg(err.message || 'Clinic registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const validatePartnerStep2 = () => {
    const errors: Record<string, string> = {};
    
    if (!clinicCode.trim()) {
      errors.clinicCode = 'Clinic network code is required';
    } else if (!validatedClinicName) {
      errors.clinicCode = 'A valid clinic network code is required';
    }

    if (!displayName.trim()) {
      errors.displayName = 'Business name is required';
    }

    if (!phone.trim()) {
      errors.phone = 'Phone number is required';
    } else if (!/^\d{10,}$/.test(phone.trim().replace(/[-+() ]/g, ''))) {
      errors.phone = 'Enter a valid phone number (at least 10 digits)';
    }

    if (!address.trim()) {
      errors.address = 'Physical address is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handlePartnerJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validatePartnerStep2()) {
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    if (typeof window !== 'undefined') {
      (window as any).__mediflow_registering = true;
    }

    const finalDisplayName = `${firstName.trim()} ${lastName.trim()}`;

    try {
      // 1. Perform auth signUp with timeout
      const userRole = partnerType === 'pharmacy' ? 'pharmacist' : partnerType === 'lab' ? 'lab_technician' : 'compounder';
      
      const signUpPromise = supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            display_name: finalDisplayName,
            role: userRole,
            clinic_code: clinicCode.trim().toUpperCase(),
            partner_type: partnerType,
            partner_phone: phone.trim(),
            partner_address: address.trim(),
            pending_registration: true
          }
        }
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Network request timed out. Please check your connectivity and try again.')), 12000)
      );

      const { data: authData, error: authError } = await Promise.race([signUpPromise, timeoutPromise]) as any;

      if (authError) {
        if (authError.message?.toLowerCase().includes('already registered') || authError.message?.toLowerCase().includes('use')) {
          throw new Error('This email address is already in use. If you already have an account, please sign in.');
        }
        throw authError;
      }
      if (!authData?.user || !authData.session) {
        throw new Error('SignUp completed, but email confirmation is required. Please check your email.');
      }

      // 2. Wait a split second to allow handle_new_user trigger to execute
      await new Promise(resolve => setTimeout(resolve, 800));

      // 3. Call the join_clinic_network RPC function
      const { error: rpcError } = await supabase.rpc('join_clinic_network', {
        p_clinic_code: clinicCode.trim().toUpperCase(),
        p_partner_type: partnerType,
        p_partner_name: displayName.trim(),
        p_partner_phone: phone.trim(),
        p_partner_address: address.trim()
      });

      if (rpcError) throw rpcError;

      // Clear the pending registration flag since we successfully onboarding synchronously
      await supabase.auth.updateUser({
        data: { pending_registration: false }
      });

      // 4. Fetch profile to pass to Auth success
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (profileErr) throw profileErr;

      if (typeof window !== 'undefined') {
        (window as any).__mediflow_registering = false;
      }

      // 5. Notify app of authentication success!
      onAuthSuccess(authData.session, profile);

      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Join Request Submitted! ⏳',
          message: 'Your registration was successful. Waiting for doctor approval.',
          type: 'success'
        }
      }));

    } catch (_err) {
      const err = _err as any;
      if (typeof window !== 'undefined') {
        (window as any).__mediflow_registering = false;
      }
      console.error('[Mediflow Auth] Partner join failed:', err);
      setErrorMsg(err.message || 'Partner registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpsSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setErrorMsg(null);
    setActiveErrorCode(null);

    try {
      // 1. Verify lockout and rate limit via database sentry
      const check = await verifyLoginAllowed(email);
      if (!check.allowed) {
        setErrorMsg(check.msg || 'Login is temporarily blocked.');
        if (check.errorCode) {
          setActiveErrorCode(check.errorCode);
          // Log the blocked attempt to database
          await logAttemptToDatabase(email, false, check.errorCode);
        }
        setLoading(false);
        return;
      }

      // 2. Perform authentication with retry mechanism (up to 3 retries for transient issues)
      const { data, error } = await retryRequest(async () => {
        return await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
      });

      if (error) {
        if (error.message?.includes('Invalid login credentials')) {
          const authErr = new Error('Invalid email or password.');
          (authErr as any).code = 'ERR_INVALID_CREDENTIALS';
          throw authErr;
        }
        throw error;
      }

      if (!data?.session || !data?.user) {
        throw new Error('Sign in succeeded but no session was returned. Please try again.');
      }

      // 3. Verify profile exists and is admin
      const { data: profileData, error: profileErr } = await retryRequest(async () => {
        return await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();
      });
      let profile = profileData;

      if (profileErr || !profile) {
        const jwtRole = data.user?.user_metadata?.role || data.user?.app_metadata?.role;
        if (jwtRole === 'admin' || jwtRole === 'platform_admin') {
          console.log('[Mediflow Auth] No DB profile for ops user — synthesizing from JWT metadata.');
          profile = {
            id: data.user.id,
            role: jwtRole,
            display_name: data.user?.user_metadata?.display_name || data.user?.email?.split('@')[0] || 'Admin',
            email: data.user.email,
          };
        } else {
          throw new Error(profileErr?.message || 'Authenticated, but your Mediflow profile could not be loaded.');
        }
      }
      
      if (profile?.role === 'doctor' || profile?.role === 'admin' || profile?.role === 'platform_admin') {
        // Role verified
      } else {
        await supabase.auth.signOut({ scope: 'local' });
        const accessErr = new Error('Access Denied: Restricted to Doctors and Platform Admin.');
        (accessErr as any).code = 'ERR_INVALID_CREDENTIALS';
        throw accessErr;
      }

      // Cross-origin guard: admin accounts must ONLY authenticate on admin.vitalsync.in.
      // If an admin logs in on vitalsync.in / app.vitalsync.in, the session is stored in
      // that origin's localStorage and will be invisible to admin.vitalsync.in.
      // Sign out here and redirect so they can log in on the correct origin.
      if (profile?.role === 'admin' || profile?.role === 'platform_admin') {
        const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
        const isSingleDomain = getIsSingleDomain(hostname);
        const isAdminSubdomain = hostname === 'admin.vitalsync.in' || hostname.startsWith('admin.') || isSingleDomain;
        if (!isAdminSubdomain) {
          await supabase.auth.signOut({ scope: 'local' });
          const adminUrl = hostname === 'localhost' || hostname === '127.0.0.1'
            ? `http://admin.localhost:${window.location.port || '5173'}`
            : 'https://admin.vitalsync.in';
          console.log('[Mediflow Auth] Admin account detected on wrong origin. Redirecting to:', adminUrl);
          window.location.href = adminUrl;
          return;
        }
      }

      recordAttempt(email, true, { user_id: data.user.id });
      
      // Dispatch toast manually on login success
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Professional Portal Initialized',
          message: `Successfully authenticated as ${profile.display_name}. Role: ${profile.role.toUpperCase()}`,
          type: 'success'
        }
      }));
    } catch (_err) {
      const err = _err as any;
      console.error('[Mediflow Auth] Ops login failed:', err);
      let mappedCode = err.code;
      if (!mappedCode) {
        if (!navigator.onLine || err.message?.includes('Failed to fetch') || err.message?.includes('network') || err.status === 0) {
          mappedCode = 'ERR_NETWORK_FAILURE';
        } else if (err.message?.includes('Invalid login credentials') || err.message?.includes('invalid') || err.status === 400) {
          mappedCode = 'ERR_INVALID_CREDENTIALS';
        } else {
          mappedCode = 'ERR_SERVER_ERROR';
        }
      }

      recordAttempt(email, false, { ...err, code: mappedCode });

      if (mappedCode && ERROR_DICTIONARY[mappedCode]) {
        setErrorMsg(ERROR_DICTIONARY[mappedCode].description);
        setActiveErrorCode(mappedCode);
      } else {
        setErrorMsg(err.message || 'Authentication failed. Please verify credentials.');
      }
    } finally {
      if (typeof window !== 'undefined') {
        (window as any).__mediflow_registering = false;
      }
      setLoading(false);
    }
  };

  const handleDemoSignIn = async (user: typeof demoUsers[0]) => {
    // DEV-ONLY guard: demo auto-login is stripped from the production build.
    if (!import.meta.env.DEV) {
      setErrorMsg('Demo sign-in is only available in development mode. Please use your real credentials.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setActiveErrorCode(null);
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line react-hooks/immutability
      (window as any).__mediflow_registering = true;
    }
    try {
      const authEmail = user.authEmail;
      const demoPassword = import.meta.env.VITE_DEMO_PASSWORD || 'password123';

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: demoPassword
      });

      if (authError) {
        // If user doesn't exist, provide helpful error message
        if (authError.message.includes('Invalid login credentials') || authError.message.includes('Email not confirmed')) {
          throw new Error(`Demo user ${authEmail} not found in Supabase Auth. Please run the seed migrations or create the user in Supabase Dashboard.`);
        }
        throw authError;
      }

      if (!authData?.session || !authData?.user) {
        throw new Error('Sign in succeeded but no session was returned.');
      }


      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileErr || !profile) {
        throw new Error('Authenticated, but profile could not be loaded. Ensure database migrations have run.');
      }

      // Inject custom mock details for specialized clinic roles to enable correct nomenclature
      const modifiedProfile = {
        ...profile,
        display_name: user.name,
        user_metadata: {
          ...profile?.user_metadata,
          specialization: user.specialization,
          clinic_name: user.entity,
          display_name: user.name
        },
        raw_user_meta_data: {
          ...profile?.raw_user_meta_data,
          specialization: user.specialization,
          clinic_name: user.entity,
          display_name: user.name
        }
      };

      // Record successful attempt
      recordAttempt(authEmail, true);
      
      // Dispatch toast manually on login success
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Professional Portal Initialized',
          message: `Successfully authenticated as ${modifiedProfile.display_name}. Role: ${modifiedProfile.role.toUpperCase()}`,
          type: 'success'
        }
      }));
    } catch (_err) {
      const err = _err as any;
      console.error('[Mediflow Auth] Demo login failed:', err);
      const code = recordAttempt(user.authEmail, false, err);
      if (code && ERROR_DICTIONARY[code]) {
        setErrorMsg(ERROR_DICTIONARY[code].description);
      } else {
        setErrorMsg(err.message || 'Demo profile loading failed.');
      }
    } finally {
      if (typeof window !== 'undefined') {
        (window as any).__mediflow_registering = false;
      }
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setErrorMsg(null);
    try {
      const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
      const isSingleDomain = getIsSingleDomain(hostname);
      const redirectUrl = isSingleDomain
        ? window.location.origin
        : (hostname === 'localhost' || hostname === '127.0.0.1'
          ? `http://app.localhost:${window.location.port || '5173'}`
          : 'https://app.vitalsync.in');

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${redirectUrl}?recovery=true`
      });

      if (error) throw error;

      setResetSent(true);
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Reset Link Sent! ✉️',
          message: `Check your email inbox at ${email} to reset your password.`,
          type: 'success'
        }
      }));
    } catch (_err) {
      const err = _err as any;
      console.error('[Mediflow Auth] Password reset request failed:', err);
      setErrorMsg(err.message || 'Failed to send password reset email.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (!registeredClinicCode) return;
    navigator.clipboard.writeText(registeredClinicCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: '', color: 'bg-transparent', width: 'w-0' };
    if (pass.length < 6) return { score: 1, label: 'Weak', color: 'bg-rose-500', width: 'w-1/3' };
    const hasNum = /[0-9]/.test(pass);
    const hasSpecial = /[^A-Za-z0-9]/.test(pass);
    const hasUpper = /[A-Z]/.test(pass);
    if (pass.length >= 8 && hasNum && hasSpecial && hasUpper) {
      return { score: 3, label: 'Clinical Grade', color: 'bg-emerald-500', width: 'w-full' };
    }
    return { score: 2, label: 'Medium', color: 'bg-amber-500', width: 'w-2/3' };
  };

  const pwdStrength = getPasswordStrength(password);
  if (registeredClinicCode) {
    return (
      <div className="w-full flex flex-col space-y-5 animate-fade-in">
        <div className="flex flex-col space-y-5 text-center">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Sparkles className="h-6 w-6 text-cyan-500 animate-pulse-subtle" />
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-extrabold text-slate-900">Clinic Registered!</h3>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Your clinic node is now live. Share the unique code below with your partner pharmacy and lab.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-sm">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">
              Unique Clinic Network Code
            </span>
            <div className="flex items-center justify-center gap-3">
              <span className="text-2xl font-black tracking-wider text-slate-800 font-mono bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
                {registeredClinicCode}
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="p-2.5 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 text-cyan-600 rounded-xl transition-all hover:scale-105 cursor-pointer"
                title="Copy Clinic Code"
              >
                {copiedCode ? <Check className="h-4.5 w-4.5 text-emerald-600" /> : <Copy className="h-4.5 w-4.5" />}
              </button>
            </div>
            {copiedCode && <span className="text-[10px] text-emerald-600 font-bold block animate-fade-in">Copied to clipboard!</span>}
          </div>

          <div className="text-left bg-cyan-50 border border-cyan-200 rounded-xl p-3.5 space-y-2">
            <h4 className="text-[10px] font-bold text-cyan-600 flex items-center gap-2 uppercase tracking-wider">
              <Shield className="h-3.5 w-3.5" /> Next Steps:
            </h4>
            <ul className="text-[10px] text-slate-600 space-y-1 list-decimal list-inside pl-1 leading-relaxed font-medium">
              <li>Copy the unique code above</li>
              <li>Share it with your partner Pharmacy and Lab staff</li>
              <li>When they register using this code, approve their requests in your clinic dashboard settings</li>
              <li>Your unified care loop will link together immediately</li>
            </ul>
          </div>

          <button
            type="button"
            onClick={async () => {
              if (typeof window !== 'undefined') {
                (window as any).__mediflow_registering = false;
              }
              const { data: { session } } = await supabase.auth.getSession();
              if (session?.user) {
                const { data: profile } = await supabase
                  .from('profiles')
                  .select('*')
                  .eq('id', session.user.id)
                  .single();
                if (profile) onAuthSuccess(session, profile);
              }
            }}
            className="w-full py-3 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-750 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer font-sans"
          >
            Enter Doctor Dashboard <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  if (sessionWithNoProfile) {
    return (
      <div className="w-full flex flex-col space-y-5 relative animate-fade-in text-slate-800">
        {/* Background Neon Glow Orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-cyan-500/5 blur-[120px] pointer-events-none animate-pulse-subtle"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none animate-pulse-subtle" style={{ animationDelay: '2s' }}></div>

        <div className="z-10 flex flex-col space-y-6">
          <div className="text-center space-y-2">
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Complete Your Profile</h3>
            <p className="text-xs text-slate-500 font-medium">
              Signed in as <span className="font-bold text-slate-700">{sessionWithNoProfile.user?.email}</span>
            </p>
          </div>

          {errorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3.5 flex items-start gap-3">
              <Shield className="h-5 w-5 text-rose-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs font-semibold text-rose-300 leading-relaxed">{errorMsg}</div>
            </div>
          )}

          {!oauthOnboardingRole ? (
            <div className="space-y-4">
              <p className="text-xs font-medium text-slate-500 text-center pb-2">
                Choose your role to finish setting up your account:
              </p>
              
              <div className="grid grid-cols-1 gap-3">
                <button
                  type="button"
                  onClick={() => setOauthOnboardingRole('doctor')}
                  className="p-5 bg-white border border-slate-200 hover:border-indigo-500 hover:shadow-md rounded-2xl transition-all text-left flex items-start gap-4 group cursor-pointer"
                >
                  <span className="p-3 bg-indigo-50 text-indigo-650 rounded-xl text-xl group-hover:scale-110 transition-transform">🩺</span>
                  <div className="space-y-1">
                    <h4 className="font-bold text-sm text-slate-900 group-hover:text-indigo-600 transition-colors">I am a Doctor / Clinic Manager</h4>
                    <p className="text-[11px] text-slate-500 font-medium">Create a new clinic network node and consult patients.</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setOauthOnboardingRole('partner')}
                  className="p-5 bg-white border border-slate-200 hover:border-cyan-500 hover:shadow-md rounded-2xl transition-all text-left flex items-start gap-4 group cursor-pointer"
                >
                  <span className="p-3 bg-cyan-50 text-cyan-600 rounded-xl text-xl group-hover:scale-110 transition-transform">🔬</span>
                  <div className="space-y-1">
                    <h4 className="font-bold text-sm text-slate-900 group-hover:text-cyan-600 transition-colors">I am a Partner (Pharmacy / Lab)</h4>
                    <p className="text-[11px] text-slate-500 font-medium">Join an existing clinic network node using a clinic code.</p>
                  </div>
                </button>
              </div>

              <button
                type="button"
                onClick={handleOAuthSignOut}
                disabled={loading}
                className="w-full mt-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                Sign Out / Cancel
              </button>
            </div>
          ) : oauthOnboardingRole === 'doctor' ? (
            <form onSubmit={handleOAuthRegisterClinic} className="space-y-4">
              <div className="flex items-center justify-between pb-2">
                <button
                  type="button"
                  onClick={() => { setOauthOnboardingRole(null); setErrorMsg(null); }}
                  className="text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-indigo-600 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="h-3 w-3" /> Back
                </button>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Doctor Onboarding</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                  Clinic Network Name
                </label>
                <input
                  type="text"
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  placeholder="e.g. Apex Health Clinic"
                  className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-3.5 px-4 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all duration-300 shadow-sm font-medium font-sans"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                  Primary Specialization
                </label>
                <select
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-3.5 px-4 text-sm text-slate-850 outline-none transition-all duration-300 shadow-sm font-medium font-sans"
                >
                  <option value="General Medicine">General Medicine</option>
                  <option value="Pediatrics">Pediatrics</option>
                  <option value="Ophthalmology">Ophthalmology</option>
                  <option value="Cardiology">Cardiology</option>
                  <option value="Dermatology">Dermatology</option>
                  <option value="Internal Medicine">Internal Medicine</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                  Contact Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="10-digit mobile number"
                  className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-3.5 px-4 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all duration-300 shadow-sm font-medium font-sans"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                  Clinic Physical Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street address, city"
                  className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-3.5 px-4 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all duration-300 shadow-sm font-medium font-sans"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-cyan-600 to-indigo-650 hover:from-cyan-500 hover:to-indigo-550 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-cyan-500/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 font-sans"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Create Clinic Network <ArrowRight className="h-4 w-4" /></>}
              </button>
            </form>
          ) : (
            <form onSubmit={handleOAuthJoinClinic} className="space-y-4">
              <div className="flex items-center justify-between pb-2">
                <button
                  type="button"
                  onClick={() => { setOauthOnboardingRole(null); setErrorMsg(null); }}
                  className="text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-cyan-600 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="h-3 w-3" /> Back
                </button>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Partner Onboarding</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                  Clinic Network Code (Required)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={clinicCode}
                    onChange={(e) => setClinicCode(e.target.value)}
                    placeholder="e.g. MF-0001"
                    className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-3.5 px-4 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all duration-300 shadow-sm font-medium font-sans uppercase"
                    required
                  />
                  {validatingCode && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />}
                </div>
                {validatedClinicName && (
                  <div className="text-[10px] text-emerald-600 font-bold pl-1 flex items-center gap-1">
                    ✓ Connected to: {validatedClinicName}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                  Partner Entity Type
                </label>
                <select
                  value={partnerType}
                  onChange={(e) => setPartnerType(e.target.value as any)}
                  className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-3.5 px-4 text-sm text-slate-850 outline-none transition-all duration-300 shadow-sm font-medium font-sans"
                >
                  <option value="pharmacy">Pharmacy Shop</option>
                  <option value="lab">Diagnostics Lab</option>
                  <option value="compounder">Clinical Compounder / Nurse</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                  Your Full Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Ramesh Patel"
                  className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-3.5 px-4 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all duration-300 shadow-sm font-medium font-sans"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                  Contact Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="10-digit mobile number"
                  className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-3.5 px-4 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all duration-300 shadow-sm font-medium font-sans"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                  Shop/Entity Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Shop number, street name, city"
                  className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-3.5 px-4 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all duration-300 shadow-sm font-medium font-sans"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-cyan-600 to-indigo-650 hover:from-cyan-500 hover:to-indigo-550 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-cyan-500/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 font-sans"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Join Clinic Network <ArrowRight className="h-4 w-4" /></>}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col space-y-5 relative">
      {/* Background Neon Glow Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-cyan-500/5 blur-[120px] pointer-events-none animate-pulse-subtle"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none animate-pulse-subtle" style={{ animationDelay: '2s' }}></div>

      <div className="z-10 flex flex-col space-y-5">

        {/* Sliding Tab Selector */}
        {initialSignupTab !== 'ops' && (
          <div className={`relative z-20 pointer-events-auto grid gap-1 bg-slate-200/50 p-1 rounded-xl border border-slate-200/80 ${
            isDashboardSubdomain
              ? (allowSignup ? 'grid-cols-3' : 'grid-cols-2')
              : (allowSignup ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3')
          }`}>
            <button
              type="button"
              onClick={() => handleTabSelect('signin')}
              className={`min-h-9 px-2 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer pointer-events-auto ${activeTab === 'signin' ? 'bg-gradient-to-r from-indigo-500 to-indigo-650 text-white shadow-md shadow-indigo-500/10' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/40'}`}
            >
              Sign In
            </button>
            {allowSignup && (
              <button
                type="button"
                onClick={() => handleTabSelect('register')}
                className={`min-h-9 px-2 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer pointer-events-auto ${activeTab === 'register' ? 'bg-gradient-to-r from-indigo-500 to-indigo-650 text-white shadow-md shadow-indigo-500/10' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/40'}`}
              >
                Doctor Signup
              </button>
            )}
            <button
              type="button"
              onClick={() => handleTabSelect('join')}
              className={`min-h-9 px-2 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer pointer-events-auto ${activeTab === 'join' ? 'bg-gradient-to-r from-indigo-500 to-indigo-650 text-white shadow-md shadow-indigo-500/10' : 'text-slate-500 hover:text-slate-850'}`}
            >
              Partner Sign In
            </button>
            {!isDashboardSubdomain && (
              <button
                type="button"
                onClick={() => handleTabSelect('ops')}
                className={`min-h-9 px-2 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer pointer-events-auto ${activeTab === 'ops' ? 'bg-gradient-to-r from-indigo-500 to-indigo-650 text-white shadow-md shadow-indigo-500/10' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/40'}`}
              >
                SaaS Ops
              </button>
            )}
          </div>
        )}

        {errorMsg && (
          <div className="space-y-3 animate-shake">
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3.5 flex items-start gap-3">
              <Shield className="h-5 w-5 text-rose-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs font-semibold text-rose-300 leading-relaxed">{errorMsg}</div>
            </div>

            {/* Premium Diagnostics Panel */}
            {activeErrorCode && ERROR_DICTIONARY[activeErrorCode] && (
              <div className="bg-clinical-950/90 border border-cyan-500/20 rounded-2xl p-4 space-y-3.5 shadow-xl shadow-cyan-950/20 text-clinical-100 font-sans">
                <div className="flex items-center justify-between border-b border-clinical-800/80 pb-2">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-cyan-400 animate-pulse-subtle" />
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">
                      Diagnostic telemetry active
                    </span>
                  </div>
                  <span className="text-[9px] font-bold text-cyan-400 bg-cyan-500/10 px-2.5 py-0.5 rounded-full border border-cyan-500/20 font-mono">
                    {ERROR_DICTIONARY[activeErrorCode].code}
                  </span>
                </div>

                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-white">{ERROR_DICTIONARY[activeErrorCode].message}</h4>
                  <p className="text-[10px] text-clinical-300 leading-relaxed">
                    {ERROR_DICTIONARY[activeErrorCode].description}
                  </p>
                </div>

                <div className="bg-clinical-900/50 rounded-xl p-2.5 border border-clinical-800/40 text-[10px] leading-relaxed">
                  <span className="font-bold text-cyan-400 block mb-0.5">💡 Troubleshooting Recommendation:</span>
                  <span className="text-clinical-300">{ERROR_DICTIONARY[activeErrorCode].diagnostic}</span>
                </div>

                {/* Recent Telemetry Logs */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[9px] font-bold text-clinical-400 uppercase tracking-wider">
                    <span>Recent Login Activity</span>
                    <button 
                      type="button" 
                      onClick={() => {
                        localStorage.removeItem('mediflow_login_attempts');
                        setActiveErrorCode(null);
                        setErrorMsg(null);
                      }} 
                      className="text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
                    >
                      Clear logs
                    </button>
                  </div>
                  <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
                    {getLoginAttempts().slice(0, 3).map((attempt, index) => (
                      <div key={index} className="flex justify-between items-center bg-clinical-900/20 border border-clinical-800/20 p-2 rounded-lg text-[9px]">
                        <div className="flex flex-col text-left">
                          <span className="text-clinical-200 font-bold font-mono truncate max-w-[150px]">{attempt.email}</span>
                          <span className="text-clinical-500 text-[8px]">{new Date(attempt.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[7px] border ${
                          attempt.success 
                            ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
                            : 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                        }`}>
                          {attempt.success ? 'Success' : attempt.errorCode?.replace('ERR_AUTH_', '') || 'Failed'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SIGN IN FLOW */}
        {activeTab === 'signin' && (
          <form onSubmit={handleEmailSignIn} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="signin-email" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                Professional Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  id="signin-email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@mediflow.com"
                  className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-3.5 pl-11 pr-4 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all duration-300 shadow-sm font-medium font-sans"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="signin-password" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                Security Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  id="signin-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-3.5 pl-11 pr-12 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all duration-300 shadow-sm font-medium font-sans"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-655 transition-all cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-cyan-600 to-indigo-650 hover:from-cyan-500 hover:to-indigo-550 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-cyan-500/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 font-sans"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Enter Workspace <ArrowRight className="h-4 w-4" /></>}
            </button>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-4 text-slate-400 text-[9px] font-bold uppercase tracking-widest">or</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-3.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 font-sans"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </button>

            <p className="text-center text-[10px] text-slate-500 font-medium">
              Are you a partner (pharmacist/lab)? Use the{' '}
              <button type="button" onClick={() => { setActiveTab('join'); setJoinSubMode('signin'); setErrorMsg(null); }} className="text-cyan-600 hover:text-cyan-800 font-bold underline cursor-pointer">
                Partner Sign In
              </button>{' '}tab.
            </p>
          </form>
        )}

        {/* SAAS OPERATIONS LOGIN FLOW */}
        {activeTab === 'ops' && (
          <form onSubmit={handleOpsSignIn} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="ops-email" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                Operations Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  id="ops-email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@mediflow.com"
                  className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-3.5 pl-11 pr-4 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all duration-300 shadow-sm font-medium font-sans"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="ops-password" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                Security Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  id="ops-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-3.5 pl-11 pr-12 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all duration-300 shadow-sm font-medium font-sans"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-655 transition-all cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end pr-1">
              <button
                type="button"
                onClick={() => { setActiveTab('forgot'); setErrorMsg(null); }}
                className="text-[10px] font-bold text-cyan-600 hover:text-cyan-850 transition-colors cursor-pointer underline"
              >
                Forgot Password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-cyan-600 to-indigo-650 hover:from-cyan-500 hover:to-indigo-550 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-cyan-500/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 font-sans"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Authenticate Operations Console <ArrowRight className="h-4 w-4" /></>}
            </button>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-4 text-slate-400 text-[9px] font-bold uppercase tracking-widest">or</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-3.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 font-sans"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </button>
          </form>
        )}

        {/* FORGOT PASSWORD FLOW */}
        {activeTab === 'forgot' && !resetSent && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="bg-cyan-50/50 border border-cyan-100/50 rounded-xl p-3 text-[10px] text-slate-600 leading-relaxed font-medium">
              <span className="font-bold text-cyan-700">Password Reset:</span> Enter your email address and we will send you a secure link to update your security password.
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                Professional Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@mediflow.com"
                  className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-3.5 pl-11 pr-4 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all duration-300 shadow-sm font-medium font-sans"
                  required
                />
              </div>
            </div>

            {errorMsg && (
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 flex items-start gap-2.5">
                <AlertCircle className="h-4.5 w-4.5 text-rose-500 mt-0.5 shrink-0" />
                <span className="text-[11px] text-rose-600 font-semibold">{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-cyan-600 to-indigo-650 hover:from-cyan-500 hover:to-indigo-550 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-cyan-500/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 font-sans"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Send Reset Link <ArrowRight className="h-4 w-4" /></>}
            </button>

            <p className="text-center text-[10px] text-slate-500 font-medium">
              Remember your password?{' '}
              <button type="button" onClick={() => { setActiveTab('signin'); setErrorMsg(null); }} className="text-cyan-600 hover:text-cyan-800 font-bold underline cursor-pointer">
                Back to Sign In
              </button>
            </p>
          </form>
        )}

        {activeTab === 'forgot' && resetSent && (
          <div className="w-full flex flex-col space-y-5 animate-fade-in text-center py-4">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Mail className="h-6 w-6 text-emerald-500 animate-pulse" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-extrabold text-slate-900">Check Your Email</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                We have sent a secure password reset link to <strong className="text-slate-800">{email}</strong>.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setResetSent(false);
                setActiveTab('signin');
                setEmail('');
                setErrorMsg(null);
              }}
              className="w-full py-3 bg-gradient-to-r from-indigo-500 to-indigo-650 hover:from-indigo-600 hover:to-indigo-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all cursor-pointer font-sans"
            >
              Return to Sign In
            </button>
          </div>
        )}

        {/* DOCTOR REGISTRATION FLOW */}
        {activeTab === 'register' && (
          <div className="space-y-3.5">
            {registrationStep === 1 ? (
              <div className="space-y-3.5 animate-fade-in">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                      First Name
                    </label>
                    <div className="relative">
                      <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => {
                          setFirstName(e.target.value);
                          if (validationErrors.firstName) {
                            setValidationErrors(prev => {
                              const copy = { ...prev };
                              delete copy.firstName;
                              return copy;
                            });
                          }
                        }}
                        placeholder="First Name"
                        className={`w-full bg-white border ${validationErrors.firstName ? 'border-rose-500 focus:border-rose-500/40 animate-shake' : 'border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'} rounded-xl py-2.5 pl-10 pr-3.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition-all duration-300 font-medium font-sans`}
                      />
                    </div>
                    {validationErrors.firstName && (
                      <span className="text-[10px] text-rose-600 font-semibold flex items-center gap-1 mt-1 pl-1 animate-fade-in">
                        <AlertCircle className="h-3 w-3 shrink-0" /> {validationErrors.firstName}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                      Last Name
                    </label>
                    <div className="relative">
                      <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => {
                          setLastName(e.target.value);
                          if (validationErrors.lastName) {
                            setValidationErrors(prev => {
                              const copy = { ...prev };
                              delete copy.lastName;
                              return copy;
                            });
                          }
                        }}
                        placeholder="Last Name"
                        className={`w-full bg-white border ${validationErrors.lastName ? 'border-rose-500 focus:border-rose-500/40 animate-shake' : 'border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'} rounded-xl py-2.5 pl-10 pr-3.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition-all duration-300 font-medium font-sans`}
                      />
                    </div>
                    {validationErrors.lastName && (
                      <span className="text-[10px] text-rose-600 font-semibold flex items-center gap-1 mt-1 pl-1 animate-fade-in">
                        <AlertCircle className="h-3 w-3 shrink-0" /> {validationErrors.lastName}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                    Professional Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (validationErrors.email) {
                          setValidationErrors(prev => {
                            const copy = { ...prev };
                            delete copy.email;
                            return copy;
                          });
                        }
                      }}
                      placeholder="john.doe@mediflow.com"
                      className={`w-full bg-white border ${validationErrors.email ? 'border-rose-500 focus:border-rose-500/40 animate-shake' : 'border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'} rounded-xl py-2.5 pl-10 pr-3.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition-all duration-300 font-medium font-sans`}
                    />
                  </div>
                  {validationErrors.email && (
                    <span className="text-[10px] text-rose-600 font-semibold flex items-center gap-1 mt-1 pl-1 animate-fade-in">
                      <AlertCircle className="h-3 w-3 shrink-0" /> {validationErrors.email}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                      Security Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type={showRegPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (validationErrors.password) {
                            setValidationErrors(prev => {
                              const copy = { ...prev };
                              delete copy.password;
                              return copy;
                            });
                          }
                        }}
                        placeholder="••••••••"
                        className={`w-full bg-white border ${validationErrors.password ? 'border-rose-500 focus:border-rose-500/40 animate-shake' : 'border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'} rounded-xl py-2.5 pl-10 pr-12 text-xs text-slate-800 placeholder-slate-400 outline-none transition-all duration-300 font-medium font-sans`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
                      >
                        {showRegPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    {validationErrors.password && (
                      <span className="text-[10px] text-rose-600 font-semibold flex items-center gap-1 mt-1 pl-1 animate-fade-in">
                        <AlertCircle className="h-3 w-3 shrink-0" /> {validationErrors.password}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type={showRegConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          if (validationErrors.confirmPassword) {
                            setValidationErrors(prev => {
                              const copy = { ...prev };
                              delete copy.confirmPassword;
                              return copy;
                            });
                          }
                        }}
                        placeholder="••••••••"
                        className={`w-full bg-white border ${validationErrors.confirmPassword ? 'border-rose-500 focus:border-rose-500/40 animate-shake' : 'border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'} rounded-xl py-2.5 pl-10 pr-12 text-xs text-slate-800 placeholder-slate-400 outline-none transition-all duration-300 font-medium font-sans`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
                      >
                        {showRegConfirmPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    {validationErrors.confirmPassword && (
                      <span className="text-[10px] text-rose-600 font-semibold flex items-center gap-1 mt-1 pl-1 animate-fade-in">
                        <AlertCircle className="h-3 w-3 shrink-0" /> {validationErrors.confirmPassword}
                      </span>
                    )}
                  </div>
                </div>

                {password && (
                  <div className="space-y-1.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex justify-between text-[9px] font-bold">
                      <span className="text-slate-500">Password Strength:</span>
                      <span className={pwdStrength.score === 1 ? 'text-rose-600' : pwdStrength.score === 2 ? 'text-amber-600' : 'text-emerald-600'}>
                        {pwdStrength.label}
                      </span>
                    </div>
                    <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden">
                      <div className={`h-full transition-all duration-500 ${pwdStrength.color} ${pwdStrength.width}`} />
                    </div>
                  </div>
                )}

                {/* Terms & Privacy acceptance */}
                <div className="space-y-1 mt-2">
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={tosAccepted}
                      onChange={(e) => {
                        setTosAccepted(e.target.checked);
                        if (validationErrors.tos) {
                          const newErrors = { ...validationErrors };
                          delete newErrors.tos;
                          setValidationErrors(newErrors);
                        }
                      }}
                      className="mt-0.5 h-3.5 w-3.5 accent-cyan-600 rounded border-slate-300 bg-white"
                    />
                    <span className="text-[11px] text-slate-600 font-medium leading-tight">
                      I accept the{' '}
                      <button
                        type="button"
                        onClick={() => setShowTermsModal(true)}
                        className="text-cyan-600 hover:text-cyan-800 underline font-bold"
                      >
                        Terms of Service
                      </button>{' '}
                      and{' '}
                      <button
                        type="button"
                        onClick={() => setShowTermsModal(true)}
                        className="text-cyan-600 hover:text-cyan-800 underline font-bold"
                      >
                        Privacy Policy
                      </button>.
                    </span>
                  </label>
                  {validationErrors.tos && (
                    <span className="text-[10px] text-rose-600 font-semibold flex items-center gap-1 mt-1 pl-1 animate-fade-in">
                      <AlertCircle className="h-3 w-3 shrink-0" /> {validationErrors.tos}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (validateStep1()) {
                      setRegistrationStep(2);
                    }
                  }}
                  className="w-full mt-4 py-3 bg-gradient-to-r from-cyan-600 to-indigo-650 hover:from-cyan-500 hover:to-indigo-550 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-cyan-500/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer font-sans"
                >
                  Next: Clinic Setup <ArrowRight className="h-4 w-4" />
                </button>

              </div>
            ) : (
              <form onSubmit={handleClinicRegister} className="space-y-3.5 animate-fade-in">
                <div className="flex items-center gap-2 text-slate-500 pb-1">
                  <button
                    type="button"
                    onClick={() => setRegistrationStep(1)}
                    className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-650 transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Step 2: Workspace Setup</span>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                      Clinic Business Name
                    </label>
                    <input
                      type="text"
                      value={clinicName}
                      onChange={(e) => {
                        setClinicName(e.target.value);
                        if (validationErrors.clinicName) {
                          setValidationErrors(prev => {
                            const copy = { ...prev };
                            delete copy.clinicName;
                            return copy;
                          });
                        }
                      }}
                      placeholder="Kankarbagh Connected Clinic"
                      className={`w-full bg-white border ${validationErrors.clinicName ? 'border-rose-500 focus:border-rose-500/40 animate-shake' : 'border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'} rounded-xl py-2.5 px-3.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition-all duration-300 font-medium font-sans`}
                      required
                    />
                    {validationErrors.clinicName && (
                      <span className="text-[10px] text-rose-600 font-semibold flex items-center gap-1 mt-1 pl-1 animate-fade-in">
                        <AlertCircle className="h-3 w-3 shrink-0" /> {validationErrors.clinicName}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                      Clinical Specialization
                    </label>
                    <select
                      value={specialization}
                      onChange={(e) => setSpecialization(e.target.value)}
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-2.5 px-3.5 text-xs text-slate-800 outline-none transition-all duration-300 font-medium font-sans cursor-pointer"
                    >
                      <option value="General Medicine" className="text-slate-800 bg-white">General Medicine</option>
                      <option value="Pediatrics" className="text-slate-800 bg-white">Pediatrics</option>
                      <option value="Ophthalmology" className="text-slate-800 bg-white">Ophthalmology</option>
                      <option value="Dentistry" className="text-slate-800 bg-white">Dentistry / Dental Care</option>
                      <option value="Cardiology" className="text-slate-800 bg-white">Cardiology</option>
                      <option value="Dermatology" className="text-slate-800 bg-white">Dermatology</option>
                      <option value="Gynecology" className="text-slate-800 bg-white">Gynecology</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                      Contact Phone Number
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        if (validationErrors.phone) {
                          setValidationErrors(prev => {
                            const copy = { ...prev };
                            delete copy.phone;
                            return copy;
                          });
                        }
                      }}
                      placeholder="9999000001"
                      className={`w-full bg-white border ${validationErrors.phone ? 'border-rose-500 focus:border-rose-500/40 animate-shake' : 'border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'} rounded-xl py-2.5 px-3.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition-all duration-300 font-medium font-sans`}
                      required
                    />
                    {validationErrors.phone && (
                      <span className="text-[10px] text-rose-600 font-semibold flex items-center gap-1 mt-1 pl-1 animate-fade-in">
                        <AlertCircle className="h-3 w-3 shrink-0" /> {validationErrors.phone}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                    Clinic Physical Address
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => {
                      setAddress(e.target.value);
                      if (validationErrors.address) {
                        setValidationErrors(prev => {
                          const copy = { ...prev };
                          delete copy.address;
                          return copy;
                        });
                      }
                    }}
                    placeholder="Main Road, Kankarbagh, Patna, Bihar"
                    className={`w-full bg-white border ${validationErrors.address ? 'border-rose-500 focus:border-rose-500/40 animate-shake' : 'border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'} rounded-xl py-2.5 px-3.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition-all duration-300 font-medium font-sans`}
                    required
                  />
                  {validationErrors.address && (
                    <span className="text-[10px] text-rose-600 font-semibold flex items-center gap-1 mt-1 pl-1 animate-fade-in">
                      <AlertCircle className="h-3 w-3 shrink-0" /> {validationErrors.address}
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-cyan-600 to-indigo-650 hover:from-cyan-500 hover:to-indigo-750 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-cyan-500/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 font-sans"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Register Clinic Network <ArrowRight className="h-4 w-4" /></>}
                </button>
              </form>
            )}
          </div>
        )}

        {/* PARTNER JOIN / SIGN IN FLOW */}
        {activeTab === 'join' && (
          <div className="space-y-4">
            {/* Sub-mode Toggle: Sign In vs Register */}
            {allowSignup && (
              <div className="flex gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => handleJoinSubModeSelect('signin')}
                  className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${joinSubMode === 'signin' ? 'bg-gradient-to-r from-cyan-600 to-indigo-650 text-white shadow-md' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/40'}`}
                >
                  Partner Sign In
                </button>
                <button
                  type="button"
                  onClick={() => handleJoinSubModeSelect('register')}
                  className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${joinSubMode === 'register' ? 'bg-gradient-to-r from-cyan-600 to-indigo-650 text-white shadow-md' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/40'}`}
                >
                  New Registration
                </button>
              </div>
            )}

            {/* PARTNER SIGN IN */}
            {joinSubMode === 'signin' && (
              <form onSubmit={handlePartnerSignIn} className="space-y-4">
                <div className="bg-cyan-50 border border-cyan-100 rounded-xl p-3 text-[10px] text-slate-655 leading-relaxed font-medium">
                  <span className="font-bold text-cyan-700">Already registered?</span> Sign in with the email and password you used when joining your clinic network.
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="partner-email" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                    Partner Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      id="partner-email"
                      name="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="pharmacist@yourshop.com"
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-3.5 pl-11 pr-4 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all duration-300 shadow-sm font-medium font-sans"
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="partner-password" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                    Security Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      id="partner-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-3.5 pl-11 pr-12 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all duration-300 shadow-sm font-medium font-sans"
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-655 transition-all cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pr-1">
                  <button
                    type="button"
                    onClick={() => { setActiveTab('forgot'); setErrorMsg(null); }}
                    className="text-[10px] font-bold text-cyan-600 hover:text-cyan-850 transition-colors cursor-pointer underline"
                  >
                    Forgot Password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-gradient-to-r from-cyan-600 to-indigo-650 hover:from-cyan-500 hover:to-indigo-750 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-cyan-500/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 font-sans"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Enter Partner Workspace <ArrowRight className="h-4 w-4" /></>}
                </button>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-slate-200"></div>
                  <span className="flex-shrink mx-4 text-slate-400 text-[9px] font-bold uppercase tracking-widest">or</span>
                  <div className="flex-grow border-t border-slate-200"></div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full py-3.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 font-sans"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      fill="#EA4335"
                    />
                  </svg>
                  Continue with Google
                </button>

                <p className="text-center text-[10px] text-slate-500 font-medium">
                  First time?{' '}
                  <button type="button" onClick={() => { setJoinSubMode('register'); setErrorMsg(null); }} className="text-cyan-600 hover:text-cyan-800 font-bold underline cursor-pointer">
                    Register your pharmacy or lab
                  </button>
                </p>
              </form>
            )}

            {/* PARTNER REGISTRATION */}
            {joinSubMode === 'register' && (
              <div className="space-y-3.5">
                {registrationStep === 1 ? (
                  <div className="space-y-3.5 animate-fade-in">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                          First Name
                        </label>
                        <div className="relative">
                          <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                          <input
                            type="text"
                            value={firstName}
                            onChange={(e) => {
                              setFirstName(e.target.value);
                              if (validationErrors.firstName) {
                                setValidationErrors(prev => {
                                  const copy = { ...prev };
                                  delete copy.firstName;
                                  return copy;
                                });
                              }
                            }}
                            placeholder="First Name"
                            className={`w-full bg-white border ${validationErrors.firstName ? 'border-rose-500 focus:border-rose-500/40 animate-shake' : 'border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'} rounded-xl py-2.5 pl-10 pr-3.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition-all duration-300 font-medium font-sans`}
                          />
                        </div>
                        {validationErrors.firstName && (
                          <span className="text-[10px] text-rose-600 font-semibold flex items-center gap-1 mt-1 pl-1 animate-fade-in">
                            <AlertCircle className="h-3 w-3 shrink-0" /> {validationErrors.firstName}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                          Last Name
                        </label>
                        <div className="relative">
                          <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                          <input
                            type="text"
                            value={lastName}
                            onChange={(e) => {
                              setLastName(e.target.value);
                              if (validationErrors.lastName) {
                                setValidationErrors(prev => {
                                  const copy = { ...prev };
                                  delete copy.lastName;
                                  return copy;
                                });
                              }
                            }}
                            placeholder="Last Name"
                            className={`w-full bg-white border ${validationErrors.lastName ? 'border-rose-500 focus:border-rose-500/40 animate-shake' : 'border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'} rounded-xl py-2.5 pl-10 pr-3.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition-all duration-300 font-medium font-sans`}
                          />
                        </div>
                        {validationErrors.lastName && (
                          <span className="text-[10px] text-rose-600 font-semibold flex items-center gap-1 mt-1 pl-1 animate-fade-in">
                            <AlertCircle className="h-3 w-3 shrink-0" /> {validationErrors.lastName}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                        Partner Email Address
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            if (validationErrors.email) {
                              setValidationErrors(prev => {
                                const copy = { ...prev };
                                delete copy.email;
                                return copy;
                              });
                            }
                          }}
                          placeholder="pharmacist@yourshop.com"
                          className={`w-full bg-white border ${validationErrors.email ? 'border-rose-500 focus:border-rose-500/40 animate-shake' : 'border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'} rounded-xl py-2.5 pl-10 pr-3.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition-all duration-300 font-medium font-sans`}
                        />
                      </div>
                      {validationErrors.email && (
                        <span className="text-[10px] text-rose-600 font-semibold flex items-center gap-1 mt-1 pl-1 animate-fade-in">
                          <AlertCircle className="h-3 w-3 shrink-0" /> {validationErrors.email}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                          Security Password
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                          <input
                            type={showRegPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => {
                              setPassword(e.target.value);
                              if (validationErrors.password) {
                                setValidationErrors(prev => {
                                  const copy = { ...prev };
                                  delete copy.password;
                                  return copy;
                                });
                              }
                            }}
                            placeholder="••••••••"
                            className={`w-full bg-white border ${validationErrors.password ? 'border-rose-500 focus:border-rose-500/40 animate-shake' : 'border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'} rounded-xl py-2.5 pl-10 pr-12 text-xs text-slate-800 placeholder-slate-400 outline-none transition-all duration-300 font-medium font-sans`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowRegPassword(!showRegPassword)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-655 transition-all cursor-pointer"
                          >
                            {showRegPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                        {validationErrors.password && (
                          <span className="text-[10px] text-rose-600 font-semibold flex items-center gap-1 mt-1 pl-1 animate-fade-in">
                            <AlertCircle className="h-3 w-3 shrink-0" /> {validationErrors.password}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                          Confirm Password
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                          <input
                            type={showRegConfirmPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => {
                              setConfirmPassword(e.target.value);
                              if (validationErrors.confirmPassword) {
                                setValidationErrors(prev => {
                                  const copy = { ...prev };
                                  delete copy.confirmPassword;
                                  return copy;
                                });
                              }
                            }}
                            placeholder="••••••••"
                            className={`w-full bg-white border ${validationErrors.confirmPassword ? 'border-rose-500 focus:border-rose-500/40 animate-shake' : 'border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'} rounded-xl py-2.5 pl-10 pr-12 text-xs text-slate-800 placeholder-slate-400 outline-none transition-all duration-300 font-medium font-sans`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-655 transition-all cursor-pointer"
                          >
                            {showRegConfirmPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                        {validationErrors.confirmPassword && (
                          <span className="text-[10px] text-rose-600 font-semibold flex items-center gap-1 mt-1 pl-1 animate-fade-in">
                            <AlertCircle className="h-3 w-3 shrink-0" /> {validationErrors.confirmPassword}
                          </span>
                        )}
                      </div>
                    </div>

                    {password && (
                      <div className="space-y-1.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="flex justify-between text-[9px] font-bold">
                          <span className="text-slate-500">Password Strength:</span>
                          <span className={pwdStrength.score === 1 ? 'text-rose-600' : pwdStrength.score === 2 ? 'text-amber-600' : 'text-emerald-600'}>
                            {pwdStrength.label}
                          </span>
                        </div>
                        <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden">
                          <div className={`h-full transition-all duration-500 ${pwdStrength.color} ${pwdStrength.width}`} />
                        </div>
                      </div>
                    )}

                    {/* Terms & Privacy acceptance */}
                    <div className="space-y-1 mt-2">
                      <label className="flex items-start gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={tosAccepted}
                          onChange={(e) => {
                            setTosAccepted(e.target.checked);
                            if (validationErrors.tos) {
                              const newErrors = { ...validationErrors };
                              delete newErrors.tos;
                              setValidationErrors(newErrors);
                            }
                          }}
                          className="mt-0.5 h-3.5 w-3.5 accent-cyan-600 rounded border-slate-300 bg-white"
                        />
                        <span className="text-[11px] text-slate-600 font-medium leading-tight">
                          I accept the{' '}
                          <button
                            type="button"
                            onClick={() => setShowTermsModal(true)}
                            className="text-cyan-600 hover:text-cyan-800 underline font-bold"
                          >
                            Terms of Service
                          </button>{' '}
                          and{' '}
                          <button
                            type="button"
                            onClick={() => setShowTermsModal(true)}
                            className="text-cyan-600 hover:text-cyan-800 underline font-bold"
                          >
                            Privacy Policy
                          </button>.
                        </span>
                      </label>
                      {validationErrors.tos && (
                        <span className="text-[10px] text-rose-600 font-semibold flex items-center gap-1 mt-1 pl-1 animate-fade-in">
                          <AlertCircle className="h-3 w-3 shrink-0" /> {validationErrors.tos}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (validateStep1()) {
                          setRegistrationStep(2);
                        }
                      }}
                      className="w-full mt-4 py-3 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-cyan-500/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer font-sans"
                    >
                      Next: Partner Details <ArrowRight className="h-4 w-4" />
                    </button>

                  </div>
                ) : (
                  <form onSubmit={handlePartnerJoin} className="space-y-3.5 animate-fade-in">
                    <div className="flex items-center gap-2 text-slate-500 pb-1">
                      <button
                        type="button"
                        onClick={() => setRegistrationStep(1)}
                        className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </button>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Step 2: Partner Workspace Setup</span>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                        Clinic Network Code (MF-XXXX)
                      </label>
                      <div className="relative">
                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                        <input
                          type="text"
                          value={clinicCode}
                          onChange={(e) => {
                            setClinicCode(e.target.value.toUpperCase());
                            if (validationErrors.clinicCode) {
                              setValidationErrors(prev => {
                                const copy = { ...prev };
                                delete copy.clinicCode;
                                return copy;
                              });
                            }
                          }}
                          placeholder="MF-A1B2"
                          maxLength={10}
                          className={`w-full bg-white border ${validationErrors.clinicCode ? 'border-rose-500' : 'border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'} rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-800 placeholder-slate-400 outline-none transition-all duration-300 font-mono font-bold`}
                          required
                        />
                        {validatingCode && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-cyan-600 animate-spin" />}
                      </div>

                      {validatedClinicName ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-100 flex items-center gap-1 pl-2 mt-1">
                          <Check className="h-3 w-3" /> Valid Clinic: <strong className="text-slate-900">{validatedClinicName}</strong>
                        </span>
                      ) : clinicCode.length >= 7 && !validatingCode ? (
                        <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded border border-rose-100 flex items-center gap-1 pl-2 mt-1">
                          Clinic code not found. Please double check.
                        </span>
                      ) : validationErrors.clinicCode ? (
                        <span className="text-[10px] text-rose-600 font-semibold flex items-center gap-1 mt-1 pl-1">
                          <AlertCircle className="h-3 w-3 shrink-0" /> {validationErrors.clinicCode}
                        </span>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-2 gap-3.5">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                          Partner Entity Type
                        </label>
                        <select
                          value={partnerType}
                          onChange={(e) => setPartnerType(e.target.value as any)}
                          className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-2.5 px-3.5 text-xs text-slate-800 outline-none transition-all duration-300 font-medium font-sans cursor-pointer"
                        >
                          <option value="pharmacy" className="text-slate-800 bg-white">Pharmacy POS</option>
                          <option value="lab" className="text-slate-800 bg-white">Pathology Lab</option>
                          <option value="compounder" className="text-slate-800 bg-white">Clinic Compounder</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                          Business Name
                        </label>
                        <input
                          type="text"
                          value={displayName}
                          onChange={(e) => {
                            setDisplayName(e.target.value);
                            if (validationErrors.displayName) {
                              setValidationErrors(prev => {
                                const copy = { ...prev };
                                delete copy.displayName;
                                return copy;
                              });
                            }
                          }}
                          placeholder={partnerType === 'pharmacy' ? 'Kankarbagh Smart Pharmacy' : 'Patna Pathology Lab'}
                          className={`w-full bg-white border ${validationErrors.displayName ? 'border-rose-500 focus:border-rose-500/40 animate-shake' : 'border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'} rounded-xl py-2.5 px-3.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition-all duration-300 font-medium font-sans`}
                          required
                        />
                        {validationErrors.displayName && (
                          <span className="text-[10px] text-rose-600 font-semibold flex items-center gap-1 mt-1 pl-1">
                            <AlertCircle className="h-3 w-3 shrink-0" /> {validationErrors.displayName}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3.5">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                          Contact Phone Number
                        </label>
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => {
                            setPhone(e.target.value);
                            if (validationErrors.phone) {
                              setValidationErrors(prev => {
                                const copy = { ...prev };
                                delete copy.phone;
                                return copy;
                              });
                            }
                          }}
                          placeholder="9999000003"
                          className={`w-full bg-white border ${validationErrors.phone ? 'border-rose-500 focus:border-rose-500/40 animate-shake' : 'border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'} rounded-xl py-2.5 px-3.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition-all duration-300 font-medium font-sans`}
                          required
                        />
                        {validationErrors.phone && (
                          <span className="text-[10px] text-rose-600 font-semibold flex items-center gap-1 mt-1 pl-1">
                            <AlertCircle className="h-3 w-3 shrink-0" /> {validationErrors.phone}
                          </span>
                        )}
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                          Physical Address
                        </label>
                        <input
                          type="text"
                          value={address}
                          onChange={(e) => {
                            setAddress(e.target.value);
                            if (validationErrors.address) {
                              setValidationErrors(prev => {
                                const copy = { ...prev };
                                delete copy.address;
                                return copy;
                              });
                            }
                          }}
                          placeholder="Opposite Clinic main gate, Patna"
                          className={`w-full bg-white border ${validationErrors.address ? 'border-rose-500 focus:border-rose-500/40 animate-shake' : 'border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'} rounded-xl py-2.5 px-3.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition-all duration-300 font-medium font-sans`}
                          required
                        />
                        {validationErrors.address && (
                          <span className="text-[10px] text-rose-600 font-semibold flex items-center gap-1 mt-1 pl-1">
                            <AlertCircle className="h-3 w-3 shrink-0" /> {validationErrors.address}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || !validatedClinicName}
                      className="w-full py-3 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-cyan-500/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 font-sans"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Submit Join Request <ArrowRight className="h-4 w-4" /></>}
                    </button>

                    <p className="text-center text-[10px] text-slate-500 font-medium">
                      Already registered?{' '}
                      <button type="button" onClick={() => handleJoinSubModeSelect('signin')} className="text-cyan-600 hover:text-cyan-800 font-bold underline cursor-pointer">
                        Sign in here
                      </button>
                    </p>
                  </form>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Terms of Service & Privacy Policy Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md animate-fade-in text-slate-800 font-sans">
          <div className="relative w-full max-w-2xl max-h-[80vh] overflow-y-auto bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col space-y-6">
            <button
              onClick={() => setShowTermsModal(false)}
              className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-800 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 bg-cyan-50 border border-cyan-200 text-cyan-600 rounded-2xl">
                <FileText className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-slate-900">VitalSync Terms & Privacy</h3>
                <p className="text-xs text-slate-500">Effective Date: June 2026</p>
              </div>
            </div>

            <div className="space-y-4 text-xs text-slate-600 leading-relaxed overflow-y-auto pr-2">
              <section className="space-y-2">
                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide">1. Nature of Service & Operational Tools</h4>
                <p>
                  VitalSync provides digital infrastructure coordinating e-prescriptions, laboratory requests, adjacent pharmacy inventory holds, and split-billing ledger calculations. The Platform does not practice medicine, provide clinical diagnoses, or offer medical advice.
                </p>
              </section>

              <section className="space-y-2">
                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide">2. Clinical Responsibility & Malpractice Waiver</h4>
                <p>
                  The registered medical practitioner is solely responsible for all patient diagnoses, drug selections, dosages, drug-to-drug interactions, and clinical actions. VitalSync and its operators hold zero liability for medical negligence, misdiagnosis, or adverse patient outcomes resulting from Platform usage. The Clinic agrees to defend and indemnify VitalSync against any malpractice claims.
                </p>
              </section>

              <section className="space-y-2">
                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide">3. DPDP Act 2023 & Patient Consent</h4>
                <p>
                  The Clinic acts as the Data Fiduciary and VitalSync acts as the Data Processor. The Clinic warrants it has obtained necessary lawful consent from patients before logging clinical details. VitalSync uses Row-Level Security (RLS) to isolate database records and enforces WhatsApp-based patient consent validation before data dispatch.
                </p>
              </section>

              <section className="space-y-2">
                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide">4. Limitation of Liability & Jurisdiction</h4>
                <p>
                  The Platform is provided "as-is". VitalSync's cumulative financial liability for server outages, database errors, or contract claims is strictly capped at the subscription fees paid by the Clinic in the preceding three (3) months. Disputes are subject to the exclusive jurisdiction of the courts of Patna, Bihar, India.
                </p>
              </section>
            </div>

            <button
              onClick={() => setShowTermsModal(false)}
              className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-2xl text-xs uppercase tracking-widest transition-all cursor-pointer shadow-md"
            >
              I Understand & Agree
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
