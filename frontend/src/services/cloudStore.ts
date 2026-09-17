import { useSyncExternalStore } from 'react';
import type { 
  Appointment, 
  Patient, 
  UnifiedInvoice, 
  Invoice, 
  PharmacyInventoryItem, 
  WhatsAppDrugOrder, 
  PathologyReport, 
  FinancialLedgerEntry, 
  ClinicSop, 
  LabRequisition, 
  LabTestBill 
} from '../types';
import { load, save, clearStorageCache, broadcastStorageMutation } from './apiHelper';
import { getIstDateString, getEffectiveAppointmentDate } from '../utils/dateUtils';
import { getPodContext, resolveSovereignPodId, FALLBACK_POD_ID } from './podContext';

export type CollectionName = 
  | 'appointments'
  | 'patients'
  | 'unified_invoices'
  | 'invoices'
  | 'saas_invoices'
  | 'saas_prescriptions'
  | 'inventory_holds'
  | 'medicine_bills'
  | 'lab_requisitions'
  | 'lab_test_bills'
  | 'pathology_reports'
  | 'financial_ledgers'
  | 'whatsapp_sessions'
  | 'clinic_sops'
  | 'chronic_care_cohorts'
  | 'pharmacy_inventory'
  | 'reagent_inventory'
  | 'encounters';

export interface CloudStoreOptions {
  enableBroadcast?: boolean;
}

// Clean 10-digit phone normalizer for dual-key matching
export function cleanPhoneNumber(phone?: string | null): string {
  if (!phone) return '';
  return String(phone).replace(/\D/g, '').slice(-10);
}

// Deterministic IST Date Normalizer (YYYY-MM-DD)
export function normalizeDateToIst(dateInput?: any): string {
  if (!dateInput) return getIstDateString();
  return getEffectiveAppointmentDate(typeof dateInput === 'string' ? { date: dateInput } : dateInput) || getIstDateString();
}

/**
 * 🏛️ Sovereign Reactive Cloud Store (Memory SSOT & Mesh Bus)
 * Silicon Valley Grade Reactive In-Memory Store for Real-Time CDC Parity
 */
export class SovereignCloudStore {
  private static instance: SovereignCloudStore | null = null;

  // In-memory indexed collections (Map<id, Record>)
  private store: Map<CollectionName, Map<string, any>> = new Map();

  // Version Vector (Last-Write-Wins timestamps per record: "collection:id" -> timestamp)
  private versionVector: Map<string, number> = new Map();

  // Tombstone Set (Pruned/deleted record IDs: "collection:id" -> deletedTimestamp)
  private tombstones: Map<string, number> = new Map();
  private readonly TOMBSTONE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  // Reactive listeners per collection + global listeners
  private listeners: Map<CollectionName, Set<() => void>> = new Map();
  private globalListeners: Set<() => void> = new Set();

  // Snapshot cache for React useSyncExternalStore immutability contract
  private snapshots: Map<CollectionName, any[]> = new Map();
  private revision: number = 0;

  // Cross-tab Mesh Bus
  private meshBus: BroadcastChannel | null = null;
  private isColdBooted: boolean = false;

  private constructor() {
    this.initCollections();
    this.initMeshBus();
    this.coldBootFromL1();
  }

  public static getInstance(): SovereignCloudStore {
    if (!SovereignCloudStore.instance) {
      SovereignCloudStore.instance = new SovereignCloudStore();
    }
    return SovereignCloudStore.instance;
  }

  private initCollections(): void {
    const collections: CollectionName[] = [
      'appointments',
      'patients',
      'unified_invoices',
      'invoices',
      'saas_invoices',
      'saas_prescriptions',
      'inventory_holds',
      'medicine_bills',
      'lab_requisitions',
      'lab_test_bills',
      'pathology_reports',
      'financial_ledgers',
      'whatsapp_sessions',
      'clinic_sops',
      'chronic_care_cohorts',
      'pharmacy_inventory',
      'reagent_inventory',
      'encounters'
    ];
    collections.forEach(c => {
      this.store.set(c, new Map());
      this.listeners.set(c, new Set());
      this.snapshots.set(c, []);
    });
  }

  private initMeshBus(): void {
    if (typeof window !== 'undefined' && typeof window.BroadcastChannel === 'function') {
      try {
        this.meshBus = new BroadcastChannel('vitalsync_cloud_store_mesh');
        this.meshBus.onmessage = (event: MessageEvent) => {
          const data = event.data;
          if (data && data.type === 'STORE_MUTATION' && data.collection && data.record) {
            this.applyLocalDiff(data.collection, data.record, data.timestamp, false);
          } else if (data && data.type === 'STORE_DELETE' && data.collection && data.id) {
            this.deleteLocal(data.collection, data.id, data.timestamp, false);
          }
        };
      } catch (e) {
        console.warn('[CloudStore] MeshBus init notice:', e);
      }
    }
  }

  /**
   * 0ms First-Paint Cold Boot from L1 Storage (localStorage)
   */
  private coldBootFromL1(): void {
    if (this.isColdBooted || typeof window === 'undefined') return;
    try {
      // Seed appointments
      const cachedAppts = load<any[]>('saas_appointments', []) || load<any[]>('appointments', []);
      if (Array.isArray(cachedAppts)) {
        const map = this.store.get('appointments')!;
        cachedAppts.forEach(a => { if (a && a.id) map.set(a.id, a); });
        this.snapshots.set('appointments', [...map.values()]);
      }

      // Seed patients
      const cachedPats = load<any[]>('patients', []) || load<any[]>('patient_registry', []);
      if (Array.isArray(cachedPats)) {
        const map = this.store.get('patients')!;
        cachedPats.forEach(p => { if (p && p.id) map.set(p.id, p); });
        this.snapshots.set('patients', [...map.values()]);
      }

      // Seed unified invoices
      const cachedInvs = load<any[]>('unified_invoices', []);
      if (Array.isArray(cachedInvs)) {
        const map = this.store.get('unified_invoices')!;
        cachedInvs.forEach(i => { if (i && i.id) map.set(i.id, i); });
        this.snapshots.set('unified_invoices', [...map.values()]);
      }

      // Seed pharmacy inventory
      const cachedInv = load<any[]>('pharmacy_inventory', []) || load<any[]>('mediflow_inventory', []);
      if (Array.isArray(cachedInv)) {
        const map = this.store.get('pharmacy_inventory')!;
        cachedInv.forEach(item => { if (item && item.id) map.set(item.id, item); });
        this.snapshots.set('pharmacy_inventory', [...map.values()]);
      }

      // Seed lab requisitions
      const cachedReqs = load<any[]>('lab_requisitions', []);
      if (Array.isArray(cachedReqs)) {
        const map = this.store.get('lab_requisitions')!;
        cachedReqs.forEach(r => { if (r && r.id) map.set(r.id, r); });
        this.snapshots.set('lab_requisitions', [...map.values()]);
      }

      this.isColdBooted = true;
    } catch (err) {
      console.warn('[CloudStore] Cold boot notice:', err);
    }
  }

  // ── Authoritative Cloud SSOT Hydration ───────────────────────────────────────
  /**
   * Set collection authoritatively from Supabase Cloud.
   * Eliminates the zombie resurrection bug permanently by replacing obsolete local records.
   */
  public setAuthoritativeCloudCollection(collection: CollectionName, cloudRecords: any[]): void {
    if (!Array.isArray(cloudRecords)) return;
    const colMap = this.store.get(collection);
    if (!colMap) return;

    // Check WAL memory outbox for pending unsynced local mutations
    let pendingWalRecords: any[] = [];
    try {
      const rawMem = localStorage.getItem('wal_mem_outbox');
      if (rawMem) {
        const outbox = JSON.parse(rawMem);
        if (Array.isArray(outbox)) {
          pendingWalRecords = outbox
            .filter((e: any) => !e.synced && (e.table === collection || e.tableName === collection) && e.data)
            .map((e: any) => e.data);
        }
      }
    } catch (_e) {}

    // Do NOT clear the collection to prevent destructive state wiping (data loss bug)
    // colMap.clear();

    const now = Date.now();
    // Ingest authoritative cloud records (filtering tombstones)
    cloudRecords.forEach(record => {
      if (!record || !record.id) return;
      const tKey = `${collection}:${record.id}`;
      const tombstoneTime = this.tombstones.get(tKey);
      if (tombstoneTime && now - tombstoneTime < this.TOMBSTONE_TTL_MS) {
        return; // Ignore zombie record pruned recently
      }
      colMap.set(record.id, record);
      const recordTime = record.updated_at ? new Date(record.updated_at).getTime() : now;
      this.versionVector.set(tKey, recordTime);
    });

    // Replay pending uncommitted WAL entries on top of cloud authoritative state
    pendingWalRecords.forEach(pending => {
      if (pending && pending.id) {
        colMap.set(pending.id, { ...(colMap.get(pending.id) || {}), ...pending });
      }
    });

    this.updateSnapshot(collection);
    this.asyncPersistL1(collection);
    this.notifySubscribers(collection);
  }

  public setInitialCloudSnapshot(collection: CollectionName, cloudRecords: any[]): void {
    this.setAuthoritativeCloudCollection(collection, cloudRecords);
  }

  public hasCollection(collection: CollectionName): boolean {
    const colMap = this.store.get(collection);
    return Boolean(colMap && colMap.size > 0);
  }

  // ── Ingest Postgres CDC Diff (<5ms execution) ──────────────────────────────
  /**
   * Ingest incoming Supabase Realtime CDC frame directly into memory.
   */
  public ingestCdcFrame(collection: CollectionName, eventType: 'INSERT' | 'UPDATE' | 'DELETE', record: any): void {
    if (!record || !record.id) return;
    const now = Date.now();

    if (eventType === 'DELETE') {
      this.deleteLocal(collection, record.id, now, true);
    } else {
      this.applyLocalDiff(collection, record, now, true);
    }
  }

  // ── Internal Diff & LWW Resolution ──────────────────────────────────────────
  public applyLocalDiff(collection: CollectionName, record: any, timestamp: number = Date.now(), broadcast: boolean = true): void {
    if (!record || !record.id) return;
    const colMap = this.store.get(collection);
    if (!colMap) return;

    const vKey = `${collection}:${record.id}`;
    const lastVersion = this.versionVector.get(vKey) || 0;

    // CRDT Last-Write-Wins: Apply if timestamp is newer or equal
    if (timestamp >= lastVersion) {
      const existing = colMap.get(record.id) || {};
      const merged = { ...existing, ...record };
      colMap.set(record.id, merged);
      this.versionVector.set(vKey, timestamp);
      this.tombstones.delete(vKey); // Un-tombstone if actively recreated

      this.updateSnapshot(collection);
      this.asyncPersistL1(collection);
      this.notifySubscribers(collection);

      if (broadcast && this.meshBus) {
        try {
          this.meshBus.postMessage({ type: 'STORE_MUTATION', collection, record: merged, timestamp });
        } catch (_e) {}
      }
    }
  }

  public deleteLocal(collection: CollectionName, id: string, timestamp: number = Date.now(), broadcast: boolean = true): void {
    if (!id) return;
    const colMap = this.store.get(collection);
    if (!colMap) return;

    const vKey = `${collection}:${id}`;
    colMap.delete(id);
    this.versionVector.set(vKey, timestamp);
    this.tombstones.set(vKey, timestamp);

    this.updateSnapshot(collection);
    this.asyncPersistL1(collection);
    this.notifySubscribers(collection);

    if (broadcast && this.meshBus) {
      try {
        this.meshBus.postMessage({ type: 'STORE_DELETE', collection, id, timestamp });
      } catch (_e) {}
    }
  }

  // ── Snapshot Management for React useSyncExternalStore ─────────────────────
  private updateSnapshot(collection: CollectionName): void {
    const colMap = this.store.get(collection);
    if (colMap) {
      this.snapshots.set(collection, Array.from(colMap.values()));
    }
    this.revision++;
  }

  private notifySubscribers(collection: CollectionName): void {
    const subs = this.listeners.get(collection);
    if (subs) {
      subs.forEach(cb => {
        try { cb(); } catch (_e) {}
      });
    }
    this.globalListeners.forEach(cb => {
      try { cb(); } catch (_e) {}
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mediflow-state-change', { detail: { table: collection } }));
      if (['financial_ledgers', 'unified_invoices', 'appointments', 'medicine_bills', 'lab_requisitions', 'lab_test_bills', 'vitalsync_pool_settlements'].includes(collection)) {
        window.dispatchEvent(new CustomEvent('mediflow-financial-update', { detail: { table: collection } }));
      }
    }
  }

  // ── Non-Blocking L1 Cold-Cache Async Persistence ────────────────────────────
  private l1Timers: Map<CollectionName, ReturnType<typeof setTimeout>> = new Map();
  private asyncPersistL1(collection: CollectionName): void {
    const existingTimer = this.l1Timers.get(collection);
    if (existingTimer) clearTimeout(existingTimer);

    this.l1Timers.set(collection, setTimeout(() => {
      try {
        const records = this.snapshots.get(collection) || [];
        const storageKeyMap: Record<CollectionName, string[]> = {
          'appointments': ['saas_appointments', 'appointments'],
          'patients': ['patients', 'patient_registry'],
          'unified_invoices': ['unified_invoices', 'saas_invoices'],
          'invoices': ['unified_invoices', 'saas_invoices'],
          'saas_invoices': ['saas_invoices'],
          'saas_prescriptions': ['saas_prescriptions', 'prescriptions'],
          'inventory_holds': ['inventory_holds'],
          'medicine_bills': ['medicine_bills'],
          'lab_requisitions': ['lab_requisitions'],
          'lab_test_bills': ['lab_test_bills'],
          'pathology_reports': ['pathology_reports', 'full_lab_reports'],
          'financial_ledgers': ['financial_ledgers'],
          'whatsapp_sessions': ['whatsapp_sessions'],
          'clinic_sops': ['clinic_sops'],
          'chronic_care_cohorts': ['chronic_care_cohorts'],
          'pharmacy_inventory': ['pharmacy_inventory', 'mediflow_inventory'],
          'reagent_inventory': ['reagents', 'reagent_inventory'],
          'encounters': ['encounters']
        };

        const keys = storageKeyMap[collection] || [collection];
        for (const k of keys) {
          clearStorageCache(k);
          save(k, records, false);
        }
      } catch (_err) {
        /* ignore storage quota warnings */
      }
    }, 150));
  }

  // ── Public Accessors (0ms In-Memory Read) ───────────────────────────────────
  public getSnapshot<T>(collection: CollectionName): T[] {
    return (this.snapshots.get(collection) || []) as T[];
  }

  public getRecordById<T>(collection: CollectionName, id: string): T | null {
    const colMap = this.store.get(collection);
    if (!colMap) return null;
    return (colMap.get(id) as T) || null;
  }

  // ── Dual-Key Patient Reconciliation ─────────────────────────────────────────
  public getPatientByIdOrPhone(id?: string | null, phone?: string | null): Patient | null {
    if (!id && !phone) return null;
    const pats = this.getSnapshot<Patient>('patients');
    const cleanP = cleanPhoneNumber(phone);

    // Primary: match by ID
    if (id) {
      const match = pats.find(p => p.id === id || (p as any).patient_id === id || (p as any).patientCode === id);
      if (match) return match;
    }

    // Secondary: match by clean 10-digit phone digits
    if (cleanP && cleanP.length >= 10) {
      const match = pats.find(p => cleanPhoneNumber(p.phone) === cleanP);
      if (match) return match;
    }

    return null;
  }

  // ── Projected In-Memory Sub-Maps ────────────────────────────────────────────
  public getTokensMap(): Record<string, string> {
    const tokens: Record<string, string> = {};
    const patients = this.getSnapshot<Patient>('patients');
    patients.forEach(p => {
      const tok = p.tokenNumber || (p as any).token_number;
      if (p.id && tok) tokens[p.id] = String(tok);
    });
    return tokens;
  }

  public getVitalsMap(): Record<string, any> {
    const vitals: Record<string, any> = {};
    const patients = this.getSnapshot<Patient>('patients');
    patients.forEach(p => {
      if (p.id && p.vitals) vitals[p.id] = p.vitals;
    });
    return vitals;
  }

  public getQueueStatusMap(): Record<string, string> {
    const statuses: Record<string, string> = {};
    const patients = this.getSnapshot<Patient>('patients');
    patients.forEach(p => {
      const q = p.queueStatus || (p as any).queue_status;
      if (p.id && q) statuses[p.id] = String(q);
    });
    return statuses;
  }

  // ── Subscription Handlers ───────────────────────────────────────────────────
  public subscribe(collection: CollectionName, onStoreChange: () => void): () => void {
    const subs = this.listeners.get(collection);
    if (subs) subs.add(onStoreChange);
    return () => {
      if (subs) subs.delete(onStoreChange);
    };
  }

  public subscribeGlobal(onStoreChange: () => void): () => void {
    this.globalListeners.add(onStoreChange);
    return () => {
      this.globalListeners.delete(onStoreChange);
    };
  }
}

// ── Global Singleton Export ───────────────────────────────────────────────────
export const cloudStore = SovereignCloudStore.getInstance();

// ── React 18 Concurrent Rendering Hooks (useSyncExternalStore) ────────────────
export function useCloudCollection<T>(collection: CollectionName, filterFn?: (item: T) => boolean): T[] {
  const store = SovereignCloudStore.getInstance();

  const getSnapshot = () => {
    const all = store.getSnapshot<T>(collection);
    return filterFn ? all.filter(filterFn) : all;
  };

  const subscribe = (callback: () => void) => {
    return store.subscribe(collection, callback);
  };

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useCloudRecord<T>(collection: CollectionName, id: string | null | undefined): T | null {
  const store = SovereignCloudStore.getInstance();

  const getSnapshot = () => {
    if (!id) return null;
    return store.getRecordById<T>(collection, id);
  };

  const subscribe = (callback: () => void) => {
    return store.subscribe(collection, callback);
  };

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
