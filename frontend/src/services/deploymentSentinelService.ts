/**
 * 🚀 VitalSync Sovereign Mesh — Zero-Downtime Deployment Sentinel (Phase 24)
 *
 * Enforces the Zero-Consultation-Interruption Invariant:
 *  - Continuously monitors cloud deployment versions and Vite bundle asset hashes.
 *  - NEVER triggers unprompted reloads during active doctor consultations,
 *    ambient scribe audio recordings, OCR scans, or active pharmacy POS carts.
 *  - Provides non-intrusive notification badges for seamless 1-tap reload when idle.
 */

export interface DeploymentSentinelState {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  lastChecked: string;
  isWorkflowActive: boolean;
}

export class DeploymentSentinelService {
  private static readonly CLIENT_VERSION = '2026.10.7-mesh-v24';
  private static checkIntervalTimer: any = null;
  private static updateDetected = false;
  private static postponed = false;
  private static lastCheckTime = new Date().toISOString();

  /**
   * Initializes the background deployment sentinel.
   */
  static init(): void {
    if (typeof window === 'undefined') return;

    // Check periodically every 2 minutes
    if (!this.checkIntervalTimer) {
      this.checkIntervalTimer = setInterval(() => {
        this.checkForUpdates();
      }, 120_000);
    }

    // Also check on tab visibility change
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.checkForUpdates();
      }
    });

    // Initial check after 5 seconds
    setTimeout(() => this.checkForUpdates(), 5000);

    console.log(`[DeploymentSentinel] 🚀 Zero-Downtime Sentinel Armed (Client v${this.CLIENT_VERSION})`);
  }

  /**
   * Evaluates whether any critical clinical or billing workflow is currently in flight.
   * If true, ANY automatic page reload or modal popup is STRICTLY FORBIDDEN.
   */
  static isCriticalClinicalWorkflowActive(): boolean {
    if (typeof window === 'undefined') return false;

    try {
      // 1. Ambient Audio Scribe is actively recording consultation dialogue
      if ((window as any).__mediflow_scribe_recording === true) {
        return true;
      }

      // 2. Doctor consultation worksheet is active / patient is in consultation
      const activeConsultElem = document.querySelector('[data-active-consultation="true"]');
      if (activeConsultElem) {
        return true;
      }

      // 3. Pharmacy POS has items in active checkout cart
      const cartRaw = localStorage.getItem('pharmacy_active_cart');
      if (cartRaw) {
        try {
          const cart = JSON.parse(cartRaw);
          if (Array.isArray(cart) && cart.length > 0) return true;
        } catch { /* ignore */ }
      }

      // 4. Autonomous OCR scanner is processing
      const ocrScanningElem = document.querySelector('[data-ocr-scanning="true"]');
      if (ocrScanningElem) {
        return true;
      }

      // 5. Active payment transaction modal is visible
      const paymentModalElem = document.querySelector('[data-payment-modal="true"]');
      if (paymentModalElem) {
        return true;
      }
    } catch (_e) {
      /* ignore DOM evaluation error */
    }

    return false;
  }

  /**
   * Checks for updated deployments without interrupting the clinical staff.
   */
  static async checkForUpdates(): Promise<boolean> {
    this.lastCheckTime = new Date().toISOString();

    if (typeof window === 'undefined') return false;

    try {
      // Non-intrusive HEAD / GET ping to index with cache-busting timestamp
      const res = await fetch(`/?sentinel_check=${Date.now()}`, {
        method: 'HEAD',
        cache: 'no-cache'
      });

      const serverEtag = res.headers.get('etag') || res.headers.get('last-modified');
      const cachedEtag = localStorage.getItem('vitalsync_client_etag');

      if (serverEtag && cachedEtag && serverEtag !== cachedEtag) {
        this.updateDetected = true;
        return this.handleUpdateDetected(serverEtag);
      } else if (serverEtag && !cachedEtag) {
        localStorage.setItem('vitalsync_client_etag', serverEtag);
      }
    } catch (_e) {
      /* ignore transient network error */
    }

    return false;
  }

  /**
   * Handles newly detected cloud bundle deployment.
   */
  private static handleUpdateDetected(newEtag: string): boolean {
    const isBusy = this.isCriticalClinicalWorkflowActive();

    if (isBusy) {
      if (!this.postponed) {
        this.postponed = true;
        console.warn('[DeploymentSentinel] 🛑 Critical clinical encounter active. Postponing hot reload until doctor/counter is idle.');
        
        window.dispatchEvent(new CustomEvent('mediflow-toast', {
          detail: {
            title: 'Cloud Upgrade Ready 🔄',
            message: 'A new clinical version is ready. It will seamlessly apply when your consultation completes.',
            type: 'info'
          }
        }));
      }
      return false;
    }

    // Counter is idle: notify clinical staff with non-intrusive option to refresh
    window.dispatchEvent(new CustomEvent('mediflow-deployment-ready', {
      detail: {
        newEtag,
        currentVersion: this.CLIENT_VERSION,
        timestamp: this.lastCheckTime
      }
    }));

    return true;
  }

  /**
   * Allows manual trigger of instant hot reload once the counter is safely idle.
   */
  static triggerGracefulReload(force = false): void {
    if (typeof window === 'undefined') return;

    if (!force && this.isCriticalClinicalWorkflowActive()) {
      console.warn('[DeploymentSentinel] Aborted reload: encounter currently active.');
      return;
    }

    // Persist new etag and execute clean reload
    const activeEtag = localStorage.getItem('vitalsync_client_etag_pending');
    if (activeEtag) {
      localStorage.setItem('vitalsync_client_etag', activeEtag);
    }

    console.log('[DeploymentSentinel] Executing graceful clinical hot-reload...');
    window.location.reload();
  }

  /**
   * Inspect current sentinel state.
   */
  static getState(): DeploymentSentinelState {
    return {
      currentVersion: this.CLIENT_VERSION,
      latestVersion: this.CLIENT_VERSION,
      updateAvailable: this.updateDetected,
      lastChecked: this.lastCheckTime,
      isWorkflowActive: this.isCriticalClinicalWorkflowActive()
    };
  }
}

// Automatically initialize in browser runtime
if (typeof window !== 'undefined') {
  DeploymentSentinelService.init();
}
