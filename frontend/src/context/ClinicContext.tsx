import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { safeGetStorageJSON, safeSetStorageJSON } from '../utils/storage';
import { FALLBACK_POD_ID } from '../services/podContext';
import type { Pod, Entity } from '../types';

interface ClinicContextType {
  activePod: Pod | null;
  activeProfile?: any;
  activeEntity: Entity | null;
  partnerStatus: 'pending' | 'approved' | 'rejected' | 'revoked' | null;
  podEntities: Entity[];
  isLoading: boolean;
  refreshClinic: () => Promise<void>;
  registerClinic: (name: string, phone: string, address: string, specialization: string) => Promise<any>;
  joinClinic: (code: string, type: 'pharmacy' | 'lab' | 'compounder', name: string, phone: string, address: string) => Promise<any>;
}

const ClinicContext = createContext<ClinicContextType | undefined>(undefined);

export const ClinicProvider: React.FC<{ children: React.ReactNode; activeProfile: any }> = ({ children, activeProfile }) => {
  // Synchronous Frame 0 state hydration to prevent clinic code flicker
  const [activePod, setActivePod] = useState<Pod | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cachedPod = safeGetStorageJSON<any>('vitalsync_cached_active_pod', null);
        if (cachedPod && cachedPod.clinicCode) return cachedPod;

        const activePodLocal = safeGetStorageJSON<any>('vitalsync_active_pod', null);
        if (activePodLocal && (activePodLocal.clinic_code || activePodLocal.clinicCode)) {
          return {
            id: activePodLocal.id || 'demo-pod',
            name: activePodLocal.name || 'Care Pod Clinic',
            location: activePodLocal.location,
            clinicCode: activePodLocal.clinic_code || activePodLocal.clinicCode,
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
      setActivePod(null);
      setActiveEntity(null);
      setPartnerStatus(null);
      setPodEntities([]);
      if (typeof window !== 'undefined') {
        delete (window as any).__mediflow_active_pod_id;
      }
      return;
    }

    // Explicit Demo Account Check
    const email = String(activeProfile.email || '').toLowerCase();
    const isDemo = Boolean(activeProfile.isDemo === true || email === 'demo@mediflow.com' || email === 'doctor@mediflow.com' || activeProfile.id === 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101');
    if (isDemo) {
      const localActivePod = safeGetStorageJSON<any>('vitalsync_active_pod', null);
      const cleanStoredPodName = localActivePod?.name && !localActivePod.name.toLowerCase().includes('apex') ? localActivePod.name : null;
      const customName = activeProfile?.clinicName || activeProfile?.clinic_name || cleanStoredPodName || (activeProfile?.display_name ? `${activeProfile.display_name.startsWith('Dr.') ? activeProfile.display_name : `Dr. ${activeProfile.display_name}`}'s Care Clinic` : 'VitalSync Smart Care Clinic');
      const demoPod: Pod = {
        id: localActivePod?.id || FALLBACK_POD_ID,
        name: customName,
        location: localActivePod?.location || 'Central Medical Plaza, Tier-2 Clinic Node',
        clinicCode: localActivePod?.clinic_code || localActivePod?.clinicCode || 'VS-V01R',
        isActive: true,
        createdAt: '2026-01-01T00:00:00Z'
      };
      setActivePod(demoPod);
      if (typeof window !== 'undefined') {
        safeSetStorageJSON('vitalsync_cached_active_pod', demoPod);
        safeSetStorageJSON('vitalsync_active_pod', { ...demoPod, clinic_code: demoPod.clinicCode });
        (window as any).__mediflow_active_pod_id = demoPod.id;
      }
      return;
    }

    setIsLoading(true);
    try {
      let entityId = activeProfile.entity_id;

      // If entity_id is not present in in-memory profile, query DB profile to resolve it
      if (!entityId) {
        const { data: dbProfile } = await supabase
          .from('profiles')
          .select('entity_id, role')
          .eq('id', activeProfile.id)
          .maybeSingle();

        if (dbProfile?.entity_id) {
          entityId = dbProfile.entity_id;
        }
      }

      if (!entityId) {
        setIsLoading(false);
        return;
      }

      // 1. Fetch user's own entity directly
      const { data: entityData, error: entityError } = await supabase
        .from('entities')
        .select('*')
        .eq('id', entityId)
        .maybeSingle();

      if (entityError) {
        console.warn('[ClinicContext] Notice fetching entity:', entityError);
      }

      if (entityData) {
        const mappedEntity: Entity = {
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

        // 2. Fetch Pod metadata and all entities in the same pod
        if (mappedEntity.podId) {
          const { data: podData, error: podError } = await supabase
            .from('pods')
            .select('*')
            .eq('id', mappedEntity.podId)
            .maybeSingle();

          if (!podError && podData) {
            const mappedPod: Pod = {
              id: podData.id,
              name: podData.name,
              location: podData.location || undefined,
              clinicCode: podData.clinic_code,
              isActive: podData.is_active ?? true,
              createdAt: podData.created_at
            };

            setActivePod(mappedPod);

            // Persist verified pod to storage to eliminate any future cold-start flicker
            if (typeof window !== 'undefined') {
              safeSetStorageJSON('vitalsync_cached_active_pod', mappedPod);
              safeSetStorageJSON('vitalsync_active_pod', {
                ...mappedPod,
                clinic_code: podData.clinic_code,
                health_score: 100,
                is_verified_for_billing: true,
                platform_fee_percent: 2.5
              });
              (window as any).__mediflow_active_pod_id = podData.id;
            }
          }

          // Fetch all entities in the same pod to link Doctor <-> Compounder <-> Pharmacy <-> Lab
          const { data: entitiesData, error: entitiesError } = await supabase
            .from('entities')
            .select('*')
            .eq('pod_id', mappedEntity.podId);

          if (!entitiesError && entitiesData) {
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

  return (
    <ClinicContext.Provider value={{
      activePod,
      activeProfile,
      activeEntity,
      partnerStatus,
      podEntities,
      isLoading,
      refreshClinic,
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
