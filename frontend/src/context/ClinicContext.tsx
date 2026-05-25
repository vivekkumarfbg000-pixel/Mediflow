import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Pod, Entity } from '../types';

interface ClinicContextType {
  activePod: Pod | null;
  activeEntity: Entity | null;
  partnerStatus: 'pending' | 'approved' | 'rejected' | 'revoked' | null;
  podEntities: Entity[];
  isLoading: boolean;
  refreshClinic: () => Promise<void>;
  registerClinic: (name: string, phone: string, address: string, specialization: string) => Promise<any>;
  joinClinic: (code: string, type: 'pharmacy' | 'lab', name: string, phone: string, address: string) => Promise<any>;
}

const ClinicContext = createContext<ClinicContextType | undefined>(undefined);

export const ClinicProvider: React.FC<{ children: React.ReactNode; activeProfile: any }> = ({ children, activeProfile }) => {
  const [activePod, setActivePod] = useState<Pod | null>(null);
  const [activeEntity, setActiveEntity] = useState<Entity | null>(null);
  const [partnerStatus, setPartnerStatus] = useState<ClinicContextType['partnerStatus']>(null);
  const [podEntities, setPodEntities] = useState<Entity[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const refreshClinic = useCallback(async () => {
    if (!activeProfile?.entity_id) {
      setActivePod(null);
      setActiveEntity(null);
      setPartnerStatus(null);
      setPodEntities([]);
      return;
    }

    setIsLoading(true);
    try {
      // 1. Fetch user's own entity directly (this is always readable by the user themselves because they belong to it)
      const { data: entityData, error: entityError } = await supabase
        .from('entities')
        .select('*')
        .eq('id', activeProfile.entity_id)
        .single();

      if (entityError) {
        console.error('[ClinicContext] Error fetching entity:', entityError);
        throw entityError;
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

        // 2. If entity is approved, fetch pod metadata & all entities in the same pod
        if (mappedEntity.status === 'approved') {
          // Fetch Pod
          const { data: podData, error: podError } = await supabase
            .from('pods')
            .select('*')
            .eq('id', mappedEntity.podId)
            .single();

          if (!podError && podData) {
            setActivePod({
              id: podData.id,
              name: podData.name,
              location: podData.location || undefined,
              clinicCode: podData.clinic_code,
              isActive: podData.is_active ?? true,
              createdAt: podData.created_at
            });
          }

          // Fetch all entities in the same pod
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
        } else {
          setActivePod(null);
          setPodEntities([]);
        }
      }
    } catch (err) {
      console.error('[ClinicContext] Failed to load clinic data:', err);
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
            
            // Dispatch a celebration toast if status changed to approved
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
              // Refresh to load new partner requests or updates
              console.log('[ClinicContext Doctor Realtime] Pod entities changed:', payload);
              refreshClinic();
            }
          )
          .subscribe();
      }

      return () => {
        supabase.removeChannel(channel);
        if (doctorChannel) supabase.removeChannel(doctorChannel);
      };
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

  const joinClinic = async (code: string, type: 'pharmacy' | 'lab', name: string, phone: string, address: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('join_clinic_network', {
        p_clinic_code: code,
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
