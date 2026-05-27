import React, { type ReactNode } from 'react';
import { api } from '../../services/api';

interface RequireRoleProps {
  /** List of roles permitted to see the children. */
  allowedRoles: string[];
  children: ReactNode;
  /** The role currently selected in the UI. */
  role: string;
  /** When true, bypass standard role restrictions for testing. */
  bypass?: boolean;
  /** Optional fallback UI; defaults to a denial card. */
  fallback?: ReactNode;
}

/**
 * RequireRole – wraps any dashboard section and hides it from
 * roles that are not in `allowedRoles`. Uses the UI's current
 * selected role so access decisions match the rendered section.
 * Developer bypass mode disables the guard for testing.
 */
export const RequireRole: React.FC<RequireRoleProps> = ({
  allowedRoles,
  children,
  fallback,
  role = api.simulatedRole,
  bypass = false,
}) => {
  if (bypass || allowedRoles.includes(role)) {
    return <>{children}</>;
  }

  return (
    <>
      {fallback ?? (
        <div className="glass-panel p-8 flex flex-col items-center justify-center gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center">
            <svg className="w-8 h-8 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-clinical-50">Access Restricted</h2>
          <p className="text-sm text-clinical-300">
            Your current role (<strong>{role}</strong>) does not have permission to view this section.
            <br />
            Required: <span className="font-medium text-primary">{allowedRoles.join(', ')}</span>
          </p>
        </div>
      )}
    </>
  );
};
