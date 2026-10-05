export type ConnectionQuality = 'fast' | 'slow' | 'offline';

class NetworkSentinelService {
  private quality: ConnectionQuality = 'fast';
  private listeners: Set<(quality: ConnectionQuality) => void> = new Set();
  private initialized = false;

  public getConnectionQuality(): ConnectionQuality {
    if (typeof navigator === 'undefined') return 'fast';
    if (!navigator.onLine) return 'offline';
    return this.quality;
  }

  public isSlowConnection(): boolean {
    return this.getConnectionQuality() === 'slow';
  }

  public getRecommendedImageQuality(): number {
    const q = this.getConnectionQuality();
    if (q === 'offline') return 0.3;
    if (q === 'slow') return 0.4;
    return 0.85; // fast
  }

  public subscribe(listener: (quality: ConnectionQuality) => void): () => void {
    this.listeners.add(listener);
    // Immediately fire with current status
    listener(this.getConnectionQuality());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const q = this.getConnectionQuality();
    this.listeners.forEach(l => l(q));
  }

  private evaluateNetwork() {
    if (typeof navigator === 'undefined') return;
    
    if (!navigator.onLine) {
      this.quality = 'offline';
      this.notify();
      return;
    }

    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (conn) {
      if (conn.saveData) {
        this.quality = 'slow';
      } else if (conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g') {
        this.quality = 'slow';
      } else if (conn.downlink && conn.downlink < 0.5) {
        this.quality = 'slow';
      } else {
        this.quality = 'fast';
      }
    } else {
      this.quality = 'fast';
    }
    this.notify();
  }

  public initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      this.evaluateNetwork();

      window.addEventListener('online', () => this.evaluateNetwork());
      window.addEventListener('offline', () => this.evaluateNetwork());

      const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      if (conn && conn.addEventListener) {
        conn.addEventListener('change', () => this.evaluateNetwork());
      }
    }
  }
}

export const NetworkSentinel = new NetworkSentinelService();
