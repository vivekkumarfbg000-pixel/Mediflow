import React, { type ReactNode } from 'react';

/**
 * GlassCard – a reusable container with a frosted‑glass appearance.
 * Uses the `.glass-panel` CSS class defined in `src/index.css`.
 * Props:
 *   children – content inside the card.
 *   className – additional classes for custom layout.
 */
export interface GlassCardProps {
  children: ReactNode;
  className?: string;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className = '' }) => {
  return (
    <div className={`glass-panel glass-panel-hover ${className}`}>
      {children}
    </div>
  );
};
