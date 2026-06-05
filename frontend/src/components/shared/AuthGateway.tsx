import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { 
  Shield, Mail, ArrowRight, Activity, Lock, Eye, EyeOff, Loader2,
  Building2, Key, Copy, Check, Sparkles
} from 'lucide-react';
import { BrandMark } from './BrandMark';

interface AuthGatewayProps {
  onAuthSuccess: (session: any, profile: any) => void;
}

export const AuthGateway: React.FC<AuthGatewayProps> = ({ onAuthSuccess }) => {
  const [activeTab, setActiveTab] = useState<'signin' | 'register' | 'join'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Common Registration states
  const [displayName, setDisplayName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

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

  // Success States
  const [registeredClinicCode, setRegisteredClinicCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Pre-seeded Enterprise Demo Roles for E2E testing
  const demoUsers = [
    {
      id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101',
      name: 'Dr. Vivek Kumar',
      role: 'doctor',
      entity: 'Kankarbagh Connected Clinic',
      icon: '🏥',
      specialization: 'General Medicine'
    },
    {
      id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317102',
      name: 'Lalit Prasad',
      role: 'lab_technician',
      entity: 'Patna Central Pathology Lab',
      icon: '🧪',
      specialization: 'General Medicine'
    },
    {
      id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317103',
      name: 'Prakash Yadav',
      role: 'pharmacist',
      entity: 'Kankarbagh Smart Pharmacy',
      icon: '💊',
      specialization: 'General Medicine'
    },
    {
      id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101',
      name: 'Dr. Amit Arya',
      role: 'doctor',
      entity: 'Patna Eye Care Center',
      icon: '👁️',
      specialization: 'Ophthalmology'
    },
    {
      id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317102',
      name: 'Karan Johar',
      role: 'lab_technician',
      entity: 'Patna Eye Diagnostics',
      icon: '🔬',
      specialization: 'Ophthalmology'
    },
    {
      id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317103',
      name: 'Suresh Raina',
      role: 'pharmacist',
      entity: 'Patna Optical Shop',
      icon: '👓',
      specialization: 'Ophthalmology'
    },
    {
      id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317109',
      name: 'System Admin',
      role: 'platform_admin',
      entity: 'Mediflow HQ Operations',
      icon: '🔑',
      specialization: 'System Engineering'
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

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
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
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (profileErr) throw profileErr;
        
        onAuthSuccess(data.session, profile);
      }
    } catch (err: any) {
      console.error('[Mediflow Auth] Login failed:', err);
      setErrorMsg(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleClinicRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !confirmPassword || !displayName || !clinicName || !phone || !address) {
      setErrorMsg('Please populate all clinic registration fields.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      // 1. Perform auth signUp
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            display_name: displayName,
            role: 'doctor',
            clinic_name: clinicName.trim(),
            clinic_phone: phone.trim(),
            clinic_address: address.trim(),
            specialization: specialization,
            pending_registration: true
          }
        }
      });

      if (authError) throw authError;
      if (!authData?.user) {
        throw new Error('SignUp completed, but email confirmation is required. Please check your email or ensure that "Confirm email" is disabled in your Supabase Auth settings under Providers -> Email.');
      }

      if (!authData.session) {
        throw new Error('SignUp completed, but email confirmation is required. Please check your email or ensure that "Confirm email" is disabled in your Supabase Auth settings under Providers -> Email.');
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
      setRegisteredClinicCode(rpcData.clinic_code);

      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Clinic Registered successfully! 🎉',
          message: `Welcome ${displayName}! Your clinical network code is active.`,
          type: 'success'
        }
      }));

    } catch (err: any) {
      console.error('[Mediflow Auth] Clinic registration failed:', err);
      setErrorMsg(err.message || 'Clinic registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handlePartnerJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !confirmPassword || !displayName || !clinicCode || !phone || !address) {
      setErrorMsg('Please populate all partner registration fields.');
      return;
    }

    if (!validatedClinicName) {
      setErrorMsg('Please enter a valid Clinic Network Code before proceeding.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      // 1. Perform auth signUp
      const userRole = partnerType === 'pharmacy' ? 'pharmacist' : partnerType === 'lab' ? 'lab_technician' : 'compounder';
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            display_name: displayName,
            role: userRole,
            clinic_code: clinicCode.trim().toUpperCase(),
            partner_type: partnerType,
            partner_phone: phone.trim(),
            partner_address: address.trim(),
            pending_registration: true
          }
        }
      });

      if (authError) throw authError;
      if (!authData?.user) {
        throw new Error('SignUp completed, but email confirmation is required. Please check your email or ensure that "Confirm email" is disabled in your Supabase Auth settings under Providers -> Email.');
      }

      if (!authData.session) {
        throw new Error('SignUp completed, but email confirmation is required. Please check your email or ensure that "Confirm email" is disabled in your Supabase Auth settings under Providers -> Email.');
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
      console.error('[Mediflow Auth] Partner join failed:', err);
      setErrorMsg(err.message || 'Partner registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSignIn = async (user: typeof demoUsers[0]) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      let authEmail = '';
      if (user.role === 'doctor') authEmail = 'doctor@mediflow.com';
      else if (user.role === 'lab_technician') authEmail = 'labtech@mediflow.com';
      else if (user.role === 'pharmacist') authEmail = 'pharmacist@mediflow.com';
      else if (user.role === 'platform_admin') authEmail = 'owner@mediflow.com';

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: 'password123'
      });

      if (authError) throw authError;

      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileErr) throw profileErr;

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

      onAuthSuccess(authData.session, modifiedProfile);
    } catch (err: any) {
      setErrorMsg(err.message || 'Demo profile loading failed.');
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

  // If a clinic was successfully registered, render the celebration screen!
  if (registeredClinicCode) {
    return (
      <div className="min-h-screen bg-clinical-900 text-clinical-100 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none animate-pulse-subtle"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none animate-pulse-subtle"></div>

        <div className="w-full max-w-lg glass-panel p-8 shadow-xl flex flex-col space-y-6 text-center z-10 animate-fade-in">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Sparkles className="h-8 w-8 text-cyan-400 animate-pulse-subtle" />
          </div>

          <div className="space-y-2">
            <h3 className="text-2xl font-extrabold text-white">Clinic Network Registered!</h3>
            <p className="text-sm text-clinical-300">
              Your multi-tenant workspace clinic node is now live. Share the unique code below with your partner pharmacy and laboratory to link them.
            </p>
          </div>

          <div className="bg-clinical-900/80 border border-clinical-800 rounded-2xl p-6 space-y-4">
            <span className="text-[10px] font-bold text-clinical-400 uppercase tracking-widest block">
              Unique Clinic Network Code
            </span>
            <div className="flex items-center justify-center gap-3">
              <span className="text-4xl font-black tracking-wider text-white font-mono bg-slate-800/40 px-6 py-2.5 rounded-xl border border-clinical-800">
                {registeredClinicCode}
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="p-3 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 rounded-xl transition-all hover:scale-105 cursor-pointer"
                title="Copy Clinic Code"
              >
                {copiedCode ? <Check className="h-5 w-5 text-emerald-400" /> : <Copy className="h-5 w-5" />}
              </button>
            </div>
            {copiedCode && <span className="text-xs text-emerald-400 font-bold block animate-fade-in">Copied to clipboard!</span>}
          </div>

          <div className="text-left bg-cyan-950/20 border border-cyan-500/20 rounded-xl p-4 space-y-2.5">
            <h4 className="text-xs font-bold text-cyan-400 flex items-center gap-2">
              <Shield className="h-4 w-4" /> Next Onboarding Steps:
            </h4>
            <ul className="text-xs text-clinical-300 space-y-1.5 list-decimal list-inside pl-1 leading-relaxed">
              <li>Copy the unique code above: <strong className="text-white">{registeredClinicCode}</strong></li>
              <li>Share it with your partner Pharmacy and Lab staff</li>
              <li>When they register using this code, approve their requests in your clinic dashboard</li>
              <li>Your unified, split-billing digital care loop will immediately link together</li>
            </ul>
          </div>

          <button
            type="button"
            onClick={async () => {
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
            className="w-full py-4 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-cyan-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer font-sans"
          >
            Enter Doctor Dashboard <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-clinical-900 text-clinical-100 flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Background Neon Glow Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none animate-pulse-subtle"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none animate-pulse-subtle" style={{ animationDelay: '2s' }}></div>

      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-12 gap-8 items-center z-10">
        
        {/* Left Side: Brand Value Proposition */}
        <div className="md:col-span-5 flex flex-col justify-center text-left space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-white p-1 shrink-0 shadow-lg ring-1 ring-slate-200/80">
              <BrandMark size={44} title="Mediflow Care logo" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-indigo-400 font-sans">
                MEDIFLOW
              </h1>
              <p className="text-[10px] tracking-[0.2em] font-extrabold text-cyan-500 uppercase">
                MULTI-TENANT SAAS PLATFORM
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-3xl font-extrabold tracking-tight text-clinical-50 leading-tight">
              Clinical Care Networks, Re-imagined.
            </h2>
            <p className="text-sm text-clinical-300 leading-relaxed font-medium">
              A state-of-the-art multi-tenant ecosystem connecting independent clinics, adjacent pharmacies, and referral pathology labs under one secure, split-billed digital workflow.
            </p>
          </div>

          <div className="space-y-3.5 border-l-2 border-cyan-500/30 pl-4 py-1 text-xs text-clinical-400 font-medium leading-relaxed">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-cyan-400 flex-shrink-0" />
              <span>Hardened multi-tenant Row-Level Security isolation</span>
            </div>
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-cyan-400 flex-shrink-0" />
              <span>Safe Clinic network generation & manual partner approvals</span>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-cyan-400 flex-shrink-0" />
              <span>One Clinic = One Pharmacy + One Lab clinical pod grouping</span>
            </div>
          </div>
        </div>

        {/* Right Side: Authentication/Onboarding Panel */}
        <div className="md:col-span-7 glass-panel p-8 shadow-xl flex flex-col space-y-5">
          <div>
            <h3 className="text-xl font-extrabold text-clinical-50">
              {activeTab === 'signin' && 'Sign In to Mediflow'}
              {activeTab === 'register' && 'Register Your Clinic'}
              {activeTab === 'join' && 'Join Existing Clinic Network'}
            </h3>
            <p className="text-xs text-clinical-400 mt-1 font-semibold">
              {activeTab === 'signin' && 'Sign in to access your digital clinic care workspace.'}
              {activeTab === 'register' && 'Medical doctors can initialize a new secure clinical pod.'}
              {activeTab === 'join' && 'Pharmacies and laboratories can request to link with a clinic.'}
            </p>
          </div>

          {/* Triple Sliding Tab Selector */}
          <div className="flex bg-clinical-900/50 p-1 rounded-xl border border-clinical-800/80">
            <button
              type="button"
              onClick={() => { setActiveTab('signin'); setErrorMsg(null); }}
              className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${activeTab === 'signin' ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-md' : 'text-clinical-400 hover:text-white hover:bg-white/5'}`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('register'); setErrorMsg(null); }}
              className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${activeTab === 'register' ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-md' : 'text-clinical-400 hover:text-white hover:bg-white/5'}`}
            >
              Doctor Signup
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('join'); setErrorMsg(null); }}
              className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${activeTab === 'join' ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-md' : 'text-clinical-400 hover:text-white hover:bg-white/5'}`}
            >
              Partner Join
            </button>
          </div>

          {errorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3.5 flex items-start gap-3 animate-shake">
              <Shield className="h-5 w-5 text-rose-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs font-semibold text-rose-300 leading-relaxed">{errorMsg}</div>
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
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-clinical-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@mediflow.com"
                    className="w-full bg-clinical-900/50 border border-clinical-500 focus:border-cyan-500/50 rounded-xl py-3.5 pl-11 pr-4 text-sm text-clinical-100 placeholder-clinical-400 outline-none transition-all duration-300 shadow-inner font-medium font-sans"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-clinical-400 uppercase tracking-widest pl-1">
                  Security Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-clinical-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-clinical-900/50 border border-clinical-500 focus:border-cyan-500/50 rounded-xl py-3.5 pl-11 pr-12 text-sm text-clinical-100 placeholder-clinical-400 outline-none transition-all duration-300 shadow-inner font-medium font-sans"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-clinical-500 hover:text-white transition-all cursor-pointer"
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
            </form>
          )}

          {/* DOCTOR REGISTRATION FLOW */}
          {activeTab === 'register' && (
            <form onSubmit={handleClinicRegister} className="space-y-3.5 max-h-[380px] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-clinical-400 uppercase tracking-widest pl-1">
                    Doctor Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Dr. Vivek Kumar"
                    className="w-full bg-clinical-900/50 border border-clinical-500 focus:border-cyan-500/50 rounded-xl py-2.5 px-3.5 text-xs text-clinical-100 placeholder-clinical-400 outline-none transition-all duration-300 font-medium font-sans"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-clinical-400 uppercase tracking-widest pl-1">
                    Clinic Business Name
                  </label>
                  <input
                    type="text"
                    value={clinicName}
                    onChange={(e) => setClinicName(e.target.value)}
                    placeholder="Kankarbagh Connected Clinic"
                    className="w-full bg-clinical-900/50 border border-clinical-500 focus:border-cyan-500/50 rounded-xl py-2.5 px-3.5 text-xs text-clinical-100 placeholder-clinical-400 outline-none transition-all duration-300 font-medium font-sans"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-clinical-400 uppercase tracking-widest pl-1">
                    Clinical Specialization
                  </label>
                  <select
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    className="w-full bg-clinical-900/90 border border-clinical-500 focus:border-cyan-500/50 rounded-xl py-2.5 px-3.5 text-xs text-clinical-100 outline-none transition-all duration-300 font-medium font-sans"
                  >
                    <option value="General Medicine" className="text-clinical-100 bg-clinical-800">General Medicine</option>
                    <option value="Pediatrics" className="text-clinical-100 bg-clinical-800">Pediatrics</option>
                    <option value="Ophthalmology" className="text-clinical-100 bg-clinical-800">Ophthalmology</option>
                    <option value="Cardiology" className="text-clinical-100 bg-clinical-800">Cardiology</option>
                    <option value="Dermatology" className="text-clinical-100 bg-clinical-800">Dermatology</option>
                    <option value="Gynecology" className="text-clinical-100 bg-clinical-800">Gynecology</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-clinical-400 uppercase tracking-widest pl-1">
                    Contact Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="9999000001"
                    className="w-full bg-clinical-900/50 border border-clinical-500 focus:border-cyan-500/50 rounded-xl py-2.5 px-3.5 text-xs text-clinical-100 placeholder-clinical-400 outline-none transition-all duration-300 font-medium font-sans"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-clinical-400 uppercase tracking-widest pl-1">
                  Clinic Physical Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Main Road, Kankarbagh, Patna, Bihar"
                  className="w-full bg-clinical-900/50 border border-clinical-500 focus:border-cyan-500/50 rounded-xl py-2.5 px-3.5 text-xs text-clinical-100 placeholder-clinical-400 outline-none transition-all duration-300 font-medium font-sans"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-clinical-400 uppercase tracking-widest pl-1">
                  Doctor Login Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="doctor@mediflow.com"
                  className="w-full bg-clinical-900/50 border border-clinical-500 focus:border-cyan-500/50 rounded-xl py-2.5 px-3.5 text-xs text-clinical-100 placeholder-clinical-400 outline-none transition-all duration-300 font-medium font-sans"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-clinical-400 uppercase tracking-widest pl-1">
                    Security Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-clinical-900/50 border border-clinical-500 focus:border-cyan-500/50 rounded-xl py-2.5 px-3.5 text-xs text-clinical-100 placeholder-clinical-400 outline-none transition-all duration-300 font-medium font-sans"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-clinical-400 uppercase tracking-widest pl-1">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-clinical-900/50 border border-clinical-500 focus:border-cyan-500/50 rounded-xl py-2.5 px-3.5 text-xs text-clinical-100 placeholder-clinical-400 outline-none transition-all duration-300 font-medium font-sans"
                    required
                  />
                </div>
              </div>

              {password && (
                <div className="space-y-1.5 p-2.5 bg-clinical-900/30 rounded-xl border border-clinical-800/40">
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

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-cyan-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 font-sans"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Register Clinic Network <ArrowRight className="h-4 w-4" /></>}
              </button>
            </form>
          )}

          {/* PARTNER JOIN FLOW */}
          {activeTab === 'join' && (
            <form onSubmit={handlePartnerJoin} className="space-y-3.5 max-h-[380px] overflow-y-auto pr-1">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-clinical-400 uppercase tracking-widest pl-1">
                  Clinic Network Code (MF-XXXX)
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-clinical-500" />
                  <input
                    type="text"
                    value={clinicCode}
                    onChange={(e) => setClinicCode(e.target.value.toUpperCase())}
                    placeholder="MF-A1B2"
                    maxLength={10}
                    className="w-full bg-clinical-900/50 border border-clinical-500 focus:border-cyan-500/50 rounded-xl py-2.5 pl-10 pr-4 text-xs text-clinical-100 placeholder-clinical-400 outline-none transition-all duration-300 font-mono font-bold"
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
                    className="w-full bg-clinical-900/90 border border-clinical-500 focus:border-cyan-500/50 rounded-xl py-2.5 px-3.5 text-xs text-clinical-100 outline-none transition-all duration-300 font-medium font-sans"
                  >
                    <option value="pharmacy" className="text-clinical-100 bg-clinical-800">Pharmacy POS</option>
                    <option value="lab" className="text-clinical-100 bg-clinical-800">Pathology Lab</option>
                    <option value="compounder" className="text-clinical-100 bg-clinical-800">Clinic Compounder</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-clinical-400 uppercase tracking-widest pl-1">
                    Business Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={partnerType === 'pharmacy' ? 'Kankarbagh Smart Pharmacy' : 'Patna Pathology Lab'}
                    className="w-full bg-clinical-900/50 border border-clinical-500 focus:border-cyan-500/50 rounded-xl py-2.5 px-3.5 text-xs text-clinical-100 placeholder-clinical-400 outline-none transition-all duration-300 font-medium font-sans"
                    required
                  />
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
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="9999000003"
                    className="w-full bg-clinical-900/50 border border-clinical-500 focus:border-cyan-500/50 rounded-xl py-2.5 px-3.5 text-xs text-clinical-100 placeholder-clinical-400 outline-none transition-all duration-300 font-medium font-sans"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-clinical-400 uppercase tracking-widest pl-1">
                    Physical Address
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Opposite Clinic main gate, Patna"
                    className="w-full bg-clinical-900/50 border border-clinical-500 focus:border-cyan-500/50 rounded-xl py-2.5 px-3.5 text-xs text-clinical-100 placeholder-clinical-400 outline-none transition-all duration-300 font-medium font-sans"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-clinical-400 uppercase tracking-widest pl-1">
                  Partner Login Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="pharmacist@mediflow.com"
                  className="w-full bg-clinical-900/50 border border-clinical-500 focus:border-cyan-500/50 rounded-xl py-2.5 px-3.5 text-xs text-clinical-100 placeholder-clinical-400 outline-none transition-all duration-300 font-medium font-sans"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-clinical-400 uppercase tracking-widest pl-1">
                    Security Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-clinical-900/50 border border-clinical-500 focus:border-cyan-500/50 rounded-xl py-2.5 px-3.5 text-xs text-clinical-100 placeholder-clinical-400 outline-none transition-all duration-300 font-medium font-sans"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-clinical-400 uppercase tracking-widest pl-1">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-clinical-900/50 border border-clinical-500 focus:border-cyan-500/50 rounded-xl py-2.5 px-3.5 text-xs text-clinical-100 placeholder-clinical-400 outline-none transition-all duration-300 font-medium font-sans"
                    required
                  />
                </div>
              </div>

              {password && (
                <div className="space-y-1.5 p-2.5 bg-clinical-900/30 rounded-xl border border-clinical-800/40">
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

              <button
                type="submit"
                disabled={loading || !validatedClinicName}
                className="w-full py-3 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-cyan-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 font-sans"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Submit Join Request <ArrowRight className="h-4 w-4" /></>}
              </button>
            </form>
          )}

          {activeTab === 'signin' && (import.meta.env.DEV || import.meta.env.VITE_USE_MOCK === 'true') && (
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
                    className="bg-clinical-900/40 hover:bg-clinical-900/80 border border-clinical-800 hover:border-cyan-500/30 rounded-xl p-2.5 flex flex-col text-left space-y-1 cursor-pointer transition-all duration-300 group"
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
          )}

        </div>
      </div>
    </div>
  );
};
