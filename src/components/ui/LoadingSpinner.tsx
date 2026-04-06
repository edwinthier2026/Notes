import { Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface LoadingSpinnerProps {
  active?: boolean;
  message?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  overlay?: boolean;
  minVisibleMs?: number;
}

/**
 * Centrale loading spinner voor het laden van grote datasets (grids).
 * Toont een grote spinner met optioneel bericht in het midden van het scherm.
 * 
 * Gebruikt voor:
 * - Laden van alle Ninox tabellen bij page mount
 * - Trage data operaties (online kan Ninox trager reageren dan lokaal)
 */
export default function LoadingSpinner({
  active = true,
  message = 'Gegevens laden...',
  size = 'xl',
  overlay = true,
  minVisibleMs = 300,
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-20 h-20',
  };
  const [visible, setVisible] = useState(active);
  const shownAtRef = useRef<number | null>(active ? Date.now() : null);
  const hideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    if (active) {
      if (!visible) {
        shownAtRef.current = Date.now();
        setVisible(true);
      } else if (shownAtRef.current === null) {
        shownAtRef.current = Date.now();
      }
      return;
    }

    if (!visible) {
      shownAtRef.current = null;
      return;
    }

    const shownAt = shownAtRef.current ?? Date.now();
    const elapsed = Date.now() - shownAt;
    const waitMs = Math.max(0, minVisibleMs - elapsed);
    hideTimerRef.current = window.setTimeout(() => {
      setVisible(false);
      shownAtRef.current = null;
      hideTimerRef.current = null;
    }, waitMs);

    return () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [active, minVisibleMs, visible]);

  if (!visible) {
    return null;
  }

  if (overlay) {
    return (
      <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 pointer-events-none">
        <div className="flex flex-col items-center justify-center">
          <Loader2 className={`${sizeClasses[size]} text-dc-blue-500 animate-spin ${message ? 'mb-4' : ''}`} />
          {message ? <p className="text-lg text-dc-gray-500 font-medium">{message}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] py-12">
      <Loader2 className={`${sizeClasses[size]} text-dc-blue-500 animate-spin ${message ? 'mb-4' : ''}`} />
      {message ? <p className="text-lg text-dc-gray-500 font-medium">{message}</p> : null}
    </div>
  );
}
