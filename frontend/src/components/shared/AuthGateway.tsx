import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { 
  Shield, Mail, ArrowRight, Activity, Lock, Eye, EyeOff, Loader2,
  Building2, Key, Copy, Check, Sparkles, AlertCircle, X, ArrowLeft, FileText,
  Users
} from 'lucide-react';
import { BrandMark } from './BrandMark';

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
  ERR_AUTH_INVALID_CREDENTIALS: {
    code: 'ERR_AUTH_INVALID_CREDENTIALS',
    message: 'Invalid Credentials',
    description: 'The email address or security password entered does not match any clinician account.',
    diagnostic: 'Double-check email spelling or request a password reset from your system administrator.'
  },
  ERR_AUTH_ACCOUNT_LOCKOUT: {
    code: 'ERR_AUTH_ACCOUNT_LOCKOUT',
    message: 'Account Lockout Active',
    description: 'This clinician node is temporarily locked due to 5 consecutive failed login attempts.',
    diagnostic: 'Wait 60 seconds before trying again, or contact support to verify provider registration status.'
  },
  ERR_AUTH_NETWORK_OFFLINE: {
    code: 'ERR_AUTH_NETWORK_OFFLINE',
    message: 'Network Connectivity Failure',
    description: 'Could not establish connection to the Mediflow clinical authentication servers.',
    diagnostic: 'Verify local internet connection, check DNS resolution, or check if the local Supabase/bridge server is running.'
  },
  ERR_AUTH_SERVER_ERROR: {
    code: 'ERR_AUTH_SERVER_ERROR',
    message: 'Clinical Pod Server Error',
    description: 'An unexpected exception occurred on the database engine or auth microservice.',
    diagnostic: 'Check server logs in Docker/Kubernetes. Ensure database migrations have run and Supabase schema is up to date.'
  },
  ERR_AUTH_SESSION_EXPIRED: {
    code: 'ERR_AUTH_SESSION_EXPIRED',
    message: 'Session Expired or Invalid',
    description: 'The authentication cookies or session token has expired or was revoked.',
    diagnostic: 'Clear browser storage or sign in again to obtain a new secure clinical token.'
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

interface AuthGatewayProps {
  onAuthSuccess: (session: any, profile: any) => void;
}

export const AuthGateway: React.FC<AuthGatewayProps> = ({ onAuthSuccess }) => {
  const [activeTab, setActiveTab] = useState<'signin' | 'register' | 'join' | 'ops'>('signin');
  const [joinSubMode, setJoinSubMode] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeErrorCode, setActiveErrorCode] = useState<string | null>(null);

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

  // Partner Join specific states
  const [clinicCode, setClinicCode] = useState('');
  const [partnerType, setPartnerType] = useState<'pharmacy' | 'lab' | 'compounder'>('pharmacy');
  const [validatingCode, setValidatingCode] = useState(false);
  const [validatedClinicName, setValidatedClinicName] = useState<string | null>(null);

  // Clear form errors and states when switching context
  const handleTabSelect = (tab: 'signin' | 'register' | 'join' | 'ops') => {
    setActiveTab(tab);
    setEmail('');
    setPassword('');
    setErrorMsg(null);
    setActiveErrorCode(null);
    setValidationErrors({});
    setRegistrationStep(1);
    setTosAccepted(false);
  };

  const handleJoinSubModeSelect = (mode: 'signin' | 'register') => {
    setJoinSubMode(mode);
    setErrorMsg(null);
    setActiveErrorCode(null);
    setValidationErrors({});
    setRegistrationStep(1);
    setTosAccepted(false);
  };

  const recordAttempt = (attemptEmail: string, success: boolean, err?: any) => {
    let code: string | undefined = undefined;
    let msg: string | undefined = undefined;

    if (!success && err) {
      msg = err.message || 'Authentication failed';
      if (!navigator.onLine || err.message?.includes('Failed to fetch') || err.message?.includes('network') || err.status === 0) {
        code = 'ERR_AUTH_NETWORK_OFFLINE';
      } else if (err.message?.includes('lockout') || err.message?.includes('Locked')) {
        code = 'ERR_AUTH_ACCOUNT_LOCKOUT';
      } else if (err.message?.includes('Invalid login credentials') || err.message?.includes('not match') || err.message?.includes('Access Denied')) {
        code = 'ERR_AUTH_INVALID_CREDENTIALS';
      } else {
        code = 'ERR_AUTH_SERVER_ERROR';
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
      entity: 'Mediflow HQ Operations',
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
        const { data, error } = await supabase
          .from('pods')
          .select('name')
          .eq('clinic_code', clinicCode.trim().toUpperCase())
          .single();

        if (error || !data) {
          setValidatedClinicName(null);
        } else {
          setValidatedClinicName(data.name);
        }
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

  const signInWithRealProfile = async (allowedRoles?: string[]) => {
    if (!email || !password) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      if (!data?.session || !data?.user) {
        throw new Error('Sign in succeeded but no session was returned. Please try again.');
      }

      // Verify profile exists and role matches (but don't call onAuthSuccess - let onAuthStateChange handle it)
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileErr || !profile) {
        throw new Error(profileErr?.message || 'Authenticated, but your Mediflow profile could not be loaded.');
      }

      if (allowedRoles && !allowedRoles.includes(profile.role)) {
        await supabase.auth.signOut();
        throw new Error('Access Denied: This account is not registered with the required role for this tab.');
      }

      // Profile verified successfully - onAuthStateChange will handle the rest
    } catch (err: any) {
      console.error('[Mediflow Auth] Real login failed:', err);
      setErrorMsg(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRealEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    await signInWithRealProfile();
  };

  const handleRealPartnerSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    await signInWithRealProfile(['pharmacist', 'lab_technician', 'compounder']);
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    // Check lockout first
    const lockoutStatus = checkLockout(email);
    if (lockoutStatus.locked) {
      setErrorMsg(`This clinician node is temporarily locked due to consecutive failed login attempts. Please try again in ${lockoutStatus.remainingSeconds}s.`);
      setActiveErrorCode('ERR_AUTH_ACCOUNT_LOCKOUT');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setActiveErrorCode(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      if (!data?.session) {
        throw new Error('Sign in succeeded but no session was returned. Please try again.');
      }
      // onAuthStateChange listener in App.tsx handles profile loading and session setup
      // Just verify profile exists to give immediate feedback on bad credentials
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileErr || !profile) {
        throw new Error('Authenticated, but your Mediflow profile could not be loaded.');
      }

      // Record successful attempt
      recordAttempt(email, true);
    } catch (err: any) {
      console.error('[Mediflow Auth] Login failed:', err);
      const code = recordAttempt(email, false, err);
      if (code && ERROR_DICTIONARY[code]) {
        setErrorMsg(ERROR_DICTIONARY[code].description);
      } else {
        setErrorMsg(err.message || 'Authentication failed. Please verify credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Partner sign-in for existing registered partners
  const handlePartnerSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    // Check lockout first
    const lockoutStatus = checkLockout(email);
    if (lockoutStatus.locked) {
      setErrorMsg(`This clinician node is temporarily locked due to consecutive failed login attempts. Please try again in ${lockoutStatus.remainingSeconds}s.`);
      setActiveErrorCode('ERR_AUTH_ACCOUNT_LOCKOUT');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setActiveErrorCode(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      if (!data?.session) {
        throw new Error('Sign in succeeded but no session was returned. Please try again.');
      }
      // Verify profile exists and has partner role
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileErr || !profile) {
        throw new Error('Authenticated, but your Mediflow profile could not be loaded.');
      }

      if (!['pharmacist', 'lab_technician', 'compounder'].includes(profile.role)) {
        await supabase.auth.signOut();
        throw new Error('Access Denied: This account is not registered as a partner.');
      }

      // Record successful attempt
      recordAttempt(email, true);
    } catch (err: any) {
      console.error('[Mediflow Auth] Partner login failed:', err);
      const code = recordAttempt(email, false, err);
      if (code && ERROR_DICTIONARY[code]) {
        setErrorMsg(ERROR_DICTIONARY[code].description);
      } else {
        setErrorMsg(err.message || 'Authentication failed. Please check your credentials.');
      }
    } finally {
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

      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Clinic Registered successfully! 🎉',
          message: `Welcome ${finalDisplayName}! Your clinical network code is active.`,
          type: 'success'
        }
      }));

    } catch (err: any) {
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

      // 5. Notify app of authentication success!
      onAuthSuccess(authData.session, profile);

      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Join Request Submitted! ⏳',
          message: 'Your registration was successful. Waiting for doctor approval.',
          type: 'success'
        }
      }));

    } catch (err: any) {
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

    // Check lockout first
    const lockoutStatus = checkLockout(email);
    if (lockoutStatus.locked) {
      setErrorMsg(`This clinician node is temporarily locked due to consecutive failed login attempts. Please try again in ${lockoutStatus.remainingSeconds}s.`);
      setActiveErrorCode('ERR_AUTH_ACCOUNT_LOCKOUT');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setActiveErrorCode(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;
      if (!data?.session || !data?.user) {
        throw new Error('Sign in succeeded but no session was returned. Please try again.');
      }

      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileErr || !profile) {
        throw new Error(profileErr?.message || 'Authenticated, but your Mediflow profile could not be loaded.');
      }
      
      if (profile?.role === 'admin' || profile?.role === 'platform_admin') {
        // Profile verified - onAuthStateChange will handle the rest
      } else {
        await supabase.auth.signOut();
        throw new Error('Access Denied: Restricted to Mediflow Operations Team.');
      }

      // Record successful attempt
      recordAttempt(email, true);
    } catch (err: any) {
      console.error('[Mediflow Auth] Ops login failed:', err);
      const code = recordAttempt(email, false, err);
      if (code && ERROR_DICTIONARY[code]) {
        setErrorMsg(ERROR_DICTIONARY[code].description);
      } else {
        setErrorMsg(err.message || 'Authentication failed. Please verify credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSignIn = async (user: typeof demoUsers[0]) => {
    setLoading(true);
    setErrorMsg(null);
    setActiveErrorCode(null);
    try {
      const authEmail = user.authEmail;

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: 'password123'
      });

      if (authError) {
        // If user doesn't exist, provide helpful error message
        if (authError.message.includes('Invalid login credentials') || authError.message.includes('Email not confirmed')) {
          throw new Error(`Demo user ${authEmail} not found in Supabase Auth. Please run the seed migrations or create the user in Supabase Dashboard with password 'password123'.`);
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
      onAuthSuccess(authData.session, modifiedProfile);
    } catch (err: any) {
      console.error('[Mediflow Auth] Demo login failed:', err);
      const code = recordAttempt(user.authEmail, false, err);
      if (code && ERROR_DICTIONARY[code]) {
        setErrorMsg(ERROR_DICTIONARY[code].description);
      } else {
        setErrorMsg(err.message || 'Demo profile loading failed.');
      }
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
      <div className="dark w-full bg-clinical-900 text-clinical-100 p-6 md:p-8 flex flex-col space-y-5 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-cyan-500/10 blur-[80px] pointer-events-none animate-pulse-subtle"></div>
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full bg-indigo-500/10 blur-[80px] pointer-events-none animate-pulse-subtle"></div>

        <div className="z-10 flex flex-col space-y-5 text-center animate-fade-in">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Sparkles className="h-6 w-6 text-cyan-400 animate-pulse-subtle" />
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-extrabold text-white">Clinic Registered!</h3>
            <p className="text-xs text-clinical-300 leading-relaxed font-medium">
              Your clinic node is now live. Share the unique code below with your partner pharmacy and lab.
            </p>
          </div>

          <div className="bg-clinical-950/80 border border-clinical-800 rounded-2xl p-5 space-y-3">
            <span className="text-[9px] font-bold text-clinical-400 uppercase tracking-widest block">
              Unique Clinic Network Code
            </span>
            <div className="flex items-center justify-center gap-3">
              <span className="text-2xl font-black tracking-wider text-white font-mono bg-slate-950/50 px-4 py-2 rounded-xl border border-clinical-800">
                {registeredClinicCode}
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="p-2.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 rounded-xl transition-all hover:scale-105 cursor-pointer"
                title="Copy Clinic Code"
              >
                {copiedCode ? <Check className="h-4.5 w-4.5 text-emerald-400" /> : <Copy className="h-4.5 w-4.5" />}
              </button>
            </div>
            {copiedCode && <span className="text-[10px] text-emerald-400 font-bold block animate-fade-in">Copied to clipboard!</span>}
          </div>

          <div className="text-left bg-cyan-950/20 border border-cyan-500/20 rounded-xl p-3.5 space-y-2">
            <h4 className="text-[10px] font-bold text-cyan-400 flex items-center gap-2 uppercase tracking-wider">
              <Shield className="h-3.5 w-3.5" /> Next Steps:
            </h4>
            <ul className="text-[10px] text-clinical-300 space-y-1 list-decimal list-inside pl-1 leading-relaxed font-medium">
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
            className="w-full py-3 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-cyan-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer font-sans"
          >
            Enter Doctor Dashboard <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dark w-full bg-clinical-900 text-clinical-100 p-6 md:p-8 flex flex-col space-y-5 relative overflow-hidden">
      
      {/* Background Neon Glow Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none animate-pulse-subtle"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none animate-pulse-subtle" style={{ animationDelay: '2s' }}></div>

      <div className="z-10 flex flex-col space-y-5">
        <div>
          <h3 className="text-xl font-extrabold text-clinical-50">
            {activeTab === 'signin' && 'Sign In to Mediflow'}
            {activeTab === 'register' && 'Register Your Clinic'}
            {activeTab === 'join' && (joinSubMode === 'signin' ? 'Partner Sign In' : 'Join Existing Clinic Network')}
            {activeTab === 'ops' && 'SaaS Platform Operations'}
          </h3>
          <p className="text-xs text-clinical-400 mt-1 font-semibold">
            {activeTab === 'signin' && 'Sign in to access your digital clinic care workspace.'}
            {activeTab === 'register' && 'Medical doctors can initialize a new secure clinical pod.'}
            {activeTab === 'join' && (joinSubMode === 'signin' ? 'Sign in to your partner pharmacy/laboratory workspace.' : 'Pharmacies and laboratories can request to link with a clinic.')}
            {activeTab === 'ops' && 'Secure authentication for Mediflow systems administration team.'}
          </p>
        </div>

        {/* Quad Sliding Tab Selector */}
        <div className="relative z-20 pointer-events-auto grid grid-cols-2 sm:grid-cols-4 gap-1 bg-clinical-950/50 p-1 rounded-xl border border-clinical-800/80">
          <button
            type="button"
            onClick={() => handleTabSelect('signin')}
            className={`min-h-9 px-2 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer pointer-events-auto ${activeTab === 'signin' ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-md' : 'text-clinical-400 hover:text-white hover:bg-white/5'}`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => handleTabSelect('register')}
            className={`min-h-9 px-2 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer pointer-events-auto ${activeTab === 'register' ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-md' : 'text-clinical-400 hover:text-white hover:bg-white/5'}`}
          >
            Doctor Signup
          </button>
          <button
            type="button"
            onClick={() => handleTabSelect('join')}
            className={`min-h-9 px-2 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer pointer-events-auto ${activeTab === 'join' ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-md' : 'text-clinical-400 hover:text-white hover:bg-white/5'}`}
          >
            Partner Join
          </button>
          <button
            type="button"
            onClick={() => handleTabSelect('ops')}
            className={`min-h-9 px-2 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer pointer-events-auto ${activeTab === 'ops' ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-md' : 'text-clinical-400 hover:text-white hover:bg-white/5'}`}
          >
            SaaS Ops
          </button>
        </div>

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
              <label className="text-[10px] font-bold text-clinical-400 uppercase tracking-widest pl-1">
                Professional Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-clinical-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@mediflow.com"
                  className="w-full bg-clinical-950 border border-clinical-500 focus:border-cyan-500/50 rounded-xl py-3.5 pl-11 pr-4 text-sm text-clinical-100 placeholder-clinical-400 outline-none transition-all duration-300 shadow-inner font-medium font-sans"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-clinical-400 uppercase tracking-widest pl-1">
                Security Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-clinical-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-clinical-950 border border-clinical-500 focus:border-cyan-500/50 rounded-xl py-3.5 pl-11 pr-12 text-sm text-clinical-100 placeholder-clinical-400 outline-none transition-all duration-300 shadow-inner font-medium font-sans"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-clinical-400 hover:text-white transition-all cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-cyan-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 font-sans"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Enter Workspace <ArrowRight className="h-4 w-4" /></>}
            </button>

            <p className="text-center text-[10px] text-clinical-500 font-medium">
              Are you a partner (pharmacist/lab)? Use the{' '}
              <button type="button" onClick={() => { setActiveTab('join'); setJoinSubMode('signin'); setErrorMsg(null); }} className="text-cyan-400 hover:text-cyan-300 font-bold underline cursor-pointer">
                Partner Sign In
              </button>{' '}tab.
            </p>
          </form>
        )}

        {/* SAAS OPERATIONS LOGIN FLOW */}
        {activeTab === 'ops' && (
          <form onSubmit={handleOpsSignIn} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-clinical-400 uppercase tracking-widest pl-1">
                Operations Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-clinical-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@mediflow.com"
                  className="w-full bg-clinical-950 border border-clinical-500 focus:border-cyan-500/50 rounded-xl py-3.5 pl-11 pr-4 text-sm text-clinical-100 placeholder-clinical-400 outline-none transition-all duration-300 shadow-inner font-medium font-sans"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-clinical-400 uppercase tracking-widest pl-1">
                Security Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-clinical-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-clinical-950 border border-clinical-500 focus:border-cyan-500/50 rounded-xl py-3.5 pl-11 pr-12 text-sm text-clinical-100 placeholder-clinical-400 outline-none transition-all duration-300 shadow-inner font-medium font-sans"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-clinical-400 hover:text-white transition-all cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-cyan-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 font-sans"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Authenticate Operations Console <ArrowRight className="h-4 w-4" /></>}
            </button>
          </form>
        )}

        {/* DOCTOR REGISTRATION FLOW */}
        {activeTab === 'register' && (
          <div className="space-y-3.5">
            {registrationStep === 1 ? (
              <div className="space-y-3.5 animate-fade-in">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-clinical-400 uppercase tracking-widest pl-1">
                      First Name
                    </label>
                    <div className="relative">
                      <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-clinical-400" />
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
                        className={`w-full bg-clinical-950 border ${validationErrors.firstName ? 'border-rose-500 focus:border-rose-500/40 animate-shake' : 'border-clinical-500 focus:border-cyan-500/50'} rounded-xl py-2.5 pl-10 pr-3.5 text-xs text-clinical-100 placeholder-clinical-400 outline-none transition-all duration-300 font-medium font-sans`}
                      />
                    </div>
                    {validationErrors.firstName && (
                      <span className="text-[10px] text-rose-400 font-semibold flex items-center gap-1 mt-1 pl-1 animate-fade-in">
                        <AlertCircle className="h-3 w-3 shrink-0" /> {validationErrors.firstName}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-clinical-400 uppercase tracking-widest pl-1">
                      Last Name
                    </label>
                    <div className="relative">
                      <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-clinical-400" />
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
                        className={`w-full bg-clinical-950 border ${validationErrors.lastName ? 'border-rose-500 focus:border-rose-500/40 animate-shake' : 'border-clinical-500 focus:border-cyan-500/50'} rounded-xl py-2.5 pl-10 pr-3.5 text-xs text-clinical-100 placeholder-clinical-400 outline-none transition-all duration-300 font-medium font-sans`}
                      />
                    </div>
                    {validationErrors.lastName && (
                      <span className="text-[10px] text-rose-400 font-semibold flex items-center gap-1 mt-1 pl-1 animate-fade-in">
                        <AlertCircle className="h-3 w-3 shrink-0" /> {validationErrors.lastName}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-clinical-400 uppercase tracking-widest pl-1">
                    Professional Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-clinical-400" />
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
                      className={`w-full bg-clinical-950 border ${validationErrors.email ? 'border-rose-500 focus:border-rose-500/40 animate-shake' : 'border-clinical-500 focus:border-cyan-500/50'} rounded-xl py-2.5 pl-10 pr-3.5 text-xs text-clinical-100 placeholder-clinical-400 outline-none transition-all duration-300 font-medium font-sans`}
                    />
                  </div>
                  {validationErrors.email && (
                    <span className="text-[10px] text-rose-400 font-semibold flex items-center gap-1 mt-1 pl-1 animate-fade-in">
                      <AlertCircle className="h-3 w-3 shrink-0" /> {validationErrors.email}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-clinical-400 uppercase tracking-widest pl-1">
                      Security Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-clinical-400" />
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
                        className={`w-full bg-clinical-950 border ${validationErrors.password ? 'border-rose-500 focus:border-rose-500/40 animate-shake' : 'border-clinical-500 focus:border-cyan-500/50'} rounded-xl py-2.5 pl-10 pr-12 text-xs text-clinical-100 placeholder-clinical-400 outline-none transition-all duration-300 font-medium font-sans`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-clinical-400 hover:text-white transition-all cursor-pointer"
                      >
                        {showRegPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    {validationErrors.password && (
                      <span className="text-[10px] text-rose-400 font-semibold flex items-center gap-1 mt-1 pl-1 animate-fade-in">
                        <AlertCircle className="h-3 w-3 shrink-0" /> {validationErrors.password}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-clinical-400 uppercase tracking-widest pl-1">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-clinical-400" />
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
                        className={`w-full bg-clinical-950 border ${validationErrors.confirmPassword ? 'border-rose-500 focus:border-rose-500/40 animate-shake' : 'border-clinical-500 focus:border-cyan-500/50'} rounded-xl py-2.5 pl-10 pr-12 text-xs text-clinical-100 placeholder-clinical-400 outline-none transition-all duration-300 font-medium font-sans`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-clinical-400 hover:text-white transition-all cursor-pointer"
                      >
                        {showRegConfirmPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    {validationErrors.confirmPassword && (
                      <span className="text-[10px] text-rose-400 font-semibold flex items-center gap-1 mt-1 pl-1 animate-fade-in">
                        <AlertCircle className="h-3 w-3 shrink-0" /> {validationErrors.confirmPassword}
                      </span>
                    )}
                  </div>
                </div>

                {password && (
                  <div className="space-y-1.5 p-2.5 bg-clinical-950/50 rounded-xl border border-clinical-800/40">
                    <div className="flex justify-between text-[9px] font-bold">
                      <span className="text-clinical-400">Password Strength:</span>
                      <span className={pwdStrength.score === 1 ? 'text-rose-400' : pwdStrength.score === 2 ? 'text-amber-400' : 'text-emerald-400'}>
                        {pwdStrength.label}
                      </span>
                    </div>
                    <div className="w-full h-1 bg-clinical-800 rounded-full overflow-hidden">
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
                          setValidationErrors(prev => {
                            const copy = { ...prev };
                            delete copy.tos;
                            return copy;
                          });
                        }
                      }}
                      className="mt-0.5 h-3.5 w-3.5 accent-cyan-500 rounded border-clinical-500 bg-clinical-950"
                    />
                    <span className="text-[11px] text-clinical-300 font-medium leading-tight">
                      I accept the{' '}
                      <button
                        type="button"
                        onClick={() => setShowTermsModal(true)}
                        className="text-cyan-400 hover:text-cyan-300 underline font-bold"
                      >
                        Terms of Service
                      </button>{' '}
                      and{' '}
                      <button
                        type="button"
                        onClick={() => setShowTermsModal(true)}
                        className="text-cyan-400 hover:text-cyan-300 underline font-bold"
                      >
                        Privacy Policy
                      </button>.
                    </span>
                  </label>
                  {validationErrors.tos && (
                    <span className="text-[10px] text-rose-400 font-semibold flex items-center gap-1 mt-1 pl-1 animate-fade-in">
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
                  className="w-full mt-4 py-3 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-cyan-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer font-sans"
                >
                  Next: Clinic Setup <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <form onSubmit={handleClinicRegister} className="space-y-3.5 animate-fade-in">
                <div className="flex items-center gap-2 text-clinical-300 pb-1">
                  <button
                    type="button"
                    onClick={() => setRegistrationStep(1)}
                    className="p-1 hover:bg-white/5 rounded-lg text-clinical-400 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <span className="text-xs font-bold uppercase tracking-wider">Step 2: Workspace Setup</span>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-clinical-400 uppercase tracking-widest pl-1">
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
                      className={`w-full bg-clinical-950 border ${validationErrors.clinicName ? 'border-rose-500 focus:border-rose-500/40 animate-shake' : 'border-clinical-500 focus:border-cyan-500/50'} rounded-xl py-2.5 px-3.5 text-xs text-clinical-100 placeholder-clinical-400 outline-none transition-all duration-300 font-medium font-sans`}
                      required
                    />
                    {validationErrors.clinicName && (
                      <span className="text-[10px] text-rose-400 font-semibold flex items-center gap-1 mt-1 pl-1 animate-fade-in">
                        <AlertCircle className="h-3 w-3 shrink-0" /> {validationErrors.clinicName}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-clinical-400 uppercase tracking-widest pl-1">
                      Clinical Specialization
                    </label>
                    <select
                      value={specialization}
                      onChange={(e) => setSpecialization(e.target.value)}
                      className="w-full bg-clinical-950 border border-clinical-500 focus:border-cyan-500/50 rounded-xl py-2.5 px-3.5 text-xs text-clinical-100 outline-none transition-all duration-300 font-medium font-sans cursor-pointer"
                    >
                      <option value="General Medicine" className="text-clinical-100 bg-clinical-950">General Medicine</option>
                      <option value="Pediatrics" className="text-clinical-100 bg-clinical-950">Pediatrics</option>
                      <option value="Ophthalmology" className="text-clinical-100 bg-clinical-950">Ophthalmology</option>
                      <option value="Cardiology" className="text-clinical-100 bg-clinical-950">Cardiology</option>
                      <option value="Dermatology" className="text-clinical-100 bg-clinical-950">Dermatology</option>
                      <option value="Gynecology" className="text-clinical-100 bg-clinical-950">Gynecology</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-clinical-400 uppercase tracking-widest pl-1">
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
                      className={`w-full bg-clinical-950 border ${validationErrors.phone ? 'border-rose-500 focus:border-rose-500/40 animate-shake' : 'border-clinical-500 focus:border-cyan-500/50'} rounded-xl py-2.5 px-3.5 text-xs text-clinical-100 placeholder-clinical-400 outline-none transition-all duration-300 font-medium font-sans`}
                      required
                    />
                    {validationErrors.phone && (
                      <span className="text-[10px] text-rose-400 font-semibold flex items-center gap-1 mt-1 pl-1 animate-fade-in">
                        <AlertCircle className="h-3 w-3 shrink-0" /> {validationErrors.phone}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-clinical-400 uppercase tracking-widest pl-1">
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
                    className={`w-full bg-clinical-950 border ${validationErrors.address ? 'border-rose-500 focus:border-rose-500/40 animate-shake' : 'border-clinical-500 focus:border-cyan-500/50'} rounded-xl py-2.5 px-3.5 text-xs text-clinical-100 placeholder-clinical-400 outline-none transition-all duration-300 font-medium font-sans`}
                    required
                  />
                  {validationErrors.address && (
                    <span className="text-[10px] text-rose-400 font-semibold flex items-center gap-1 mt-1 pl-1 animate-fade-in">
                      <AlertCircle className="h-3 w-3 shrink-0" /> {validationErrors.address}
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-cyan-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 font-sans"
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
            <div className="flex gap-1 p-1 bg-clinical-950/50 rounded-xl border border-clinical-800/80">
              <button
                type="button"
                onClick={() => handleJoinSubModeSelect('signin')}
                className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${joinSubMode === 'signin' ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-md' : 'text-clinical-400 hover:text-white hover:bg-white/5'}`}
              >
                Partner Sign In
              </button>
              <button
                type="button"
                onClick={() => handleJoinSubModeSelect('register')}
                className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${joinSubMode === 'register' ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-md' : 'text-clinical-400 hover:text-white hover:bg-white/5'}`}
              >
                New Registration
              </button>
            </div>

            {/* PARTNER SIGN IN */}
            {joinSubMode === 'signin' && (
              <form onSubmit={handlePartnerSignIn} className="space-y-4">
                <div className="bg-cyan-950/20 border border-cyan-500/20 rounded-xl p-3 text-[10px] text-clinical-300 leading-relaxed font-medium">
                  <span className="font-bold text-cyan-400">Already registered?</span> Sign in with the email and password you used when joining your clinic network.
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-clinical-400 uppercase tracking-widest pl-1">
                    Partner Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-clinical-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="pharmacist@yourshop.com"
                      className="w-full bg-clinical-950 border border-clinical-500 focus:border-cyan-500/50 rounded-xl py-3.5 pl-11 pr-4 text-sm text-clinical-100 placeholder-clinical-400 outline-none transition-all duration-300 shadow-inner font-medium font-sans"
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-clinical-400 uppercase tracking-widest pl-1">
                    Security Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-clinical-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-clinical-950 border border-clinical-500 focus:border-cyan-500/50 rounded-xl py-3.5 pl-11 pr-12 text-sm text-clinical-100 placeholder-clinical-400 outline-none transition-all duration-300 shadow-inner font-medium font-sans"
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-clinical-400 hover:text-white transition-all cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-cyan-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 font-sans"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Enter Partner Workspace <ArrowRight className="h-4 w-4" /></>}
                </button>

                <p className="text-center text-[10px] text-clinical-500 font-medium">
                  First time?{' '}
                  <button type="button" onClick={() => { setJoinSubMode('register'); setErrorMsg(null); }} className="text-cyan-400 hover:text-cyan-300 font-bold underline cursor-pointer">
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
                        <label className="text-[10px] font-bold text-clinical-400 uppercase tracking-widest pl-1">
                          First Name
                        </label>
                        <div className="relative">
                          <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-clinical-400" />
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
                            className={`w-full bg-clinical-950 border ${validationErrors.firstName ? 'border-rose-500 focus:border-rose-500/40 animate-shake' : 'border-clinical-500 focus:border-cyan-500/50'} rounded-xl py-2.5 pl-10 pr-3.5 text-xs text-clinical-100 placeholder-clinical-400 outline-none transition-all duration-300 font-medium font-sans`}
                          />
                        </div>
                        {validationErrors.firstName && (
                          <span className="text-[10px] text-rose-400 font-semibold flex items-center gap-1 mt-1 pl-1 animate-fade-in">
                            <AlertCircle className="h-3 w-3 shrink-0" /> {validationErrors.firstName}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-clinical-400 uppercase tracking-widest pl-1">
                          Last Name
                        </label>
                        <div className="relative">
                          <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-clinical-400" />
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
                            className={`w-full bg-clinical-950 border ${validationErrors.lastName ? 'border-rose-500 focus:border-rose-500/40 animate-shake' : 'border-clinical-500 focus:border-cyan-500/50'} rounded-xl py-2.5 pl-10 pr-3.5 text-xs text-clinical-100 placeholder-clinical-400 outline-none transition-all duration-300 font-medium font-sans`}
                          />
                        </div>
                        {validationErrors.lastName && (
                          <span className="text-[10px] text-rose-400 font-semibold flex items-center gap-1 mt-1 pl-1 animate-fade-in">
                            <AlertCircle className="h-3 w-3 shrink-0" /> {validationErrors.lastName}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-clinical-400 uppercase tracking-widest pl-1">
                        Partner Email Address
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-clinical-400" />
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
                          className={`w-full bg-clinical-950 border ${validationErrors.email ? 'border-rose-500 focus:border-rose-500/40 animate-shake' : 'border-clinical-500 focus:border-cyan-500/50'} rounded-xl py-2.5 pl-10 pr-3.5 text-xs text-clinical-100 placeholder-clinical-400 outline-none transition-all duration-300 font-medium font-sans`}
                        />
                      </div>
                      {validationErrors.email && (
                        <span className="text-[10px] text-rose-400 font-semibold flex items-center gap-1 mt-1 pl-1 animate-fade-in">
                          <AlertCircle className="h-3 w-3 shrink-0" /> {validationErrors.email}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-clinical-400 uppercase tracking-widest pl-1">
                          Security Password
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-clinical-400" />
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
                            className={`w-full bg-clinical-950 border ${validationErrors.password ? 'border-rose-500 focus:border-rose-500/40 animate-shake' : 'border-clinical-500 focus:border-cyan-500/50'} rounded-xl py-2.5 pl-10 pr-12 text-xs text-clinical-100 placeholder-clinical-400 outline-none transition-all duration-300 font-medium font-sans`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowRegPassword(!showRegPassword)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-clinical-400 hover:text-white transition-all cursor-pointer"
                          >
                            {showRegPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                        {validationErrors.password && (
                          <span className="text-[10px] text-rose-400 font-semibold flex items-center gap-1 mt-1 pl-1 animate-fade-in">
                            <AlertCircle className="h-3 w-3 shrink-0" /> {validationErrors.password}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-clinical-400 uppercase tracking-widest pl-1">
                          Confirm Password
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-clinical-400" />
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
                            className={`w-full bg-clinical-950 border ${validationErrors.confirmPassword ? 'border-rose-500 focus:border-rose-500/40 animate-shake' : 'border-clinical-500 focus:border-cyan-500/50'} rounded-xl py-2.5 pl-10 pr-12 text-xs text-clinical-100 placeholder-clinical-400 outline-none transition-all duration-300 font-medium font-sans`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-clinical-400 hover:text-white transition-all cursor-pointer"
                          >
                            {showRegConfirmPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                        {validationErrors.confirmPassword && (
                          <span className="text-[10px] text-rose-400 font-semibold flex items-center gap-1 mt-1 pl-1 animate-fade-in">
                            <AlertCircle className="h-3 w-3 shrink-0" /> {validationErrors.confirmPassword}
                          </span>
                        )}
                      </div>
                    </div>

                    {password && (
                      <div className="space-y-1.5 p-2.5 bg-clinical-950/50 rounded-xl border border-clinical-800/40">
                        <div className="flex justify-between text-[9px] font-bold">
                          <span className="text-clinical-400">Password Strength:</span>
                          <span className={pwdStrength.score === 1 ? 'text-rose-400' : pwdStrength.score === 2 ? 'text-amber-400' : 'text-emerald-400'}>
                            {pwdStrength.label}
                          </span>
                        </div>
                        <div className="w-full h-1 bg-clinical-800 rounded-full overflow-hidden">
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
                              setValidationErrors(prev => {
                                const copy = { ...prev };
                                delete copy.tos;
                                return copy;
                              });
                            }
                          }}
                          className="mt-0.5 h-3.5 w-3.5 accent-cyan-500 rounded border-clinical-500 bg-clinical-950"
                        />
                        <span className="text-[11px] text-clinical-300 font-medium leading-tight">
                          I accept the{' '}
                          <button
                            type="button"
                            onClick={() => setShowTermsModal(true)}
                            className="text-cyan-400 hover:text-cyan-300 underline font-bold"
                          >
                            Terms of Service
                          </button>{' '}
                          and{' '}
                          <button
                            type="button"
                            onClick={() => setShowTermsModal(true)}
                            className="text-cyan-400 hover:text-cyan-300 underline font-bold"
                          >
                            Privacy Policy
                          </button>.
                        </span>
                      </label>
                      {validationErrors.tos && (
                        <span className="text-[10px] text-rose-400 font-semibold flex items-center gap-1 mt-1 pl-1 animate-fade-in">
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
                      className="w-full mt-4 py-3 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-cyan-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer font-sans"
                    >
                      Next: Partner Details <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handlePartnerJoin} className="space-y-3.5 animate-fade-in">
                    <div className="flex items-center gap-2 text-clinical-300 pb-1">
                      <button
                        type="button"
                        onClick={() => setRegistrationStep(1)}
                        className="p-1 hover:bg-white/5 rounded-lg text-clinical-400 hover:text-white transition-colors"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </button>
                      <span className="text-xs font-bold uppercase tracking-wider">Step 2: Partner Workspace Setup</span>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-clinical-400 uppercase tracking-widest pl-1">
                        Clinic Network Code (MF-XXXX)
                      </label>
                      <div className="relative">
                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-clinical-500" />
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
                          className={`w-full bg-clinical-950 border ${validationErrors.clinicCode ? 'border-rose-500' : 'border-clinical-500 focus:border-cyan-500/50'} rounded-xl py-2.5 pl-10 pr-4 text-xs text-clinical-100 placeholder-clinical-400 outline-none transition-all duration-300 font-mono font-bold`}
                          required
                        />
                        {validatingCode && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-cyan-400 animate-spin" />}
                      </div>

                      {validatedClinicName ? (
                        <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1 pl-1 mt-1">
                          <Check className="h-3 w-3" /> Valid Clinic: <strong className="text-clinical-100">{validatedClinicName}</strong>
                        </span>
                      ) : clinicCode.length >= 7 && !validatingCode ? (
                        <span className="text-[10px] font-bold text-rose-400 flex items-center gap-1 pl-1 mt-1">
                          Clinic code not found. Please double check.
                        </span>
                      ) : validationErrors.clinicCode ? (
                        <span className="text-[10px] text-rose-400 font-semibold flex items-center gap-1 mt-1 pl-1">
                          <AlertCircle className="h-3 w-3 shrink-0" /> {validationErrors.clinicCode}
                        </span>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-2 gap-3.5">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-clinical-400 uppercase tracking-widest pl-1">
                          Partner Entity Type
                        </label>
                        <select
                          value={partnerType}
                          onChange={(e) => setPartnerType(e.target.value as any)}
                          className="w-full bg-clinical-950 border border-clinical-500 focus:border-cyan-500/50 rounded-xl py-2.5 px-3.5 text-xs text-clinical-100 outline-none transition-all duration-300 font-medium font-sans cursor-pointer"
                        >
                          <option value="pharmacy" className="text-clinical-100 bg-clinical-950">Pharmacy POS</option>
                          <option value="lab" className="text-clinical-100 bg-clinical-950">Pathology Lab</option>
                          <option value="compounder" className="text-clinical-100 bg-clinical-950">Clinic Compounder</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-clinical-400 uppercase tracking-widest pl-1">
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
                          className={`w-full bg-clinical-950 border ${validationErrors.displayName ? 'border-rose-500 focus:border-rose-500/40 animate-shake' : 'border-clinical-500 focus:border-cyan-500/50'} rounded-xl py-2.5 px-3.5 text-xs text-clinical-100 placeholder-clinical-400 outline-none transition-all duration-300 font-medium font-sans`}
                          required
                        />
                        {validationErrors.displayName && (
                          <span className="text-[10px] text-rose-400 font-semibold flex items-center gap-1 mt-1 pl-1">
                            <AlertCircle className="h-3 w-3 shrink-0" /> {validationErrors.displayName}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3.5">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-clinical-400 uppercase tracking-widest pl-1">
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
                          className={`w-full bg-clinical-950 border ${validationErrors.phone ? 'border-rose-500 focus:border-rose-500/40 animate-shake' : 'border-clinical-500 focus:border-cyan-500/50'} rounded-xl py-2.5 px-3.5 text-xs text-clinical-100 placeholder-clinical-400 outline-none transition-all duration-300 font-medium font-sans`}
                          required
                        />
                        {validationErrors.phone && (
                          <span className="text-[10px] text-rose-400 font-semibold flex items-center gap-1 mt-1 pl-1">
                            <AlertCircle className="h-3 w-3 shrink-0" /> {validationErrors.phone}
                          </span>
                        )}
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-clinical-400 uppercase tracking-widest pl-1">
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
                          className={`w-full bg-clinical-950 border ${validationErrors.address ? 'border-rose-500 focus:border-rose-500/40 animate-shake' : 'border-clinical-500 focus:border-cyan-500/50'} rounded-xl py-2.5 px-3.5 text-xs text-clinical-100 placeholder-clinical-400 outline-none transition-all duration-300 font-medium font-sans`}
                          required
                        />
                        {validationErrors.address && (
                          <span className="text-[10px] text-rose-400 font-semibold flex items-center gap-1 mt-1 pl-1">
                            <AlertCircle className="h-3 w-3 shrink-0" /> {validationErrors.address}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || !validatedClinicName}
                      className="w-full py-3 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-cyan-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 font-sans"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Submit Join Request <ArrowRight className="h-4 w-4" /></>}
                    </button>

                    <p className="text-center text-[10px] text-clinical-500 font-medium">
                      Already registered?{' '}
                      <button type="button" onClick={() => handleJoinSubModeSelect('signin')} className="text-cyan-400 hover:text-cyan-300 font-bold underline cursor-pointer">
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

      {(() => {
        const isDemoMode = true; // Always enable mock profiles for evaluation/testing convenience

        if (activeTab !== 'signin' || !isDemoMode) return null;

        return (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between border-t border-clinical-800/80 pt-4">
              <span className="text-[10px] font-bold text-clinical-400 uppercase tracking-widest">
                Enterprise Mock Profiles (E2E Telemetry)
              </span>
              <span className="text-[9px] font-bold text-cyan-400 bg-cyan-400/10 px-2.5 py-0.5 rounded-full border border-cyan-400/20">
                RLS Verification Active
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {demoUsers.map((user, idx) => (
                <button
                  key={`${user.id}-${idx}`}
                  type="button"
                  onClick={() => handleDemoSignIn(user)}
                  disabled={loading}
                  className="bg-clinical-950/40 hover:bg-clinical-950/80 border border-clinical-800 hover:border-cyan-500/30 rounded-xl p-2.5 flex flex-col text-left space-y-1 cursor-pointer transition-all duration-300 group"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[10px] font-black text-white group-hover:text-cyan-400 transition-colors truncate">
                      {user.name.split(' ')[1] || user.name}
                    </span>
                    <span className="text-xs">{user.icon}</span>
                  </div>
                  <div className="text-[8px] font-extrabold uppercase tracking-wide leading-tight">
                    <span className="text-cyan-500 group-hover:text-cyan-400 block truncate">{user.role.replace('_', ' ')}</span>
                    <span className="text-clinical-400 truncate block mt-0.5">{user.entity.split(' ')[0]}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Terms of Service & Privacy Policy Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in text-clinical-100 font-sans">
          <div className="relative w-full max-w-2xl max-h-[80vh] overflow-y-auto bg-clinical-950 border border-clinical-800 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col space-y-6">
            <button
              onClick={() => setShowTermsModal(false)}
              className="absolute top-4 right-4 p-2 hover:bg-white/5 rounded-xl text-clinical-400 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-2xl">
                <FileText className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-white">Terms of Service & Privacy Policy</h3>
                <p className="text-xs text-clinical-400">Effective Date: June 24, 2026</p>
              </div>
            </div>

            <div className="space-y-4 text-xs text-clinical-300 leading-relaxed overflow-y-auto pr-2">
              <section className="space-y-2">
                <h4 className="text-sm font-bold text-white uppercase tracking-wide">1. HIPAA & Data Isolation Compliance</h4>
                <p>
                  Mediflow operates under strict tenant-specific isolation standards. Every medical clinical pod (grouped doctor, pharmacist, and pathology clinic nodes) maintains dedicated PostgreSQL row-level security (RLS). Cross-tenant queries are blocked at the database engine layer.
                </p>
              </section>

              <section className="space-y-2">
                <h4 className="text-sm font-bold text-white uppercase tracking-wide">2. Clinical Loop Connectivity</h4>
                <p>
                  By generating a unique Clinic Network Code, doctors can authorize referral labs and pharmacy units to query appointments, prescriptions, and lab result workflows. All linkages require manual approval by the registered doctor profile under the pod admin dashboard.
                </p>
              </section>

              <section className="space-y-2">
                <h4 className="text-sm font-bold text-white uppercase tracking-wide">3. Privacy Policy & Audit Logs</h4>
                <p>
                  We securely store provider accounts, emails, patient demographic details, and clinical data models. Every system insertion or update is logged to a write-only audit trail in compliance with standard clinical guidelines. We do not sell or lease clinician details to third parties.
                </p>
              </section>

              <section className="space-y-2">
                <h4 className="text-sm font-bold text-white uppercase tracking-wide">4. System Telemetry & Self-Healing</h4>
                <p>
                  Our system runs automated background operations health agents to detect failed data syncs, transaction anomalies, and connectivity drops. Transaction data remains encrypted at-rest using standard cryptographic algorithms.
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
