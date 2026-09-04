import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { safeGetStorageJSON, safeSetStorageJSON } from '../utils/storage';
import { FALLBACK_POD_ID, FALLBACK_DOCTOR_ID } from '../services/podContext';
import type { Pod, Entity } from '../types';

interface ClinicContextType {
  activePod: Pod | null;
  activeProfile?: any;
  activeEntity: Entity | null;
  partnerStatus: 'pending' | 'approved' | 'rejected' | 'revoked' | null;
  podEntities: Entity[];
  isLoading: boolean;
  refreshClinic: () => Promise<void>;
  updatePodDetails: (updates: { name?: string; location?: string; upiVpa?: string; gstin?: string; doctorName?: string }) => Promise<{ success: boolean; pod?: Pod; error?: string }>;
  registerClinic: (name: string, phone: string, address: string, specialization: string) => Promise<any>;
  joinClinic: (code: string, type: 'pharmacy' | 'lab' | 'compounder', name: string, phone: string, address: string) => Promise<any>;
}

const ClinicContext = createContext<ClinicContextType | undefined>(undefined);

export const ClinicProvider: React.FC<{ children: React.ReactNode; activeProfile: any }> = ({ children, activeProfile }) => {
  // Synchronous Frame 0 state hydration
  const [activePod, setActivePod] = useState<Pod | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cachedPod = safeGetStorageJSON<any>('vitalsync_cached_active_pod', null);
        if (cachedPod && (cachedPod.clinicCode || cachedPod.clinic_code)) return cachedPod;

        const activePodLocal = safeGetStorageJSON<any>('vitalsync_active_pod', null);
        const localCode = activePodLocal?.clinic_code || activePodLocal?.clinicCode;
        if (activePodLocal && localCode) {
          return {
            id: activePodLocal.id || FALLBACK_POD_ID,
            name: activePodLocal.name || 'Medical Pod Clinic',
            location: activePodLocal.location || 'Line Bazar, Purnea, Bihar',
            clinicCode: localCode,
            isActive: activePodLocal.is_active ?? true,
            createdAt: activePodLocal.created_at || new Date().toISOString()
          };
        }
      } catch (_e) { /* ignore */ }
    }
    return null;
  });

  const [activeEntity, setActiveEntity] = useState<Entity | null>(null);
  const [partnerStatus, setPartnerStatus] = useState<ClinicContextType['partnerStatus']>(null);
  const [podEntities, setPodEntities] = useState<Entity[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const refreshClinic = useCallback(async () => {
    if (!activeProfile?.id) {
      const cached = safeGetStorageJSON<any>('vitalsync_active_pod', null) || safeGetStorageJSON<any>('vitalsync_cached_active_pod', null);
      if (cached?.clinicCode || cached?.clinic_code) {
        return;
      }
      setActivePod(null);
      setActiveEntity(null);
      setPartnerStatus(null);
      setPodEntities([]);
      return;
    }

    setIsLoading(true);
    try {
      let entityId = activeProfile.entity_id;
      let profileClinicId: string | null = activeProfile.clinic_id || activeProfile.clinicId || null;
      let profilePodId: string | null = activeProfile.pod_id || activeProfile.podId || null;

      // If entity_id / clinic_id / pod_id is not present in in-memory profile, query DB profile
      if (!entityId || !profileClinicId || !profilePodId) {
        try {
          const { data: dbProfile } = await supabase
            .from('profiles')
            .select('entity_id, clinic_id, pod_id, role')
            .eq('id', activeProfile.id)
            .maybeSingle();

          if (dbProfile) {
            if (dbProfile.entity_id) entityId = dbProfile.entity_id;
            if (dbProfile.clinic_id) profileClinicId = dbProfile.clinic_id;
            if (dbProfile.pod_id) profilePodId = dbProfile.pod_id;
          }
        } catch (_pErr) {}
      }

      let podData: any = null;
      let mappedEntity: Entity | null = null;

      // 1. Try finding pod through user's own entity
      if (entityId) {
        const { data: entityData } = await supabase
          .from('entities')
          .select('*')
          .eq('id', entityId)
          .maybeSingle();

        if (entityData) {
          mappedEntity = {
            id: entityData.id,
            podId: entityData.pod_id,
            entityType: entityData.entity_type as Entity['entityType'],
            name: entityData.name,
            address: entityData.address || undefined,
            phone: entityData.phone || undefined,
            gstin: entityData.gstin || undefined,
            subscriptionTier: entityData.subscription_tier || undefined,
            monthlyFee: entityData.monthly_fee ? parseFloat(entityData.monthly_fee) : undefined,
            status: entityData.status as Entity['status'],
            isActive: entityData.is_active ?? true,
            createdAt: entityData.created_at
          };

          setActiveEntity(mappedEntity);
          setPartnerStatus(mappedEntity.status);

          if (entityData.pod_id) {
            const { data: p } = await supabase
              .from('pods')
              .select('*')
              .eq('id', entityData.pod_id)
              .maybeSingle();

            if (p && p.is_active !== false) {
              podData = p;
            }
          }
        }
      }

      // 2. Try finding pod through user profile's direct clinic_id or pod_id
      if (!podData && (profilePodId || profileClinicId)) {
        const targetPodId = profilePodId || profileClinicId;
        try {
          const { data: p } = await supabase
            .from('pods')
            .select('*')
            .eq('id', targetPodId)
            .maybeSingle();
          if (p && p.is_active !== false) {
            podData = p;
          }
        } catch (_podErr) {}
      }

      // 3. Try finding pod through cached doctor registration
      if (!podData && typeof window !== 'undefined') {
        const localPod = safeGetStorageJSON<any>('vitalsync_active_pod', null) || safeGetStorageJSON<any>('vitalsync_cached_active_pod', null);
        if (localPod?.id || localPod?.clinic_code || localPod?.clinicCode) {
          try {
            const { data: allPods } = await supabase.rpc('get_all_tenant_pods');
            if (allPods && Array.isArray(allPods) && allPods.length > 0) {
              const matched = allPods.find((p: any) => 
                (localPod.id && p.id === localPod.id) ||
                (localPod.clinic_code && p.clinic_code === localPod.clinic_code) ||
                (localPod.clinicCode && p.clinic_code === localPod.clinicCode)
              );
              if (matched && matched.is_active !== false) {
                podData = matched;
              }
            }
          } catch (_rpcErr) {}
        }
      }

      // 4. Fallback: If no pod via entity or profile, query get_all_tenant_pods from Supabase
      if (!podData) {
        const { data: allPods } = await supabase.rpc('get_all_tenant_pods');
        if (allPods && Array.isArray(allPods) && allPods.length > 0) {
          const v01rPod = allPods.find((p: any) => p.clinic_code === 'VS-V01R' || p.id === FALLBACK_POD_ID);
          const activeDbPod = v01rPod || allPods.find((p: any) => p.is_active !== false) || allPods[0];
          if (activeDbPod) {
            podData = activeDbPod;
          }
        }
      }

      // 3. If a real pod exists in Supabase, set it
      if (podData) {
        const mappedPod: Pod = {
          id: podData.id,
          name: podData.name,
          location: podData.location || undefined,
          clinicCode: podData.clinic_code,
          isActive: podData.is_active ?? true,
          upiVpa: podData.upi_vpa || podData.upiVpa || 'vitalsync@axl',
          gstin: podData.gstin || undefined,
          doctorName: podData.doctor_name || podData.doctorName || undefined,
          phone: podData.phone || undefined,
          specialization: podData.specialization || undefined,
          createdAt: podData.created_at
        };

        setActivePod(mappedPod);

        if (typeof window !== 'undefined') {
          safeSetStorageJSON('vitalsync_cached_active_pod', mappedPod);
          safeSetStorageJSON('vitalsync_active_pod', {
            ...mappedPod,
            clinic_code: podData.clinic_code,
            health_score: podData.health_score || 100,
            is_verified_for_billing: true,
            platform_fee_percent: 3.0
          });
          (window as any).__mediflow_active_pod_id = podData.id;
        }

        // Fetch all entities in the same pod
        const { data: entitiesData } = await supabase
          .from('entities')
          .select('*')
          .eq('pod_id', podData.id);

        if (entitiesData) {
          setPodEntities(
            entitiesData.map(e => ({
              id: e.id,
              podId: e.pod_id,
              entityType: e.entity_type as Entity['entityType'],
              name: e.name,
              address: e.address || undefined,
              phone: e.phone || undefined,
              gstin: e.gstin || undefined,
              subscriptionTier: e.subscription_tier || undefined,
              monthlyFee: e.monthly_fee ? parseFloat(e.monthly_fee) : undefined,
              status: e.status as Entity['status'],
              isActive: e.is_active ?? true,
              createdAt: e.created_at
            }))
          );
        }
      } else {
        // ZERO PODS EXIST IN DATABASE (User deleted all clinics, or deleted MF-001)
        // Strictly clear state and storage — DO NOT invent a fake pod!
        setActivePod(null);
        setActiveEntity(null);
        setPartnerStatus(null);
        setPodEntities([]);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('vitalsync_cached_active_pod');
          localStorage.removeItem('vitalsync_active_pod');
          delete (window as any).__mediflow_active_pod_id;
        }
      }
    } catch (err) {
      console.warn('[ClinicContext] Failed to load live clinic data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeProfile]);

  useEffect(() => {
    refreshClinic();

    // Listen for realtime updates to public.entities table to auto-approve partners
    if (activeProfile?.entity_id) {
      const channel = supabase
        .channel(`entity-status-${activeProfile.entity_id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'entities',
            filter: `id=eq.${activeProfile.entity_id}`
          },
          (payload) => {
            console.log('[ClinicContext Realtime] Entity status updated:', payload.new);
            refreshClinic();
            
            if (payload.new.status === 'approved') {
              window.dispatchEvent(new CustomEvent('mediflow-toast', {
                detail: {
                  title: 'Clinic Access Approved! 🎉',
                  message: 'Your connection request has been approved by the doctor. Welcome to the workspace!',
                  type: 'success'
                }
              }));
            }
          }
        )
        .subscribe();

      // Listen for partner requests if this is a doctor
      let doctorChannel: any = null;
      if (activeProfile?.role === 'doctor') {
        doctorChannel = supabase
          .channel(`pod-partner-changes`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'entities'
            },
            (payload) => {
              console.log('[ClinicContext Doctor Realtime] Pod entities changed:', payload);
              refreshClinic();
            }
          )
          .subscribe();
      }

      // Multi-Tab & Window synchronization (Rule 96)
      const handleStorageSync = (e: StorageEvent) => {
        if (e.key === 'vitalsync_active_pod' || e.key === 'vitalsync_cached_active_pod' || e.key === 'mediflow_active_profile') {
          refreshClinic();
        }
      };
      const handleCustomPodChange = () => refreshClinic();

      window.addEventListener('storage', handleStorageSync);
      window.addEventListener('mediflow-pod-change', handleCustomPodChange);

      return () => {
        supabase.removeChannel(channel);
        if (doctorChannel) supabase.removeChannel(doctorChannel);
        window.removeEventListener('storage', handleStorageSync);
        window.removeEventListener('mediflow-pod-change', handleCustomPodChange);
      };
    } else {
      const handleStorageSync = (e: StorageEvent) => {
        if (e.key === 'vitalsync_active_pod' || e.key === 'vitalsync_cached_active_pod') {
          refreshClinic();
        }
      };
      window.addEventListener('storage', handleStorageSync);
      return () => window.removeEventListener('storage', handleStorageSync);
    }
  }, [activeProfile, refreshClinic]);

  const registerClinic = async (name: string, phone: string, address: string, specialization: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('register_clinic_network', {
        p_clinic_name: name,
        p_clinic_phone: phone,
        p_clinic_address: address,
        p_specialization: specialization
      });

      if (error) throw error;
      
      await refreshClinic();
      return data;
    } catch (err: any) {
      console.error('[ClinicContext] Register clinic failed:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const joinClinic = async (code: string, type: 'pharmacy' | 'lab' | 'compounder', name: string, phone: string, address: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('join_clinic_network', {
        p_clinic_code: code.trim().toUpperCase(),
        p_partner_type: type,
        p_partner_name: name,
        p_partner_phone: phone,
        p_partner_address: address
      });

      if (error) throw error;
      
      await refreshClinic();
      return data;
    } catch (err: any) {
      console.error('[ClinicContext] Join clinic failed:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const updatePodDetails = async (updates: { name?: string; location?: string; upiVpa?: string; gstin?: string; doctorName?: string }) => {
    setIsLoading(true);
    try {
      const targetPodId = activePod?.id || FALLBACK_POD_ID;
      const cleanName = updates.name?.trim();
      const cleanLocation = updates.location?.trim();
      const cleanUpi = updates.upiVpa?.trim();
      const cleanGstin = updates.gstin?.trim();
      const cleanDoctorName = updates.doctorName?.trim();

      const podUpdatePayload: any = { updated_at: new Date().toISOString() };
      if (cleanName) podUpdatePayload.name = cleanName;
      if (cleanLocation) podUpdatePayload.location = cleanLocation;
      if (cleanUpi) podUpdatePayload.upi_vpa = cleanUpi;
      if (cleanGstin) podUpdatePayload.gstin = cleanGstin;
      if (cleanDoctorName) podUpdatePayload.doctor_name = cleanDoctorName;

      // 1. Update public.pods in Supabase
      const { error: podErr } = await supabase
        .from('pods')
        .update(podUpdatePayload)
        .eq('id', targetPodId);

      if (podErr) {
        console.warn('[ClinicContext] Direct pod update warning:', podErr.message);
      }

      // 2. Update public.entities for primary clinic entity if name / location changed
      if (cleanName || cleanLocation || cleanGstin) {
        const entityUpdate: any = {};
        if (cleanName) entityUpdate.name = cleanName;
        if (cleanLocation) entityUpdate.address = cleanLocation;
        if (cleanGstin) entityUpdate.gstin = cleanGstin;

        await supabase
          .from('entities')
          .update(entityUpdate)
          .eq('pod_id', targetPodId)
          .eq('entity_type', 'clinic');
      }

      // 3. Update public.profiles clinic_name if user is logged in
      if (cleanName && activeProfile?.id) {
        await supabase
          .from('profiles')
          .update({ clinic_name: cleanName })
          .eq('id', activeProfile.id);
      }

      // 4. Update local state & localStorage caches
      const updatedPod: Pod = {
        id: targetPodId,
        name: cleanName || activePod?.name || 'VitalSync Smart Clinic',
        location: cleanLocation || activePod?.location || 'Line Bazar, Purnea, Bihar',
        clinicCode: activePod?.clinicCode || 'VS-V01R',
        isActive: activePod?.isActive ?? true,
        upiVpa: cleanUpi || activePod?.upiVpa || 'vitalsync@axl',
        gstin: cleanGstin || activePod?.gstin,
        doctorName: cleanDoctorName || activePod?.doctorName || activeProfile?.display_name,
        phone: activePod?.phone,
        specialization: activePod?.specialization,
        createdAt: activePod?.createdAt || new Date().toISOString()
      };

      setActivePod(updatedPod);

      if (typeof window !== 'undefined') {
        safeSetStorageJSON('vitalsync_cached_active_pod', updatedPod);
        safeSetStorageJSON('vitalsync_active_pod', {
          ...updatedPod,
          clinic_code: updatedPod.clinicCode,
          health_score: 100,
          is_verified_for_billing: true,
          platform_fee_percent: 3.0
        });
        (window as any).__mediflow_active_pod_id = updatedPod.id;

        // Broadcast to all open consoles and windows
        window.dispatchEvent(new CustomEvent('mediflow-pod-change', { detail: updatedPod }));
        window.dispatchEvent(new CustomEvent('mediflow-profile-updated', { detail: { clinicName: cleanName } }));
      }

      return { success: true, pod: updatedPod };
    } catch (err: any) {
      console.error('[ClinicContext] updatePodDetails failed:', err);
      return { success: false, error: err.message || 'Failed to update clinic pod details' };
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ClinicContext.Provider value={{
      activePod,
      activeProfile,
      activeEntity,
      partnerStatus,
      podEntities,
      isLoading,
      refreshClinic,
      updatePodDetails,
      registerClinic,
      joinClinic
    }}>
      {children}
    </ClinicContext.Provider>
  );
};

export const useClinic = () => {
  const context = useContext(ClinicContext);
  if (context === undefined) {
    throw new Error('useClinic must be used within a ClinicProvider');
  }
  return context;
};
