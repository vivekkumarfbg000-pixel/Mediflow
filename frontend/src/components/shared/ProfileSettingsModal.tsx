import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useClinic } from '../../context/ClinicContext';
import { 
  X, 
  User, 
  Lock, 
  Share2, 
  Save, 
  Trash2, 
  Edit, 
  Check, 
  AlertTriangle, 
  Loader2, 
  Building2, 
  Globe,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';
import type { Entity } from '../../types';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'profile' | 'security' | 'partners';

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({ isOpen, onClose }) => {
  const { podEntities, activeEntity, activePod, refreshClinic, isLoading: isClinicLoading } = useClinic();
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [activeProfile, setActiveProfile] = useState<any>(null);
  
  // Profile State
  const [displayName, setDisplayName] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  
  // Security State
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  
  // Partners Editing State
  const [editingPartnerId, setEditingPartnerId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editType, setEditType] = useState<'clinic' | 'lab' | 'pharmacy' | 'compounder'>('clinic');
  const [editStatus, setEditStatus] = useState<'pending' | 'approved' | 'rejected' | 'revoked'>('pending');
  const [isSavingPartner, setIsSavingPartner] = useState(false);
  
  // Global Message/Toast fallback inside modal
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setSuccessMsg(null);
      // Fetch fresh session/profile
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single()
            .then(({ data: profile }) => {
              if (profile) {
                setActiveProfile(profile);
                setDisplayName(profile.display_name || '');
              }
            });
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const showToast = (title: string, message: string, type: 'success' | 'error' | 'warning' | 'info') => {
    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: { title, message, type }
    }));
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setErrorMsg('Display name cannot be empty.');
      return;
    }
    
    setIsSavingProfile(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('No active user session');

      const { error } = await supabase
        .from('profiles')
        .update({ display_name: displayName.trim() })
        .eq('id', session.user.id);

      if (error) throw error;
      
      setSuccessMsg('Profile updated successfully!');
      showToast('Profile Updated', 'Your profile details have been saved.', 'success');
      
      // Update local state and trigger app-wide refresh
      setActiveProfile((prev: any) => ({ ...prev, display_name: displayName.trim() }));
      window.dispatchEvent(new CustomEvent('mediflow-profile-updated'));
    } catch (err: any) {
      console.error('[ProfileSettingsModal] Save profile failed:', err);
      setErrorMsg(err.message || 'Failed to update profile.');
      showToast('Profile Update Failed', err.message || 'Failed to update profile.', 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    
    setIsUpdatingPassword(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      
      setSuccessMsg('Password updated successfully!');
      showToast('Security Updated', 'Your password has been changed successfully.', 'success');
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error('[ProfileSettingsModal] Password update failed:', err);
      setErrorMsg(err.message || 'Failed to update password.');
      showToast('Password Change Failed', err.message || 'Failed to update password.', 'error');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const startEditPartner = (partner: Entity) => {
    setEditingPartnerId(partner.id);
    setEditName(partner.name);
    setEditPhone(partner.phone || '');
    setEditAddress(partner.address || '');
    setEditType(partner.entityType);
    setEditStatus(partner.status);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleSavePartner = async (partnerId: string) => {
    if (!editName.trim()) {
      setErrorMsg('Partner name cannot be empty.');
      return;
    }
    
    setIsSavingPartner(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    
    try {
      const { error } = await supabase
        .from('entities')
        .update({
          name: editName.trim(),
          phone: editPhone.trim() || null,
          address: editAddress.trim() || null,
          entity_type: editType,
          status: editStatus
        })
        .eq('id', partnerId);

      if (error) throw error;

      setSuccessMsg('Partner node updated successfully!');
      showToast('Partner Node Updated', `Configured network settings for ${editName}.`, 'success');
      setEditingPartnerId(null);
      await refreshClinic();
    } catch (err: any) {
      console.error('[ProfileSettingsModal] Save partner failed:', err);
      setErrorMsg(err.message || 'Failed to update partner.');
      showToast('Partner Save Failed', err.message || 'Failed to update partner details.', 'error');
    } finally {
      setIsSavingPartner(false);
    }
  };

  const handleApprovePartner = async (partnerId: string, partnerName: string, newStatus: 'approved' | 'rejected') => {
    setIsSavingPartner(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const { error } = await supabase
        .from('entities')
        .update({ status: newStatus })
        .eq('id', partnerId);

      if (error) throw error;

      if (newStatus === 'approved') {
        setSuccessMsg(`${partnerName} has been approved and connected to the clinic network!`);
        showToast('Partner Approved! 🎉', `${partnerName} is now connected to your clinical ecosystem.`, 'success');
      } else {
        setSuccessMsg(`${partnerName} join request has been rejected.`);
        showToast('Partner Rejected', `${partnerName} has been denied access to the clinic network.`, 'warning');
      }

      await refreshClinic();
    } catch (err: any) {
      console.error('[ProfileSettingsModal] Partner status update failed:', err);
      setErrorMsg(err.message || 'Failed to update partner status.');
      showToast('Status Update Failed', err.message || 'Failed to update partner approval.', 'error');
    } finally {
      setIsSavingPartner(false);
    }
  };

  const handleRemovePartner = async (partner: Entity) => {
    if (!window.confirm(`Are you sure you want to disconnect ${partner.name} from this clinical pod?`)) {
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    
    try {
      // 1. Try direct hard deletion
      const { error: deleteError } = await supabase
        .from('entities')
        .delete()
        .eq('id', partner.id);

      if (deleteError) {
        console.warn('[ProfileSettingsModal] Hard delete failed (foreign key reference likely), falling back to revocation:', deleteError.message);
        
        // 2. Fallback to status update to 'revoked' and is_active to false
        const { error: updateError } = await supabase
          .from('entities')
          .update({
            status: 'revoked',
            is_active: false
          })
          .eq('id', partner.id);

        if (updateError) throw updateError;
        
        setSuccessMsg(`${partner.name} connection status has been revoked.`);
        showToast('Partner Node Revoked', `Set status of ${partner.name} to revoked to preserve audit history.`, 'warning');
      } else {
        setSuccessMsg(`${partner.name} has been deleted successfully.`);
        showToast('Partner Node Deleted', `Removed ${partner.name} from the clinical ecosystem.`, 'success');
      }

      await refreshClinic();
    } catch (err: any) {
      console.error('[ProfileSettingsModal] Remove partner failed:', err);
      setErrorMsg(err.message || 'Failed to disconnect partner.');
      showToast('Disconnection Failed', err.message || 'Failed to remove partner from the ecosystem.', 'error');
    }
  };

  const isUserPodAdmin = activeProfile?.role === 'doctor';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 md:p-8 animate-scale-up font-sans flex flex-col max-h-[85vh]">
        
        {/* Header Section */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">Settings & Workspace Control</h2>
              <span className="text-[10px] text-slate-600 uppercase tracking-widest font-semibold">Mediflow Care Network</span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Display Status Alerts */}
        {errorMsg && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2 animate-fade-in shrink-0">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="font-semibold">{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-start gap-2 animate-fade-in shrink-0">
            <Check className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="font-semibold">{successMsg}</span>
          </div>
        )}

        {/* Profile Card Summary Banner */}
        {activeProfile && (
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex items-center gap-3.5 mb-5 shrink-0">
            <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 text-white flex items-center justify-center font-bold text-base shrink-0 shadow-md shadow-indigo-600/10">
              {activeProfile.display_name?.charAt(0) || '?'}
            </div>
            <div className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-slate-800 leading-tight">{activeProfile.display_name}</span>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-indigo-50 border border-indigo-200 text-indigo-700">
                  {activeProfile.role}
                </span>
                {activePod && (
                  <span className="inline-flex items-center gap-1 text-[8.5px] font-medium text-slate-600">
                    <Globe className="h-3 w-3 text-slate-600" />
                    Pod: {activePod.name}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Workspace Tab Switcher Navigation */}
        <div className="flex border-b border-slate-200 gap-1 mb-5 shrink-0">
          <button
            onClick={() => { setActiveTab('profile'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`px-4 py-2 border-b-2 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'profile'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-600 hover:text-slate-700'
            }`}
          >
            <User className="h-4 w-4" />
            Profile Details
          </button>
          <button
            onClick={() => { setActiveTab('security'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`px-4 py-2 border-b-2 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'security'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-600 hover:text-slate-700'
            }`}
          >
            <Lock className="h-4 w-4" />
            Security & Pass
          </button>
          <button
            onClick={() => { setActiveTab('partners'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`px-4 py-2 border-b-2 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'partners'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-600 hover:text-slate-700'
            }`}
          >
            <Share2 className="h-4 w-4" />
            Ecosystem Partners
          </button>
        </div>

        {/* Tab Body Contents */}
        <div className="flex-1 overflow-y-auto min-h-0 pr-1">
          {/* PROFILE DETAILS TAB */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide mb-1.5">
                  Display Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-slate-600" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter display name"
                    className="w-full pl-9 pr-4 py-2 text-sm text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold"
                  />
                </div>
              </div>

              {activeEntity && (
                <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-xl space-y-2">
                  <span className="block text-xs font-bold text-slate-800 uppercase tracking-wider">Connected Clinic Node</span>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div>
                      <span className="text-slate-600 font-medium">Node Name:</span>
                      <p className="font-semibold text-slate-800 mt-0.5">{activeEntity.name}</p>
                    </div>
                    <div>
                      <span className="text-slate-600 font-medium">Type:</span>
                      <p className="font-semibold text-slate-800 mt-0.5 uppercase">{activeEntity.entityType}</p>
                    </div>
                    {activeEntity.phone && (
                      <div>
                        <span className="text-slate-600 font-medium">Phone:</span>
                        <p className="font-semibold text-slate-800 mt-0.5">{activeEntity.phone}</p>
                      </div>
                    )}
                    {activeEntity.address && (
                      <div>
                        <span className="text-slate-600 font-medium">Address:</span>
                        <p className="font-semibold text-slate-800 mt-0.5">{activeEntity.address}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSavingProfile}
                className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-500/50 text-white rounded-xl font-bold text-xs uppercase tracking-wider active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-600/10"
              >
                {isSavingProfile ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving Changes...
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    Save Profile Changes
                  </>
                )}
              </button>
            </form>
          )}

          {/* PASSWORD CHANGE TAB */}
          {activeTab === 'security' && (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-600" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full pl-9 pr-4 py-2 text-sm text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-600" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full pl-9 pr-4 py-2 text-sm text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isUpdatingPassword}
                className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-500/50 text-white rounded-xl font-bold text-xs uppercase tracking-wider active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-600/10"
              >
                {isUpdatingPassword ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Updating Password...
                  </>
                ) : (
                  <>
                    <Lock className="h-3.5 w-3.5" />
                    Change Account Password
                  </>
                )}
              </button>
            </form>
          )}

          {/* ECOSYSTEM PARTNERS TAB */}
          {activeTab === 'partners' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">Connected Clinic Nodes</span>
                <span className="text-[10px] text-slate-600 font-semibold px-2 py-0.5 bg-slate-100 rounded-full">
                  Total Nodes: {podEntities.length}
                </span>
              </div>

              {/* Security Admin check warning */}
              {!isUserPodAdmin && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xl flex items-start gap-2 leading-relaxed">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    <span className="font-bold">Compliance Restrict Mode Active</span>
                    <p className="text-[10.5px] mt-0.5 font-medium text-amber-800">
                      Only the Pod Administrator (Doctor role) can modify or revoke clinic network connections. Your account profile has read-only access.
                    </p>
                  </div>
                </div>
              )}

              {isClinicLoading ? (
                <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-600">
                  <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                  <span className="text-xs font-semibold">Synchronizing network nodes...</span>
                </div>
              ) : podEntities.length === 0 ? (
                <div className="py-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center p-6">
                  <Share2 className="h-10 w-10 text-slate-600 mb-2.5" />
                  <h4 className="text-xs font-bold text-slate-800">No Network Nodes Connected</h4>
                  <p className="text-[10px] text-slate-600 max-w-xs mt-1.5 leading-relaxed font-medium">
                    Onboard Pharmacy and Lab partners using your clinic code. Once they register, they will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {podEntities.map((partner) => {
                    const isEditing = editingPartnerId === partner.id;
                    const isSelfNode = partner.id === activeProfile?.entity_id;
                    const isPending = partner.status === 'pending';

                    return (
                      <div 
                        key={partner.id} 
                        className={`p-4 bg-white border rounded-xl transition-all ${
                          isSelfNode 
                            ? 'border-indigo-200 shadow-md shadow-indigo-100/50 bg-indigo-50/10' 
                            : isPending
                            ? 'border-amber-300 shadow-md shadow-amber-100/50 bg-amber-50/30'
                            : 'border-slate-200'
                        }`}
                      >
                        {/* Pending approval banner */}
                        {isPending && !isSelfNode && isUserPodAdmin && (
                          <div className="flex items-center gap-2 mb-3 p-2 bg-amber-100 rounded-lg border border-amber-200">
                            <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                            <span className="text-[10px] font-bold text-amber-800">New partner join request — awaiting your approval</span>
                          </div>
                        )}
                        {isEditing ? (
                          /* Editing Partner Form */
                          <div className="space-y-3.5">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-800 uppercase mb-1">Name</label>
                                <input
                                  type="text"
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="w-full px-2.5 py-1.5 text-xs text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-semibold"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-800 uppercase mb-1">Type</label>
                                <select
                                  value={editType}
                                  onChange={(e) => setEditType(e.target.value as any)}
                                  className="w-full px-2.5 py-1.5 text-xs text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-semibold"
                                >
                                  <option value="clinic">Clinic / Doctor</option>
                                  <option value="lab">Diagnostics Lab</option>
                                  <option value="pharmacy">Pharmacy POS</option>
                                  <option value="compounder">Clinic Compounder</option>
                                </select>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-800 uppercase mb-1">Phone</label>
                                <input
                                  type="text"
                                  value={editPhone}
                                  onChange={(e) => setEditPhone(e.target.value)}
                                  className="w-full px-2.5 py-1.5 text-xs text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-semibold"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-800 uppercase mb-1">Status</label>
                                <select
                                  value={editStatus}
                                  onChange={(e) => setEditStatus(e.target.value as any)}
                                  className="w-full px-2.5 py-1.5 text-xs text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-semibold"
                                >
                                  <option value="pending">Pending Approval</option>
                                  <option value="approved">Approved & Connected</option>
                                  <option value="rejected">Rejected</option>
                                  <option value="revoked">Revoked Connection</option>
                                </select>
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-slate-800 uppercase mb-1">Address</label>
                              <input
                                type="text"
                                value={editAddress}
                                onChange={(e) => setEditAddress(e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-semibold"
                              />
                            </div>

                            <div className="flex gap-2 justify-end pt-1.5 border-t border-slate-100">
                              <button
                                onClick={() => setEditingPartnerId(null)}
                                className="px-3 py-1.5 border border-slate-200 text-slate-650 hover:bg-slate-50 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSavePartner(partner.id)}
                                disabled={isSavingPartner}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                              >
                                {isSavingPartner ? (
                                  <>
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Saving...
                                  </>
                                ) : (
                                  <>
                                    <Save className="h-3 w-3" />
                                    Save Config
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Partner Card Display */
                          <div>
                            <div className="flex items-start justify-between gap-2.5">
                              <div>
                                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                  {partner.name}
                                  {isSelfNode && (
                                    <span className="text-[8px] bg-indigo-100 text-indigo-700 px-1 py-0.2 rounded border border-indigo-200 font-bold uppercase tracking-wider shrink-0">
                                      Active Session Node
                                    </span>
                                  )}
                                </h4>
                                <div className="flex items-center gap-2 mt-1.5">
                                  <span className="inline-flex items-center gap-1 text-[8.5px] font-semibold text-slate-600">
                                    <Building2 className="h-3 w-3 text-slate-600" />
                                    Type: <span className="uppercase text-slate-700 font-bold">{partner.entityType}</span>
                                  </span>
                                  <span className="text-slate-600 font-mono text-[8.5px]">
                                    ({partner.id.substring(0, 8)})
                                  </span>
                                </div>
                              </div>

                              {/* Dynamic contrast Status Badge */}
                              <div className="text-right">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[8.5px] font-bold uppercase tracking-wide border ${
                                  partner.status === 'approved'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : partner.status === 'pending'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : partner.status === 'rejected'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : 'bg-slate-50 text-slate-700 border-slate-200'
                                }`}>
                                  {partner.status}
                                </span>
                              </div>
                            </div>

                            <div className="mt-2.5 grid grid-cols-1 md:grid-cols-2 gap-1 text-[10px] text-slate-600 font-medium">
                              {partner.phone && (
                                <span>📞 {partner.phone}</span>
                              )}
                              {partner.address && (
                                <span className="truncate" title={partner.address}>📍 {partner.address}</span>
                              )}
                            </div>

                            {/* Node settings controls (Admin only, can't remove self session node) */}
                             {isUserPodAdmin && (
                              <div className="flex flex-wrap gap-2 justify-end mt-3 pt-2.5 border-t border-slate-100/60">
                                {/* Quick Approve/Reject for pending partner requests */}
                                {partner.status === 'pending' && !isSelfNode && (
                                  <>
                                    <button
                                      onClick={() => handleApprovePartner(partner.id, partner.name, 'approved')}
                                      disabled={isSavingPartner}
                                      className="text-[9.5px] font-bold text-emerald-700 hover:text-emerald-800 transition-colors flex items-center gap-1 border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-md cursor-pointer animate-fade-in shadow-sm"
                                    >
                                      {isSavingPartner ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                                      Approve
                                    </button>
                                    <button
                                      onClick={() => handleApprovePartner(partner.id, partner.name, 'rejected')}
                                      disabled={isSavingPartner}
                                      className="text-[9.5px] font-bold text-rose-600 hover:text-rose-700 transition-colors flex items-center gap-1 border border-rose-200 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-md cursor-pointer animate-fade-in shadow-sm"
                                    >
                                      {isSavingPartner ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                                      Reject
                                    </button>
                                  </>
                                )}
                                <button
                                  onClick={() => startEditPartner(partner)}
                                  className="text-[9.5px] font-bold text-slate-650 hover:text-indigo-600 transition-colors flex items-center gap-1 border border-slate-200 hover:border-indigo-100 hover:bg-indigo-50/20 px-2.5 py-1 rounded-md cursor-pointer"
                                >
                                  <Edit className="h-3 w-3" />
                                  Edit Node Config
                                </button>
                                {!isSelfNode && (
                                  <button
                                    onClick={() => handleRemovePartner(partner)}
                                    className="text-[9.5px] font-bold text-rose-600 hover:text-rose-700 transition-colors flex items-center gap-1 border border-rose-100 hover:bg-rose-50/30 px-2.5 py-1 rounded-md cursor-pointer animate-fade-in"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                    Disconnect Node
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Section */}
        <div className="border-t border-slate-200 pt-4 mt-4 flex items-center justify-between shrink-0">
          <span className="text-[9.5px] text-slate-600 font-bold uppercase tracking-wider">
            Connected: {activePod?.clinicCode}
          </span>
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-250 border border-slate-200 text-slate-650 font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Dismiss Panel
          </button>
        </div>

      </div>
    </div>
  );
};
