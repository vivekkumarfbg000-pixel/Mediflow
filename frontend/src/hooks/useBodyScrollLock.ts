import { useEffect } from 'react';

/**
 * Custom hook to lock body scrolling when a modal, drawer, or dialog overlay is active.
 * Restores original body overflow on unmount or when isOpen becomes false.
 */
export function useBodyScrollLock(isOpen: boolean) {
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);
}
