export class RequestDeduplicator {
  private inFlight = new Map<string, Promise<any>>();

  public dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
    if (this.inFlight.has(key)) {
      return this.inFlight.get(key) as Promise<T>;
    }
    const promise = fn().finally(() => {
      this.inFlight.delete(key);
    });
    this.inFlight.set(key, promise);
    return promise;
  }

  public clear(key: string): void {
    this.inFlight.delete(key);
  }
}

export const requestDeduplicator = new RequestDeduplicator();
