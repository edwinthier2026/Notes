import { Loader2, Mail, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchMailjetStatus, sendMailjetTest } from '../lib/api';
import type { MailjetStatus } from '../types';

export default function MailboxPage() {
  const [status, setStatus] = useState<MailjetStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('Test vanuit Notes');
  const [text, setText] = useState('Dit is een testmail vanuit het nieuwe Notes-project.');

  const loadStatus = async () => {
    setLoading(true);
    setError('');

    try {
      const nextStatus = await fetchMailjetStatus();
      setStatus(nextStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mailjet status laden mislukt.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  const handleSend = async () => {
    setSending(true);
    setError('');
    setSuccess('');

    try {
      const response = await sendMailjetTest({ to, subject, text });
      setSuccess(response.message);
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Testmail verzenden mislukt.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Mail size={24} className="text-dc-blue-500" />
          <h1 className="text-2xl font-semibold text-dc-gray-500">Mailbox</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] gap-5">
        <div className="bg-white rounded-xl border border-dc-gray-100 p-5">
          <h2 className="text-lg font-semibold text-dc-gray-500 mb-4">Status</h2>

          {loading ? (
            <div className="text-sm text-dc-gray-400 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Status laden...
            </div>
          ) : (
            <div className="space-y-3 text-sm text-dc-gray-500">
              <div>
                Geconfigureerd:
                <span className={`ml-2 font-medium ${status?.configured ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {status?.configured ? 'Ja' : 'Nee'}
                </span>
              </div>
              <div>Afzender e-mail: <span className="font-medium">{status?.senderEmail || '-'}</span></div>
              <div>Afzender naam: <span className="font-medium">{status?.senderName || '-'}</span></div>
              <div className="text-dc-gray-400">{status?.message || '-'}</div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-dc-gray-100 p-5">
          <h2 className="text-lg font-semibold text-dc-gray-500 mb-4">Testmail versturen</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-dc-gray-400 mb-1">Aan</label>
              <input
                value={to}
                onChange={(event) => setTo(event.target.value)}
                className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500"
                placeholder="naam@bedrijf.nl"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-dc-gray-400 mb-1">Onderwerp</label>
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-dc-gray-400 mb-1">Bericht</label>
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={8}
                className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500 dc-memo-textarea"
              />
            </div>

            {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
            {success && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{success}</div>}

            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={sending}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-dc-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-dc-blue-600 disabled:opacity-60"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send size={16} />}
              {sending ? 'Verzenden...' : 'Verstuur testmail'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
