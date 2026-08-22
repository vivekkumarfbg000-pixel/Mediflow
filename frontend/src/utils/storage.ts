/**
 * Mediflow Safe LocalStorage Utility (Military-Grade Resilience)
 * Guards against SecurityErrors (sandboxed iframes) and SyntaxErrors (corrupted storage).
 */

export function safeGetStorageJSON<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`[SafeStorage] Failed to parse key "${key}":`, err);
    return fallback;
  }
}

export function safeSetStorageJSON<T>(key: string, value: T): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn(`[SafeStorage] Failed to serialize key "${key}":`, err);
    return false;
  }
}
