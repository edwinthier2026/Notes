import { useEffect, useMemo, useState } from 'react';

const APP_ALERT_EVENT = 'notes:app-alert';

function normalizeMessage(message: unknown): string {
  const raw = typeof message === 'string' ? message : String(message ?? '');
  return raw.trim() || 'Onbekende melding.';
}

export default function AppAlertHost() {
  const [queue, setQueue] = useState<string[]>([]);
  const activeMessage = useMemo(() => (queue.length > 0 ? queue[0] : ''), [queue]);

  useEffect(() => {
    const originalAlert = window.alert.bind(window);

    const enqueue = (message: unknown) => {
      const next = normalizeMessage(message);
      setQueue((current) => [...current, next]);
    };

    const eventHandler = (event: Event) => {
      const custom = event as CustomEvent<{ message?: unknown }>;
      enqueue(custom?.detail?.message);
    };

    window.addEventListener(APP_ALERT_EVENT, eventHandler as EventListener);
    window.alert = (message?: unknown) => {
      window.dispatchEvent(new CustomEvent(APP_ALERT_EVENT, { detail: { message } }));
    };

    return () => {
      window.removeEventListener(APP_ALERT_EVENT, eventHandler as EventListener);
      window.alert = originalAlert;
    };
  }, []);

  if (!activeMessage) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[1000] bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-xl border border-dc-gray-100 p-6">
        <h2 className="text-lg font-semibold text-dc-gray-500 mb-3">Melding</h2>
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 whitespace-pre-wrap">
          {activeMessage}
        </div>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => setQueue((current) => current.slice(1))}
            className="px-4 py-2 rounded-lg bg-dc-blue-500 text-white text-sm font-medium hover:bg-dc-blue-600"
          >
            Sluiten
          </button>
        </div>
      </div>
    </div>
  );
}
