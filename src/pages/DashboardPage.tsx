import { DatabaseZap, Mail, NotebookPen, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchDashboardSummary } from '../lib/api';
import type { DashboardSummary, NoteItem } from '../types';

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('nl-NL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function StatusBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
        active ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
      }`}
    >
      {label}
    </span>
  );
}

function MetricCard({ title, value, accent }: { title: string; value: number; accent: string }) {
  return (
    <div className="bg-white rounded-xl border border-dc-gray-100 p-5">
      <div className="text-sm text-dc-gray-400">{title}</div>
      <div className={`mt-3 text-3xl font-semibold ${accent}`}>{value}</div>
    </div>
  );
}

function RecentNotesTable({ notes }: { notes: NoteItem[] }) {
  return (
    <div className="bg-white rounded-xl border border-dc-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-dc-gray-100">
        <h2 className="text-lg font-semibold text-dc-gray-500">Recente notities</h2>
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
            {notes.map((note, index) => (
              <tr key={note.id} className={index % 2 === 0 ? 'dc-zebra-row' : 'bg-white'}>
                <td className="px-5 py-3 text-dc-gray-500">
                  <div className="font-medium text-dc-gray-600">{note.title}</div>
                  <div className="text-xs text-dc-gray-400 mt-1">{note.excerpt}</div>
                </td>
                <td className="px-5 py-3 text-dc-gray-500">{note.category}</td>
                <td className="px-5 py-3 text-dc-gray-500">{note.status}</td>
                <td className="px-5 py-3 text-dc-gray-500">{formatDateTime(note.updatedAt)}</td>
              </tr>
            ))}
            {notes.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-dc-gray-300">
                  Nog geen notities beschikbaar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSummary = async () => {
    setLoading(true);
    setError('');

    try {
      const nextSummary = await fetchDashboardSummary();
      setSummary(nextSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dashboard laden mislukt.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSummary();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <NotebookPen size={24} className="text-dc-blue-500" />
            <h1 className="text-2xl font-semibold text-dc-gray-500">Dashboard</h1>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadSummary()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-dc-gray-500 border border-dc-gray-200 hover:bg-dc-gray-50 disabled:opacity-60"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Vernieuwen
        </button>
      </div>

      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard title="Totaal notities" value={summary?.totalNotes ?? 0} accent="text-dc-blue-600" />
        <MetricCard title="Actief" value={summary?.activeNotes ?? 0} accent="text-emerald-600" />
        <MetricCard title="Concept" value={summary?.draftNotes ?? 0} accent="text-amber-600" />
        <MetricCard title="Gearchiveerd" value={summary?.archivedNotes ?? 0} accent="text-slate-600" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-dc-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <DatabaseZap size={20} className="text-dc-blue-500" />
            <h2 className="text-lg font-semibold text-dc-gray-500">MariaDB</h2>
          </div>
          <div className="space-y-3 text-sm text-dc-gray-500">
            <StatusBadge active={Boolean(summary?.databaseStatus.connected)} label={summary?.databaseStatus.connected ? 'Verbonden' : 'Nog niet verbonden'} />
            <div>Host: <span className="font-medium">{summary?.databaseStatus.host || '-'}</span></div>
            <div>Gebruiker: <span className="font-medium">{summary?.databaseStatus.user || '-'}</span></div>
            <div>Database: <span className="font-medium">{summary?.databaseStatus.database || '-'}</span></div>
            <div>Records: <span className="font-medium">{summary?.databaseStatus.noteCount ?? 0}</span></div>
            <div className="text-dc-gray-400">{summary?.databaseStatus.message || 'Status wordt geladen...'}</div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-dc-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Mail size={20} className="text-dc-blue-500" />
            <h2 className="text-lg font-semibold text-dc-gray-500">Mailjet</h2>
          </div>
          <div className="space-y-3 text-sm text-dc-gray-500">
            <StatusBadge active={Boolean(summary?.mailjetStatus.configured)} label={summary?.mailjetStatus.configured ? 'Geconfigureerd' : 'Nog niet geconfigureerd'} />
            <div>Afzender: <span className="font-medium">{summary?.mailjetStatus.senderEmail || '-'}</span></div>
            <div>Naam: <span className="font-medium">{summary?.mailjetStatus.senderName || '-'}</span></div>
            <div className="text-dc-gray-400">{summary?.mailjetStatus.message || 'Status wordt geladen...'}</div>
          </div>
        </div>
      </div>

      <RecentNotesTable notes={summary?.recentNotes || []} />
    </div>
  );
}
