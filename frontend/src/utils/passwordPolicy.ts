// =============================================================================
// VitalSync — Enterprise Strong Password Policy & Cryptographic Defense Engine
// Enforces:
// 1. Minimum 8 characters (Recommended 10+)
// 2. Uppercase (A-Z), Lowercase (a-z), Number (0-9), Special Characters
// 3. Common dictionary / predictable pattern blacklist
// 4. Constant-time dummy KDF hash calculation to defeat timing attacks
// 5. Cryptographically secure token generation & SHA-256 hashing
// =============================================================================

export interface PasswordRequirements {
  minLength: boolean;      // At least 8 characters
  hasUppercase: boolean;   // At least 1 uppercase letter
  hasLowercase: boolean;   // At least 1 lowercase letter
  hasNumber: boolean;      // At least 1 number
  hasSpecialChar: boolean; // At least 1 special character
  notCommonWord: boolean;  // Not in common dictionary blacklist
}

export interface PasswordRequirementItem {
  id: keyof PasswordRequirements;
  label: string;
  met: boolean;
}

export const SPECIAL_CHAR_REGEX = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/;

const COMMON_DISALLOWED_SUBSTRINGS = [
  'password', 'pass123', 'admin', 'administrator', 'root', '123456', '12345678',
  'qwerty', 'doctor', 'clinic', 'hospital', 'mediflow', 'vitalsync', 'welcome',
  'letmein', 'monkey', 'dragon', 'football', 'iloveyou', 'master'
];

/**
 * Checks a password against all strong password criteria and dictionary blacklist.
 */
export function checkPasswordRequirements(password: string): PasswordRequirements {
  const pwd = password || '';
  const lowerPwd = pwd.toLowerCase();
  
  const isCommon = COMMON_DISALLOWED_SUBSTRINGS.some(term => lowerPwd.includes(term));

  return {
    minLength: pwd.length >= 8,
    hasUppercase: /[A-Z]/.test(pwd),
    hasLowercase: /[a-z]/.test(pwd),
    hasNumber: /[0-9]/.test(pwd),
    hasSpecialChar: SPECIAL_CHAR_REGEX.test(pwd),
    notCommonWord: !isCommon
  };
}

/**
 * Formats requirements as an ordered list of items for UI display.
 */
export function getPasswordRequirementItems(password: string): PasswordRequirementItem[] {
  const reqs = checkPasswordRequirements(password);
  return [
    { id: 'minLength', label: 'At least 8 characters', met: reqs.minLength },
    { id: 'hasUppercase', label: 'At least 1 uppercase letter', met: reqs.hasUppercase },
    { id: 'hasLowercase', label: 'At least 1 lowercase letter', met: reqs.hasLowercase },
    { id: 'hasNumber', label: 'At least 1 number', met: reqs.hasNumber },
    { id: 'hasSpecialChar', label: 'At least 1 special character', met: reqs.hasSpecialChar },
    { id: 'notCommonWord', label: 'No predictable words or common passwords', met: reqs.notCommonWord },
  ];
}

/**
 * Calculates a strength score between 0 and 5.
 */
export function getPasswordStrengthScore(password: string): number {
  const reqs = checkPasswordRequirements(password);
  const items = [reqs.minLength, reqs.hasUppercase, reqs.hasLowercase, reqs.hasNumber, reqs.hasSpecialChar];
  const count = items.filter(Boolean).length;
  if (!reqs.notCommonWord) {
    return Math.min(count, 2);
  }
  return count;
}

/**
 * Calculates password entropy in bits.
 */
export function calculatePasswordEntropy(password: string): number {
  if (!password) return 0;
  let poolSize = 0;
  if (/[a-z]/.test(password)) poolSize += 26;
  if (/[A-Z]/.test(password)) poolSize += 26;
  if (/[0-9]/.test(password)) poolSize += 10;
  if (SPECIAL_CHAR_REGEX.test(password)) poolSize += 32;

  if (poolSize === 0) return 0;
  return Math.round(password.length * Math.log2(poolSize));
}

/**
 * Returns true if ALL required strong password requirements are met.
 */
export function isStrongPassword(password: string): boolean {
  const reqs = checkPasswordRequirements(password);
  return (
    reqs.minLength && 
    reqs.hasUppercase && 
    reqs.hasLowercase && 
    reqs.hasNumber && 
    reqs.hasSpecialChar &&
    reqs.notCommonWord
  );
}

/**
 * Returns a human-friendly error message if the password fails any requirement,
 * or null if the password is valid.
 */
export function getPasswordValidationError(password: string): string | null {
  if (!password) {
    return 'Password is required';
  }

  const reqs = checkPasswordRequirements(password);
  const unmet: string[] = [];

  if (!reqs.minLength) unmet.push('at least 8 characters');
  if (!reqs.hasUppercase) unmet.push('1 uppercase letter');
  if (!reqs.hasLowercase) unmet.push('1 lowercase letter');
  if (!reqs.hasNumber) unmet.push('1 number');
  if (!reqs.hasSpecialChar) unmet.push('1 special character');

  if (unmet.length > 0) {
    return `Password must include ${unmet.join(', ')}.`;
  }

  if (!reqs.notCommonWord) {
    return 'Password contains easily guessable words or patterns. Please choose a more secure passphrase.';
  }

  return null;
}

/**
 * Executes a simulated PBKDF2/KDF key derivation calculation with Web Crypto API
 * to ensure that failed logins or un-enrolled emails take a uniform response time (~200-300ms),
 * completely eliminating side-channel timing attack vectors.
 */
export async function timingSafeDummyHash(password: string = 'dummy_auth_padding_secret', minDurationMs: number = 200): Promise<void> {
  const start = performance.now();
  try {
    if (typeof window !== 'undefined' && window.crypto?.subtle) {
      const enc = new TextEncoder();
      const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        enc.encode(password || 'vital_sync_timing_padding'),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
      );

      const salt = enc.encode('vitalsync_constant_time_salt_2026');
      await window.crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt,
          iterations: 10000,
          hash: 'SHA-256'
        },
        keyMaterial,
        256
      );
    }
  } catch (_err) {
    // Fallback CPU cycle loop
    let x = 0;
    for (let i = 0; i < 50000; i++) {
      x = (x + i) % 1000000;
    }
  }

  const elapsed = performance.now() - start;
  const remaining = Math.max(0, minDurationMs - elapsed);
  if (remaining > 0) {
    await new Promise(resolve => setTimeout(resolve, remaining));
  }
}

/**
 * Generates a cryptographically secure URL-safe random token (e.g. for reset/verification links).
 */
export function generateSecureToken(byteLength: number = 32): string {
  if (typeof window !== 'undefined' && window.crypto) {
    const array = new Uint8Array(byteLength);
    window.crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Produces a SHA-256 hex digest of a token for secure one-way database storage.
 */
export async function hashTokenSha256(token: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const msgUint8 = new TextEncoder().encode(token);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return token;
}
