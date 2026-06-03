// Mediflow Connected Care Ecosystem v2.3 - PWA Connection & Database Sync Coordinator
import { api } from './services/api';

export class PwaSyncManager {
  private static isSyncActive = false;

  // 1. Initialize PWA Service Worker Registration
  static registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      // Disable service worker in development mode and local servers to prevent caching Vite dev modules and infinite reload loops
      const isLocalHost = window.location.hostname === 'localhost' || 
                          window.location.hostname === '127.0.0.1' || 
                          window.location.hostname.startsWith('192.168.') || 
                          window.location.hostname.startsWith('10.') || 
                          window.location.hostname.startsWith('172.') || 
                          window.location.hostname.endsWith('.local') ||
                          window.location.port !== '';

      if (import.meta.env.DEV || isLocalHost) {
        console.log('[PWA-Client] Service Worker registration bypassed in development mode.');
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister();
            console.log('[PWA-Client] Unregistered active service worker for development.');
          }
        });
        return;
      }

      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then((reg) => {
            console.log('[PWA-Client] Service Worker registered successfully! Scope:', reg.scope);
            
            // Check for updates periodically
            setInterval(() => {
              reg.update();
            }, 30 * 1000); // Check every 30 seconds

            // Auto-reload on updates to bypass stale-while-revalidate cache
            reg.addEventListener('updatefound', () => {
              const installing = reg.installing;
              if (installing) {
                installing.addEventListener('statechange', () => {
                  if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                    console.log('[PWA-Client] New content is available; auto-refreshing...');
                    window.dispatchEvent(new CustomEvent('mediflow-toast', {
                      detail: {
                        title: 'System Update Active',
                        message: 'Downloading latest enhancements and applying updates...',
                        type: 'info'
                      }
                    }));
                    setTimeout(() => {
                      window.location.reload();
                    }, 1000);
                  }
                });
              }
            });
          })
          .catch((err) => {
            console.error('[PWA-Client] Service Worker registration failed:', err);
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
      const queue = JSON.parse(localStorage.getItem('offline_sync_queue') || '[]');
      const newAction = {
        id: `offline-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        actionType,
        payload,
        timestamp: new Date().toISOString()
      };
      queue.push(newAction);
      localStorage.setItem('offline_sync_queue', JSON.stringify(queue));
      
      console.log(`[PWA-Sync] Action queued locally: ${actionType}`, payload);

      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          message: `Offline Sync: Operational ${actionType} action saved to offline queue.`,
          type: 'info',
          title: 'Transaction Queued'
        }
      }));

      // Fire a custom sync event for UI badge updates
      window.dispatchEvent(new CustomEvent('mediflow-pwa-sync-change'));
    } catch (e) {
      console.error('[PWA-Sync] Failed to queue action:', e);
    }
  }

  // 3. Get Queue Count
  static getQueueCount(): number {
    try {
      const queue = JSON.parse(localStorage.getItem('offline_sync_queue') || '[]');
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

    const queue = JSON.parse(localStorage.getItem('offline_sync_queue') || '[]');
    if (queue.length === 0) return;

    this.isSyncActive = true;
    console.log(`[PWA-Sync] Ingesting offline queue: ${queue.length} items to Supabase...`);

    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: `Ingesting ${queue.length} offline transactions... Please keep dashboard open.`,
        type: 'info',
        title: 'Synchronizing Caches'
      }
    }));

    try {
      for (const item of queue) {
        if (item.actionType === 'saveMedicineBill') {
          // Re-sync local storage values and publish directly to remote database
          await api.saveMedicineBill(item.payload);
        } else if (item.actionType === 'addPharmacyInventoryItem') {
          await api.addPharmacyInventoryItem(item.payload);
        } else if (item.actionType === 'collectLabSample') {
          await api.collectLabSample(item.payload.id);
        } else if (item.actionType === 'replenishReagentStock') {
          await api.replenishReagentStock(item.payload.reagentName, item.payload.volume);
        }
      }

      // Evict synchronized queue buffer
      localStorage.removeItem('offline_sync_queue');
      console.log('[PWA-Sync] Core queue synchronization completed successfully! 🟢');

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
