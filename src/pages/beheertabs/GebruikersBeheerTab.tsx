import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Eye, EyeOff, Loader2, Search, User, XCircle } from 'lucide-react';
import type { GebruikerBeheerInput, GebruikerBeheerItem } from '../../types';
import { createAdminUser, deleteAdminUser, fetchAdminUsers, updateAdminUser } from '../../lib/api';
import { waitForNextPaint } from '../../lib/render';
import { compareNumbers, compareStrings, nextSortState, type SortState } from '../../lib/sort';
import SortableTh from '../../components/ui/SortableTh';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import YesNoSlicer from '../../components/ui/YesNoSlicer';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

type GridSortKey = 'naam' | 'gebruikersnaam' | 'beheerder' | 'email';

const rolKleur: Record<'Beheerder' | 'Medewerker', string> = {
  Beheerder: 'bg-red-50 text-red-600',
  Medewerker: 'bg-dc-gray-50 text-dc-gray-500',
};

const emptyForm: GebruikerBeheerInput = {
  naam: '',
  gebruikersnaam: '',
  wachtwoord: '',
  email: '',
  beheerder: false,
};

function matchesSearch(item: GebruikerBeheerItem, search: string): boolean {
  if (!search.trim()) {
    return true;
  }

  const terms = search
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

  if (terms.length === 0) {
    return true;
  }

  const haystack = `${item.naam} ${item.gebruikersnaam} ${item.email} ${item.rol}`.toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

export default function GebruikersBeheerTab() {
  const [items, setItems] = useState<GebruikerBeheerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sort, setSort] = useState<SortState<GridSortKey>>({ key: 'naam', direction: 'asc' });
  const [zoek, setZoek] = useState('');
  const [modalMode, setModalMode] = useState<'nieuw' | 'bewerk' | null>(null);
  const [form, setForm] = useState<GebruikerBeheerInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [editingOriginalUsername, setEditingOriginalUsername] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [gebruikerVoorVerwijderen, setGebruikerVoorVerwijderen] = useState<GebruikerBeheerItem | null>(null);
  const [openingRowKey, setOpeningRowKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await fetchAdminUsers());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gebruikers laden mislukt.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const filteredItems = useMemo(() => {
    const searched = items.filter((item) => matchesSearch(item, zoek));
    return [...searched].sort((a, b) => {
      if (sort.key === 'gebruikersnaam') {
        return compareStrings(a.gebruikersnaam, b.gebruikersnaam, sort.direction);
      }
      if (sort.key === 'beheerder') {
        return compareNumbers(a.beheerder ? 1 : 0, b.beheerder ? 1 : 0, sort.direction);
      }
      if (sort.key === 'email') {
        return compareStrings(a.email, b.email, sort.direction);
      }
      return compareStrings(a.naam, b.naam, sort.direction);
    });
  }, [items, sort, zoek]);

  const resetForm = () => {
    setForm(emptyForm);
    setFormError('');
    setEditingOriginalUsername('');
    setShowPassword(false);
  };

  const openNieuw = () => {
    resetForm();
    setModalMode('nieuw');
  };

  const openBewerk = (item: GebruikerBeheerItem) => {
    setForm({
      naam: item.naam,
      gebruikersnaam: item.gebruikersnaam,
      wachtwoord: item.wachtwoord,
      email: item.email,
      beheerder: item.beheerder,
    });
    setEditingOriginalUsername(item.gebruikersnaam);
    setFormError('');
    setModalMode('bewerk');
  };

  const closeModal = () => {
    setModalMode(null);
    resetForm();
  };

  const handleOpenFromGrid = async (item: GebruikerBeheerItem) => {
    setOpeningRowKey(item.sleutel);
    await waitForNextPaint();
    openBewerk(item);
    setOpeningRowKey('');
  };

  const handleSave = async () => {
    if (!form.naam.trim() || !form.gebruikersnaam.trim()) {
      setFormError('Naam en gebruikersnaam zijn verplicht.');
      return;
    }
    if (!form.wachtwoord.trim()) {
      setFormError('Wachtwoord is verplicht.');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      if (modalMode === 'nieuw') {
        await createAdminUser({
          naam: form.naam.trim(),
          gebruikersnaam: form.gebruikersnaam.trim(),
          wachtwoord: form.wachtwoord.trim(),
          email: form.email.trim(),
          beheerder: form.beheerder,
        });
      } else if (modalMode === 'bewerk') {
        await updateAdminUser(editingOriginalUsername, {
          naam: form.naam.trim(),
          gebruikersnaam: form.gebruikersnaam.trim(),
          wachtwoord: form.wachtwoord.trim(),
          email: form.email.trim(),
          beheerder: form.beheerder,
        });
      }

      await loadUsers();
      closeModal();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Opslaan mislukt.');
    } finally {
      setSaving(false);
    }
  };

  const bevestigDelete = async () => {
    if (!gebruikerVoorVerwijderen) {
      return;
    }

    setDeleting(true);
    try {
      await deleteAdminUser(gebruikerVoorVerwijderen.gebruikersnaam);
      setGebruikerVoorVerwijderen(null);
      closeModal();
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verwijderen mislukt.');
    } finally {
      setDeleting(false);
    }
  };

  const huidigeRol = form.beheerder ? 'Beheerder' : 'Medewerker';

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <User size={24} className="text-dc-blue-500" />
          <h1 className="text-2xl font-semibold text-dc-gray-500">Gebruikers</h1>
        </div>
      </div>

      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <button
          onClick={openNieuw}
          className="px-4 py-2 rounded-lg bg-dc-blue-500 text-white text-sm font-medium hover:bg-dc-blue-600"
        >
          Nieuw
        </button>
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dc-gray-300" />
          <input
            type="text"
            value={zoek}
            onChange={(event) => setZoek(event.target.value)}
            placeholder="Zoeken op alle kolommen, meerdere kolommen zoeken mogelijk door je zoekwoorden met een , te scheiden..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-dc-gray-100 rounded-lg text-sm text-dc-gray-500 placeholder:text-dc-gray-300 focus:outline-none focus:ring-2 focus:ring-dc-blue-500/30 focus:border-dc-blue-500"
          />
        </div>
      </div>

      <LoadingSpinner active={loading} message="Gebruikers laden uit MariaDB..." />
      {error && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          Gebruikers laden mislukt: {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-dc-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dc-gray-100">
              <SortableTh
                label="Naam"
                active={sort.key === 'naam'}
                direction={sort.direction}
                onClick={() => setSort((current) => nextSortState(current, 'naam'))}
                className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
              />
              <SortableTh
                label="Gebruikersnaam"
                active={sort.key === 'gebruikersnaam'}
                direction={sort.direction}
                onClick={() => setSort((current) => nextSortState(current, 'gebruikersnaam'))}
                className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
              />
              <SortableTh
                label="Beheerder"
                active={sort.key === 'beheerder'}
                direction={sort.direction}
                onClick={() => setSort((current) => nextSortState(current, 'beheerder'))}
                className="text-center px-3 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
              />
              <SortableTh
                label="E-mail"
                active={sort.key === 'email'}
                direction={sort.direction}
                onClick={() => setSort((current) => nextSortState(current, 'email'))}
                className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
              />
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => (
              <tr key={item.sleutel} className="dc-zebra-row dc-clickable-row" onClick={() => void handleOpenFromGrid(item)}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex w-4 h-4 items-center justify-center shrink-0">
                      {openingRowKey === item.sleutel ? <Loader2 className="w-4 h-4 text-dc-blue-500 animate-spin" /> : null}
                    </span>
                    <div className="w-8 h-8 rounded-full bg-dc-blue-500 flex items-center justify-center text-white text-xs font-bold">
                      {item.naam
                        .split(' ')
                        .map((part) => part[0])
                        .join('')
                        .slice(0, 2)}
                    </div>
                    <div>
                      <div className="font-medium text-dc-gray-500">{item.naam}</div>
                      <div className="text-xs text-dc-gray-400">{item.rol}</div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 text-dc-gray-500">{item.gebruikersnaam}</td>
                <td className="px-3 py-3 text-center">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${rolKleur[item.rol]}`}>
                    {item.beheerder ? 'Ja' : 'Nee'}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-dc-gray-500">{item.email || '-'}</span>
                    {item.beheerder ? (
                      <CheckCircle size={18} className="text-emerald-500 shrink-0" />
                    ) : (
                      <XCircle size={18} className="text-dc-gray-300 shrink-0" />
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-dc-gray-300 text-sm">
                  Geen gebruikers gevonden
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modalMode && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div
            className="w-full max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] bg-white rounded-xl border border-dc-gray-100 overflow-hidden flex flex-col"
            style={{ width: '768px', minWidth: '768px' }}
          >
            <div className="px-6 py-4 border-b border-dc-blue-500">
              <h2 className="text-lg font-semibold text-dc-gray-500">
                {modalMode === 'nieuw' ? 'Nieuwe gebruiker' : 'Gebruiker bewerken'}
              </h2>
            </div>

            <div className="flex-1 overflow-y-auto p-6 min-h-[24rem]">
              <div className="grid grid-cols-1 md:grid-cols-[repeat(16,minmax(0,1fr))] gap-3">
                <div className="md:col-span-4">
                  <label className="block text-xs font-medium text-dc-gray-400 mb-1">Rol</label>
                  <input
                    value={huidigeRol}
                    disabled
                    className="w-full rounded-lg border border-dc-gray-200 bg-dc-gray-50 text-dc-gray-300 px-3 py-2 text-sm outline-none cursor-not-allowed"
                  />
                </div>
                <div className="md:col-span-4">
                  <label className="block text-xs font-medium text-dc-gray-400 mb-1">Beheerder</label>
                  <YesNoSlicer value={form.beheerder} onChange={(beheerder) => setForm((current) => ({ ...current, beheerder }))} disabled={saving} />
                </div>
                <div className="md:col-span-8">
                  <label className="block text-xs font-medium text-dc-gray-400 mb-1">E-mail</label>
                  <input
                    value={form.email}
                    onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                    placeholder="E-mail"
                    className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500"
                  />
                </div>
                <div className="md:col-span-4">
                  <label className="block text-xs font-medium text-dc-gray-400 mb-1">Naam</label>
                  <input
                    value={form.naam}
                    onChange={(event) => setForm((current) => ({ ...current, naam: event.target.value }))}
                    placeholder="Naam"
                    className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500"
                  />
                </div>
                <div className="md:col-span-4">
                  <label className="block text-xs font-medium text-dc-gray-400 mb-1">Gebruikersnaam</label>
                  <input
                    value={form.gebruikersnaam}
                    onChange={(event) => setForm((current) => ({ ...current, gebruikersnaam: event.target.value }))}
                    placeholder="Gebruikersnaam"
                    className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500"
                  />
                </div>
                <div className="md:col-span-4">
                  <label className="block text-xs font-medium text-dc-gray-400 mb-1">Wachtwoord</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={form.wachtwoord}
                      onChange={(event) => setForm((current) => ({ ...current, wachtwoord: event.target.value }))}
                      placeholder="Wachtwoord"
                      className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 pr-10 text-sm outline-none focus:border-dc-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-dc-gray-300 transition-colors hover:text-dc-gray-500"
                      aria-label={showPassword ? 'Wachtwoord verbergen' : 'Wachtwoord tonen'}
                      title={showPassword ? 'Wachtwoord verbergen' : 'Wachtwoord tonen'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div className="md:col-span-4" />
                <div className="md:col-span-4" />
              </div>

              {formError && (
                <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {formError}
                </div>
              )}
            </div>

            <div className="border-t border-dc-blue-500 px-6 py-4 flex items-center justify-between gap-2">
              <div>
                {modalMode === 'bewerk' && (
                  <button
                    onClick={() => {
                      const current = items.find((item) => item.gebruikersnaam === editingOriginalUsername);
                      if (current) {
                        setGebruikerVoorVerwijderen(current);
                      }
                    }}
                    disabled={deleting}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-colors dc-grid-delete-btn disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {deleting ? 'Bezig...' : 'Verwijderen'}
                  </button>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 rounded-lg border border-dc-gray-200 text-sm text-dc-gray-500 hover:bg-dc-gray-50"
                >
                  Annuleren
                </button>
                <button
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-dc-blue-500 text-white text-sm font-medium hover:bg-dc-blue-600 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saving && <Loader2 className="inline w-4 h-4 mr-2 animate-spin" />}
                  {saving ? (modalMode === 'nieuw' ? 'Opslaan...' : 'Bijwerken...') : modalMode === 'nieuw' ? 'Opslaan' : 'Bijwerken'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(gebruikerVoorVerwijderen)}
        title="Verwijderen"
        message={
          gebruikerVoorVerwijderen
            ? `Weet je zeker dat je "${gebruikerVoorVerwijderen.naam}" wilt verwijderen?`
            : ''
        }
        confirmLabel="Verwijderen"
        confirming={deleting}
        onCancel={() => setGebruikerVoorVerwijderen(null)}
        onConfirm={() => void bevestigDelete()}
      />
    </div>
  );
}
