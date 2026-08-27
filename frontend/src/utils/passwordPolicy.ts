// =============================================================================
// VitalSync — Enterprise Strong Password Policy Engine
// Enforces the 5 Elements of a Strong Password:
// 1. At least 8 characters
// 2. At least 1 uppercase letter (A-Z)
// 3. At least 1 lowercase letter (a-z)
// 4. At least 1 number (0-9)
// 5. At least 1 special character (!@#$%^&*...)
// =============================================================================

export interface PasswordRequirements {
  minLength: boolean;      // At least 8 characters
  hasUppercase: boolean;   // At least 1 uppercase letter
  hasLowercase: boolean;   // At least 1 lowercase letter
  hasNumber: boolean;      // At least 1 number
  hasSpecialChar: boolean; // At least 1 special character
}

export interface PasswordRequirementItem {
  id: keyof PasswordRequirements;
  label: string;
  met: boolean;
}

export const SPECIAL_CHAR_REGEX = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/;

/**
 * Checks a password against all 5 strong password criteria.
 */
export function checkPasswordRequirements(password: string): PasswordRequirements {
  const pwd = password || '';
  return {
    minLength: pwd.length >= 8,
    hasUppercase: /[A-Z]/.test(pwd),
    hasLowercase: /[a-z]/.test(pwd),
    hasNumber: /[0-9]/.test(pwd),
    hasSpecialChar: SPECIAL_CHAR_REGEX.test(pwd),
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
  ];
}

/**
 * Calculates a strength score between 0 and 5.
 */
export function getPasswordStrengthScore(password: string): number {
  const reqs = checkPasswordRequirements(password);
  return Object.values(reqs).filter(Boolean).length;
}

/**
 * Returns true if ALL 5 strong password requirements are met.
 */
export function isStrongPassword(password: string): boolean {
  const reqs = checkPasswordRequirements(password);
  return reqs.minLength && reqs.hasUppercase && reqs.hasLowercase && reqs.hasNumber && reqs.hasSpecialChar;
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

  if (unmet.length === 0) return null;

  return `Password must include ${unmet.join(', ')}.`;
}
