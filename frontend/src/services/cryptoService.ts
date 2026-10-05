/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║   VITALSYNC PHASE 11 — CLIENT-SIDE FIELD-LEVEL ENCRYPTION (FLE) ENGINE   ║
 * ║   Clinic Pod Encryption Key (CPEK) Architecture — AES-256-GCM             ║
 * ║                                                                           ║
 * ║   Strategy: Pod-Level Key (not per-user) so all authenticated staff       ║
 * ║   within the same clinic can encrypt AND decrypt each other's data.       ║
 * ║   Key is EPHEMERAL — derived from podId+clinicCode at login, lives only   ║
 * ║   in memory. Zero database storage of keys. Nullified on logout.          ║
 * ║                                                                           ║
 * ║   Encrypted fields use a `fle:` prefix for backward compatibility:        ║
 * ║   Legacy plain-text values are returned as-is if no prefix detected.      ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

const FLE_PREFIX = 'fle:';

// The pepper is a static constant that prevents rainbow-table attacks against the
// PBKDF2 derivation. It is NOT a secret key — its purpose is uniqueness, not secrecy.
const FLE_PEPPER = 'vitalsync-clinic-pod-v1';

class CryptoServiceSingleton {
  private _activeKey: CryptoKey | null = null;

  /**
   * Initializes the Clinic Pod Encryption Key (CPEK) for the current session.
   * Must be called once after a successful login with an active pod context.
   * The key is deterministic: same podId + clinicCode always yields the same key.
   *
   * @param podId - The Supabase pod UUID for this clinic (from resolvePodContext)
   * @param clinicCode - The human-readable clinic code (e.g., 'VS-1234')
   */
  async initializeForSession(podId: string, clinicCode: string): Promise<void> {
    if (!podId || !clinicCode) {
      console.warn('[CryptoService] Missing podId or clinicCode. FLE key NOT initialized. PHI will not be encrypted.');
      return;
    }
    if (!window.crypto?.subtle) {
      console.warn('[CryptoService] Web Crypto API not available. FLE disabled. PHI will not be encrypted.');
      return;
    }
    try {
      const keyMaterial = await this._getKeyMaterial(`${podId}:${clinicCode}:${FLE_PEPPER}`);
      const salt = new TextEncoder().encode(podId);
      this._activeKey = await window.crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt,
          iterations: 100_000,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false, // Non-extractable: the key can never be exported from memory
        ['encrypt', 'decrypt']
      );
      console.log('[CryptoService] ✅ Clinic Pod Encryption Key (CPEK) initialized for pod:', podId.slice(0, 8) + '...');
    } catch (e) {
      console.error('[CryptoService] Key derivation failed. PHI will not be encrypted:', e);
      this._activeKey = null;
    }
  }

  /**
   * Immediately nullifies the active encryption key from memory.
   * Must be called on every logout event.
   */
  clearKey(): void {
    this._activeKey = null;
    console.log('[CryptoService] 🔒 CPEK cleared from memory on session termination.');
  }

  /**
   * Returns true if the encryption key is active and ready for use.
   */
  isKeyActive(): boolean {
    return this._activeKey !== null;
  }

  /**
   * Encrypts a plain-text string using AES-256-GCM.
   * Returns a compact `fle:iv_base64:ciphertext_base64` string.
   * If the key is not active, returns the original plain-text unchanged (graceful degradation).
   */
  async encryptField(plainText: string): Promise<string> {
    if (!this._activeKey || !plainText) return plainText;
    // Already encrypted — do not double-encrypt
    if (String(plainText).startsWith(FLE_PREFIX)) return plainText;
    try {
      const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM
      const encoded = new TextEncoder().encode(plainText);
      const cipherBuffer = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        this._activeKey,
        encoded
      );
      const ivB64 = this._bufferToBase64(iv);
      const cipherB64 = this._bufferToBase64(new Uint8Array(cipherBuffer));
      return `${FLE_PREFIX}${ivB64}:${cipherB64}`;
    } catch (e) {
      console.warn('[CryptoService] Encryption failed for field. Storing plain-text:', e);
      return plainText;
    }
  }

  /**
   * Decrypts an `fle:`-prefixed field back to plain-text.
   * If the value is NOT prefixed (legacy/unencrypted data), returns it as-is.
   * If decryption fails, returns '[Protected]' to prevent crashes.
   */
  async decryptField(cipherText: string): Promise<string> {
    if (!cipherText) return cipherText;
    if (!String(cipherText).startsWith(FLE_PREFIX)) return cipherText; // Legacy plain-text
    if (!this._activeKey) {
      console.warn('[CryptoService] Cannot decrypt — key not active. Returning [Protected].');
      return '[Protected]';
    }
    try {
      const withoutPrefix = cipherText.slice(FLE_PREFIX.length);
      const colonIdx = withoutPrefix.indexOf(':');
      if (colonIdx === -1) return '[Protected]';
      const iv = this._base64ToBuffer(withoutPrefix.slice(0, colonIdx));
      const cipherBuffer = this._base64ToBuffer(withoutPrefix.slice(colonIdx + 1));
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        this._activeKey,
        cipherBuffer
      );
      return new TextDecoder().decode(decryptedBuffer);
    } catch (e) {
      console.warn('[CryptoService] Decryption failed. Key mismatch or data corruption:', e);
      return '[Protected]';
    }
  }

  /**
   * Encrypts all PHI identifier fields on a patient object BEFORE writing to Supabase.
   * Non-PHI fields (age, gender, vitals, queue_status, pod_id, etc.) are left plain-text
   * to allow server-side Supabase queries and RPC functions to continue working.
   */
  async encryptPatientPHI(payload: Record<string, any>): Promise<Record<string, any>> {
    if (!this._activeKey) return payload; // No key — pass through unchanged
    const encrypted = { ...payload };
    if (payload.name != null) encrypted.name = await this.encryptField(String(payload.name));
    if (payload.phone != null) encrypted.phone = await this.encryptField(String(payload.phone));
    if (payload.abha_id != null) encrypted.abha_id = await this.encryptField(String(payload.abha_id));
    if (payload.address != null) encrypted.address = await this.encryptField(String(payload.address));
    return encrypted;
  }

  /**
   * Decrypts all PHI identifier fields on a raw DB row AFTER reading from Supabase.
   * Returns a plain-text patient object that is identical in shape to the pre-FLE era,
   * ensuring zero breaking changes for all consumers (Doctor EMR, Pharmacy POS, etc).
   */
  async decryptPatientPHI(row: Record<string, any>): Promise<Record<string, any>> {
    if (!this._activeKey) return row; // No key — pass through unchanged
    const decrypted = { ...row };
    if (row.name != null) decrypted.name = await this.decryptField(String(row.name));
    if (row.phone != null) decrypted.phone = await this.decryptField(String(row.phone));
    if (row.abha_id != null) decrypted.abha_id = await this.decryptField(String(row.abha_id));
    if (row.address != null) decrypted.address = await this.decryptField(String(row.address));
    return decrypted;
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  private async _getKeyMaterial(secret: string): Promise<CryptoKey> {
    const encoded = new TextEncoder().encode(secret);
    return window.crypto.subtle.importKey('raw', encoded, 'PBKDF2', false, ['deriveKey']);
  }

  private _bufferToBase64(buffer: Uint8Array): string {
    return btoa(String.fromCharCode(...buffer));
  }

  private _base64ToBuffer(b64: string): Uint8Array {
    return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  }
}

export const CryptoService = new CryptoServiceSingleton();
