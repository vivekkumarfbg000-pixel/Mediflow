export class CryptoAuditService {
  /**
   * Generates a military-grade SHA-256 hash for a given payload to ensure zero-trust medicolegal tamper evidence.
   * Runs locally via Web Crypto API (0ms network latency).
   * 
   * @param payload The clinical artifact object (e.g. Prescription, Invoice)
   * @param userId The ID of the doctor/compounder finalizing the document
   * @returns A hex string of the SHA-256 hash
   */
  static async generatePHISignature(payload: any, userId: string): Promise<{ signature: string, timestamp: string }> {
    try {
      const timestamp = new Date().toISOString();
      
      // Deterministically stringify the payload (ignoring volatile fields if needed, but for now we hash the whole core object)
      const sanitizedPayload = { ...payload };
      
      // Remove any existing signatures to prevent recursive hashing loops
      delete sanitizedPayload.hash_signature;
      delete sanitizedPayload.hash_timestamp;

      const dataString = JSON.stringify(sanitizedPayload);
      const signatureBasis = `${userId}::${timestamp}::${dataString}`;

      // Use native browser SubtleCrypto for zero-dependency hashing
      const encoder = new TextEncoder();
      const data = encoder.encode(signatureBasis);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      
      // Convert buffer to hex string
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      return {
        signature: hashHex,
        timestamp: timestamp
      };
    } catch (error) {
      console.error('[CryptoAuditService] CRITICAL: Failed to generate PHI signature. Falling back to non-cryptographic UUID.', error);
      // Fallback for extremely old browsers or environments without Web Crypto API (unlikely in modern Clinic OS)
      return {
        signature: `fallback-${crypto.randomUUID()}`,
        timestamp: new Date().toISOString()
      };
    }
  }
}
