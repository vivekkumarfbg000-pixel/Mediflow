// Mediflow Connected Care Ecosystem v2.3 - PWA Connection & Database Sync Coordinator
import { api } from './services/api';

export class PwaSyncManager {
  private static isSyncActive = false;

  // 1. Initialize PWA Service Worker Registration
  static registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      // Register Service Worker for PWA capabilities & offline caching
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then((reg) => {
            console.log('[PWA-Client] Service Worker registered successfully! Scope:', reg.scope);
          })
          .catch((err) => {
            console.warn('[PWA-Client] Service Worker registration failed:', err);
          });
      });
    }

    // Connect global online/offline status notifications
    window.addEventListener('online', () => {
      console.log('[PWA-Client] Connection recovered online! Flushing queue...');
      this.flushOfflineSyncQueue();
    });

    window.addEventListener('offline', () => {
      console.warn('[PWA-Client] Connection lost. Operational actions will queue locally.');
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          message: 'Connection lost! Offline resiliency mode active. Operations will queue locally.',
          type: 'warning',
          title: 'Offline Resiliency Active'
        }
      }));
    });

    // Listen to decoupled event-driven offline queues
    window.addEventListener('mediflow-pwa-queue-action', (e: Event) => {
      const detail = (e as CustomEvent).detail;
      this.queueOfflineAction(detail.actionType, detail.payload);
    });
  }

  // 2. Queue Operational Action Offline
  static queueOfflineAction(actionType: string, payload: Record<string, any>) {
    try {
      const rawQueue = localStorage.getItem('offline_sync_queue');
      const queue = rawQueue ? JSON.parse(rawQueue) : [];
      const newAction = {
        id: `offline-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        actionType,
        payload,
        timestamp: new Date().toISOString()
      };
      queue.push(newAction);
      localStorage.setItem('offline_sync_queue', JSON.stringify(queue));
      
      console.log(`[PWA-Sync] Action queued locally: ${actionType}`, payload);

      // Fire a custom sync event for UI badge updates
      window.dispatchEvent(new CustomEvent('mediflow-pwa-sync-change'));
    } catch (e) {
      console.error('[PWA-Sync] Failed to queue action:', e);
    }
  }

  // 3. Get Queue Count
  static getQueueCount(): number {
    try {
      const rawQueue = localStorage.getItem('offline_sync_queue');
      const queue = rawQueue ? JSON.parse(rawQueue) : [];
      return queue.length;
    } catch {
      return 0;
    }
  }

  // 4. Flush Queue (Synchronize with Supabase)
  static async flushOfflineSyncQueue() {
    if (this.isSyncActive) return;
    
    // Synchronize WAL Outbox first
    try {
      console.log('[PWA-Sync] Replaying WAL Outbox...');
      await api.replayWALOutbox();
    } catch (walErr) {
      console.error('[PWA-Sync] Failed to replay WAL Outbox:', walErr);
    }

    let queue: any[] = [];
    try {
      queue = JSON.parse(localStorage.getItem('offline_sync_queue') || '[]');
    } catch (_err) {
      console.error('[PWA-Sync] Corrupted offline_sync_queue, resetting:', _err);
      localStorage.setItem('offline_sync_queue', '[]');
      queue = [];
    }
    if (queue.length === 0) return;

    this.isSyncActive = true;
    console.log(`[PWA-Sync] Ingesting offline queue: ${queue.length} items to Supabase...`);

    try {
      let successCount = 0;
      while (queue.length > 0) {
        const item = queue[0];
        if (item.actionType === 'saveMedicineBill') {
          await api.saveMedicineBill(item.payload);
        } else if (item.actionType === 'addPharmacyInventoryItem') {
          await api.addPharmacyInventoryItem(item.payload);
        } else if (item.actionType === 'collectLabSample') {
          await api.collectLabSample(item.payload.id);
        } else if (item.actionType === 'replenishReagentStock') {
          await api.replenishReagentStock(item.payload.reagentName, item.payload.volume);
        }
        
        // Item processed successfully, remove from queue and save
        queue.shift();
        localStorage.setItem('offline_sync_queue', JSON.stringify(queue));
        successCount++;
      }

      console.log(`[PWA-Sync] Core queue synchronization completed successfully! Processed ${successCount} items. 🟢`);

      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          message: 'All cached transactions and billing logs synchronized to Supabase!',
          type: 'success',
          title: 'Sync Complete'
        }
      }));

      // Trigger standard API sync to pull consolidated values
      api.syncFromSupabase();
      window.dispatchEvent(new CustomEvent('mediflow-pwa-sync-change'));
    } catch (err) {
      console.error('[PWA-Sync] Flush cycle failed, queue preserved.', err);
    } finally {
      this.isSyncActive = false;
    }
  }
}
