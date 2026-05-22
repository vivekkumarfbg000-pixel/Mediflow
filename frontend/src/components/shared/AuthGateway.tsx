import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Shield, Mail, ArrowRight, Activity, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';

interface AuthGatewayProps {
  onAuthSuccess: (session: any, profile: any) => void;
}

export const AuthGateway: React.FC<AuthGatewayProps> = ({ onAuthSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Pre-seeded Enterprise Demo Roles for Seamless Testing of RLS Rules
  const demoUsers = [
    {
      id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101',
      name: 'Dr. Vivek Kumar',
      role: 'doctor',
      entity: 'Clinic Hub',
      icon: '🏥'
    },
    {
      id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317102',
      name: 'Lalit Prasad',
      role: 'lab_technician',
      entity: 'Pathology Lab',
      icon: '🧪'
    },
    {
      id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317103',
      name: 'Prakash Yadav',
      role: 'pharmacist',
      entity: 'Pharmacy POS',
      icon: '💊'
    },
    {
      id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317104',
      name: 'Aarav Sharma',
      role: 'patient',
      entity: 'Ecosystem Patient',
      icon: '👤'
    }
  ];

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data?.user) {
        // Retrieve the authenticated user's profile from the public database
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

  // Automated Secure Simulation Sign-In representing pre-seeded RLS profiles
  const handleDemoSignIn = async (user: typeof demoUsers[0]) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // Map user role to pre-seeded email in Supabase auth
      let authEmail = '';
      if (user.role === 'doctor') authEmail = 'doctor@mediflow.com';
      else if (user.role === 'lab_technician') authEmail = 'labtech@mediflow.com';
      else if (user.role === 'pharmacist') authEmail = 'pharmacist@mediflow.com';
      else if (user.role === 'patient') authEmail = 'patient1@mediflow.com';

      if (!authEmail) {
        throw new Error(`Mapping failed for role: ${user.role}`);
      }

      // Perform a real authentication to establish the {authenticated} session for RLS compliance
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: 'password123'
      });

      if (authError) throw authError;

      // Fetch the authenticated user's profile from Supabase public.profiles (now successfully authenticated!)
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileErr) {
        throw new Error(`Profile seed verification failed: ${profileErr.message}`);
      }

      // Notify App of successful secure login
      onAuthSuccess(authData.session, profile);
    } catch (err: any) {
      setErrorMsg(err.message || 'Demo profile loading failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-clinical-900 via-clinical-950 to-black text-clinical-100 flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Background Neon Glow Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none animate-pulse-subtle"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none animate-pulse-subtle" style={{ animationDelay: '2s' }}></div>

      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 gap-8 items-center z-10">
        
        {/* Left Side: Brand Value Proposition */}
        <div className="md:col-span-5 flex flex-col justify-center text-left space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Activity className="h-6 w-6 text-cyan-400 animate-pulse-subtle" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-indigo-400 font-sans">
                MEDIFLOW
              </h1>
              <p className="text-[10px] tracking-[0.2em] font-extrabold text-cyan-500 uppercase">
                CONNECTED CARE POD
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-3xl font-extrabold tracking-tight text-white leading-tight">
              Enterprise Digital Health Network Portal
            </h2>
            <p className="text-sm text-clinical-300 leading-relaxed font-medium">
              A secure, multi-tenant workspace linking local clinics, partner labs, and pharmacy inventories under a unified digital care loop.
            </p>
          </div>

          <div className="space-y-3 border-l-2 border-cyan-500/30 pl-4 py-1 text-xs text-clinical-400 font-medium leading-relaxed">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-cyan-400 flex-shrink-0" />
              <span>Full compliance with India's DPDPA 2023 guidelines</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-cyan-400 flex-shrink-0" />
              <span>Hardened Row-Level Security database schemas</span>
            </div>
          </div>
        </div>

        {/* Right Side: Authentication Panel */}
        <div className="md:col-span-7 bg-clinical-950/40 backdrop-blur-2xl border border-clinical-800/80 rounded-3xl p-8 shadow-2xl shadow-black/40 flex flex-col space-y-6">
          <div>
            <h3 className="text-xl font-extrabold text-white">Ecosystem Authentication</h3>
            <p className="text-xs text-clinical-400 mt-1 font-semibold">
              Sign in with your credentials or select an enterprise profile below.
            </p>
          </div>

          {errorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3.5 flex items-start gap-3 animate-shake">
              <Shield className="h-5 w-5 text-rose-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs font-semibold text-rose-300 leading-relaxed">{errorMsg}</div>
            </div>
          )}

          {/* Form Login: Traditional email check */}
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
                  placeholder="name@mediflow.in"
                  className="w-full bg-clinical-900/50 border border-clinical-800 focus:border-cyan-500/50 rounded-xl py-3.5 pl-11 pr-4 text-sm text-white placeholder-clinical-600 outline-none transition-all duration-300 shadow-inner font-medium"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-bold text-clinical-400 uppercase tracking-widest">
                  Security Password
                </label>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-clinical-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-clinical-900/50 border border-clinical-800 focus:border-cyan-500/50 rounded-xl py-3.5 pl-11 pr-12 text-sm text-white placeholder-clinical-600 outline-none transition-all duration-300 shadow-inner font-medium"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-clinical-500 hover:text-white transition-all"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-cyan-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Enter Workspace <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick-Switch Enterprise Profile Console (Bypass for E2E Dev Testing) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between border-t border-clinical-800/80 pt-4">
              <span className="text-[10px] font-bold text-clinical-400 uppercase tracking-widest">
                Enterprise Mock Profiles (E2E Telemetry)
              </span>
              <span className="text-[9px] font-bold text-cyan-400 bg-cyan-400/10 px-2.5 py-0.5 rounded-full border border-cyan-400/20">
                RLS Verification Enabled
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              {demoUsers.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleDemoSignIn(user)}
                  disabled={loading}
                  className="bg-clinical-900/40 hover:bg-clinical-900/80 border border-clinical-800 hover:border-cyan-500/30 rounded-xl p-3 flex flex-col text-left space-y-1 cursor-pointer transition-all duration-300 group"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[11px] font-bold text-white group-hover:text-cyan-400 transition-colors">
                      {user.name}
                    </span>
                    <span className="text-sm">{user.icon}</span>
                  </div>
                  <div className="flex items-center justify-between text-[9px] font-extrabold uppercase tracking-wide">
                    <span className="text-clinical-400">{user.entity}</span>
                    <span className="text-cyan-500 group-hover:text-cyan-400">{user.role.replace('_', ' ')}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
