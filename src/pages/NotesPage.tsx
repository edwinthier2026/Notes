import { Loader2, Plus, Search, StickyNote, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createNote, deleteNote, fetchNotes, updateNote } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import SortableTh from '../components/ui/SortableTh';
import { compareStrings, nextSortState, type SortState } from '../lib/sort';
import type { NoteInput, NoteItem, NoteStatus } from '../types';

type SortKey = 'title' | 'category' | 'status' | 'updatedAt';

const emptyForm: NoteInput = {
  title: '',
  category: 'Algemeen',
  status: 'Concept',
  excerpt: '',
  content: '',
  tags: [],
};

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('nl-NL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function parseTags(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function noteMatchesFilter(note: NoteItem, search: string, status: string): boolean {
  const haystack = [note.title, note.category, note.status, note.excerpt, note.authorName, note.tags.join(' ')].join(' ').toLowerCase();
  const searchOk = !search || haystack.includes(search.toLowerCase());
  const statusOk = status === 'Alles' || note.status === status;
  return searchOk && statusOk;
}

export default function NotesPage() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Alles' | NoteStatus>('Alles');
  const [sort, setSort] = useState<SortState<SortKey>>({ key: 'updatedAt', direction: 'desc' });
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<NoteItem | null>(null);
  const [form, setForm] = useState<NoteInput>(emptyForm);
  const [tagInput, setTagInput] = useState('');

  const loadNotes = async () => {
    setLoading(true);
    setError('');

    try {
      const nextNotes = await fetchNotes();
      setNotes(nextNotes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Notities laden mislukt.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadNotes();
  }, []);

  const filteredNotes = useMemo(() => {
    const filtered = notes.filter((note) => noteMatchesFilter(note, search, statusFilter));

    return [...filtered].sort((a, b) => {
      switch (sort.key) {
        case 'title':
          return compareStrings(a.title, b.title, sort.direction);
        case 'category':
          return compareStrings(a.category, b.category, sort.direction);
        case 'status':
          return compareStrings(a.status, b.status, sort.direction);
        case 'updatedAt':
        default:
          return compareStrings(a.updatedAt, b.updatedAt, sort.direction);
      }
    });
  }, [notes, search, sort, statusFilter]);

  const openNewEditor = () => {
    setEditingNote(null);
    setForm(emptyForm);
    setTagInput('');
    setEditorOpen(true);
    setError('');
  };

  const openEditEditor = (note: NoteItem) => {
    setEditingNote(note);
    setForm({
      title: note.title,
      category: note.category,
      status: note.status,
      excerpt: note.excerpt,
      content: note.content,
      tags: note.tags,
    });
    setTagInput(note.tags.join(', '));
    setEditorOpen(true);
    setError('');
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingNote(null);
    setForm(emptyForm);
    setTagInput('');
  };

  const handleSave = async () => {
    const payload: NoteInput = {
      ...form,
      tags: parseTags(tagInput),
    };

    setSaving(true);
    setError('');

    try {
      if (editingNote) {
        const updated = await updateNote(editingNote.id, payload);
        setNotes((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      } else {
        const created = await createNote(payload);
        setNotes((current) => [created, ...current]);
      }
      closeEditor();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Opslaan mislukt.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (note: NoteItem) => {
    const confirmed = window.confirm(`Weet je zeker dat je "${note.title}" wilt verwijderen?`);
    if (!confirmed) {
      return;
    }

    try {
      await deleteNote(note.id);
      setNotes((current) => current.filter((item) => item.id !== note.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verwijderen mislukt.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <StickyNote size={24} className="text-dc-blue-500" />
            <h1 className="text-2xl font-semibold text-dc-gray-500">Notities</h1>
          </div>
        </div>

        <button
          type="button"
          onClick={openNewEditor}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-dc-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-dc-blue-600"
        >
          <Plus size={16} />
          Nieuwe notitie
        </button>
      </div>

      <div className="bg-white rounded-xl border border-dc-gray-100 p-4">
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_220px] gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dc-gray-300" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Zoek op titel, categorie, tekst of tags"
              className="w-full rounded-lg border border-dc-gray-200 pl-9 pr-4 py-2 text-sm outline-none focus:border-dc-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'Alles' | NoteStatus)}
            className="rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500"
          >
            <option value="Alles">Alle statussen</option>
            <option value="Concept">Concept</option>
            <option value="Actief">Actief</option>
            <option value="Gearchiveerd">Gearchiveerd</option>
          </select>
        </div>
      </div>

      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</div>}

      <div className="bg-white rounded-xl border border-dc-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-white">
              <tr className="border-b border-dc-gray-100">
                <SortableTh
                  label="Titel"
                  active={sort.key === 'title'}
                  direction={sort.direction}
                  onClick={() => setSort((current) => nextSortState(current, 'title'))}
                  className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
                />
                <SortableTh
                  label="Categorie"
                  active={sort.key === 'category'}
                  direction={sort.direction}
                  onClick={() => setSort((current) => nextSortState(current, 'category'))}
                  className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
                />
                <SortableTh
                  label="Status"
                  active={sort.key === 'status'}
                  direction={sort.direction}
                  onClick={() => setSort((current) => nextSortState(current, 'status'))}
                  className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
                />
                <th className="px-5 py-3 text-left text-xs font-semibold text-dc-gray-400 uppercase">Tags</th>
                <SortableTh
                  label="Bijgewerkt"
                  active={sort.key === 'updatedAt'}
                  direction={sort.direction}
                  onClick={() => setSort((current) => nextSortState(current, 'updatedAt'))}
                  className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
                />
                <th className="px-5 py-3 text-right text-xs font-semibold text-dc-gray-400 uppercase">Acties</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-dc-gray-300">
                    <Loader2 className="inline-block h-5 w-5 animate-spin text-dc-blue-500" />
                  </td>
                </tr>
              ) : filteredNotes.length > 0 ? (
                filteredNotes.map((note, index) => (
                  <tr key={note.id} className={index % 2 === 0 ? 'dc-zebra-row' : 'bg-white'}>
                    <td className="px-5 py-3 text-dc-gray-500">
                      <div className="font-medium text-dc-gray-600">{note.title}</div>
                      <div className="text-xs text-dc-gray-400 mt-1">{note.excerpt}</div>
                    </td>
                    <td className="px-5 py-3 text-dc-gray-500">{note.category}</td>
                    <td className="px-5 py-3 text-dc-gray-500">{note.status}</td>
                    <td className="px-5 py-3 text-dc-gray-500">{note.tags.join(', ') || '-'}</td>
                    <td className="px-5 py-3 text-dc-gray-500">
                      <div>{formatDateTime(note.updatedAt)}</div>
                      <div className="text-xs text-dc-gray-400 mt-1">{note.authorName}</div>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditEditor(note)}
                          className="dc-grid-edit-btn px-3 py-1.5 rounded-lg text-xs font-medium"
                        >
                          Bewerken
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(note)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700"
                        >
                          <Trash2 size={12} />
                          Verwijderen
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-dc-gray-300">
                    Geen notities gevonden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editorOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-white rounded-2xl border border-dc-gray-100 shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-dc-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-dc-gray-500">
                  {editingNote ? 'Notitie bewerken' : 'Nieuwe notitie'}
                </h2>
                <p className="text-sm text-dc-gray-400">Auteur: {user?.naam || 'Onbekend'}</p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-dc-gray-400 mb-1">Titel</label>
                  <input
                    value={form.title}
                    onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                    className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-dc-gray-400 mb-1">Categorie</label>
                  <input
                    value={form.category}
                    onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                    className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-dc-gray-400 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as NoteStatus }))}
                    className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500"
                  >
                    <option value="Concept">Concept</option>
                    <option value="Actief">Actief</option>
                    <option value="Gearchiveerd">Gearchiveerd</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-dc-gray-400 mb-1">Tags</label>
                  <input
                    value={tagInput}
                    onChange={(event) => setTagInput(event.target.value)}
                    placeholder="bijv. klant, actielijst, meeting"
                    className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-dc-gray-400 mb-1">Samenvatting</label>
                <textarea
                  value={form.excerpt}
                  onChange={(event) => setForm((current) => ({ ...current, excerpt: event.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500 dc-memo-textarea"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-dc-gray-400 mb-1">Inhoud</label>
                <textarea
                  value={form.content}
                  onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
                  rows={9}
                  className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500 dc-memo-textarea"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-dc-gray-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeEditor}
                disabled={saving}
                className="px-4 py-2 rounded-lg border border-dc-gray-200 text-sm font-medium text-dc-gray-500 hover:bg-dc-gray-50 disabled:opacity-60"
              >
                Annuleren
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-dc-blue-500 text-white text-sm font-medium hover:bg-dc-blue-600 disabled:opacity-60"
              >
                {saving && <Loader2 className="inline w-4 h-4 mr-2 animate-spin" />}
                {saving ? 'Opslaan...' : editingNote ? 'Bijwerken' : 'Opslaan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
