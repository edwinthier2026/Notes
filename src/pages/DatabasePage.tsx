import { DatabaseZap, Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchDatabaseStatus, fetchNotes } from '../lib/api';
import type { DatabaseStatus, NoteItem } from '../types';

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('nl-NL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function DatabasePage() {
  const [status, setStatus] = useState<DatabaseStatus | null>(null);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      const [nextStatus, nextNotes] = await Promise.all([fetchDatabaseStatus(), fetchNotes()]);
      setStatus(nextStatus);
      setNotes(nextNotes.slice(0, 8));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Databaseoverzicht laden mislukt.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <DatabaseZap size={24} className="text-dc-blue-500" />
            <h1 className="text-2xl font-semibold text-dc-gray-500">Database</h1>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadData()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-dc-gray-500 border border-dc-gray-200 hover:bg-dc-gray-50 disabled:opacity-60"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Vernieuwen
        </button>
      </div>

      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] gap-5">
        <div className="bg-white rounded-xl border border-dc-gray-100 p-5">
          <h2 className="text-lg font-semibold text-dc-gray-500 mb-4">Connectie</h2>

          {loading ? (
            <div className="text-sm text-dc-gray-400 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Status laden...
            </div>
          ) : (
            <div className="space-y-3 text-sm text-dc-gray-500">
              <div>Geconfigureerd: <span className="font-medium">{status?.configured ? 'Ja' : 'Nee'}</span></div>
              <div>Verbonden: <span className="font-medium">{status?.connected ? 'Ja' : 'Nee'}</span></div>
              <div>Host: <span className="font-medium">{status?.host || '-'}</span></div>
              <div>Database: <span className="font-medium">{status?.database || '-'}</span></div>
              <div>Records: <span className="font-medium">{status?.noteCount ?? 0}</span></div>
              <div className="text-dc-gray-400">{status?.message || '-'}</div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-dc-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-dc-gray-100">
            <h2 className="text-lg font-semibold text-dc-gray-500">Laatste records</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-dc-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-dc-gray-400 uppercase">Titel</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-dc-gray-400 uppercase">Categorie</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-dc-gray-400 uppercase">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-dc-gray-400 uppercase">Bijgewerkt</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-dc-gray-300">
                      <Loader2 className="inline-block h-5 w-5 animate-spin text-dc-blue-500" />
                    </td>
                  </tr>
                ) : notes.length > 0 ? (
                  notes.map((note, index) => (
                    <tr key={note.id} className={index % 2 === 0 ? 'dc-zebra-row' : 'bg-white'}>
                      <td className="px-5 py-3 text-dc-gray-500">{note.title}</td>
                      <td className="px-5 py-3 text-dc-gray-500">{note.category}</td>
                      <td className="px-5 py-3 text-dc-gray-500">{note.status}</td>
                      <td className="px-5 py-3 text-dc-gray-500">{formatDateTime(note.updatedAt)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-dc-gray-300">
                      Geen records gevonden.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
