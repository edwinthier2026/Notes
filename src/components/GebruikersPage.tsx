import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Search, User, XCircle, Loader2 } from 'lucide-react';
import type { Gebruiker } from '../types';
import { createNinoxGebruiker, deleteNinoxGebruiker, fetchNinoxGebruikers, updateNinoxGebruiker } from '../lib/ninox';
import { formatDateDdMmYyyy } from '../lib/date';
import { compareNumbers, compareStrings, nextSortState, type SortState } from '../lib/sort';
import { matchesAllTerms, parseSearchTerms } from '../lib/search';
import { waitForNextPaint } from '../lib/render';
import ConfirmDialog from './ui/ConfirmDialog';
import SortableTh from './ui/SortableTh';
import YesNoSlicer from './ui/YesNoSlicer';
import LoadingSpinner from './ui/LoadingSpinner';

type FormTab = 'Algemeen' | 'Rechten';

const gebruikerFormTabs: FormTab[] = ['Algemeen', 'Rechten'];

const rolKleur: Record<string, string> = {
  Beheerder: 'bg-red-50 text-red-600',
  Gebruiker: 'bg-dc-gray-50 text-dc-gray-500',
};

export default function GebruikersPage() {
  type GridSortKey = 'naam' | 'gebruikersnaam' | 'laatsteLogin' | 'beheerder' | 'toegang';
  const [items, setItems] = useState<Gebruiker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalMode, setModalMode] = useState<'nieuw' | 'bewerk' | null>(null);
  const [activeTab, setActiveTab] = useState<FormTab>('Algemeen');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [openingRowId, setOpeningRowId] = useState<number | null>(null);
  const [gebruikerVoorVerwijderen, setGebruikerVoorVerwijderen] = useState<Gebruiker | null>(null);
  const [formError, setFormError] = useState('');
  const [naam, setNaam] = useState('');
  const [gebruikersnaam, setGebruikersnaam] = useState('');
  const [wachtwoord, setWachtwoord] = useState('');
  const [email, setEmail] = useState('');
  const [functie, setFunctie] = useState('');
  const [toegang, setToegang] = useState(true);
  const [beheerder, setBeheerder] = useState(false);
  const [melding, setMelding] = useState('');
  const [relaties, setRelaties] = useState(false);
  const [afsprakenEnContracten, setAfsprakenEnContracten] = useState(false);
  const [verkoopkansen, setVerkoopkansen] = useState(false);
  const [abonnementen, setAbonnementen] = useState(false);
  const [koppelingen, setKoppelingen] = useState(false);
  const [tabellen, setTabellen] = useState(false);
  const [mailen, setMailen] = useState(false);
  const [personeel, setPersoneel] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [sort, setSort] = useState<SortState<GridSortKey>>({ key: 'naam', direction: 'asc' });
  const [zoek, setZoek] = useState('');
  const huidigeRol = beheerder ? 'Beheerder' : 'Gebruiker';

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      if (sort.key === 'naam') {
        return compareStrings(a.naam, b.naam, sort.direction);
      }
      if (sort.key === 'gebruikersnaam') {
        return compareStrings(a.gebruikersnaam || '', b.gebruikersnaam || '', sort.direction);
      }
      if (sort.key === 'laatsteLogin') {
        return compareStrings(a.laatsteLogin || '', b.laatsteLogin || '', sort.direction);
      }
      if (sort.key === 'beheerder') {
        return compareNumbers(a.beheerder ? 1 : 0, b.beheerder ? 1 : 0, sort.direction);
      }
      return compareNumbers(a.toegang ? 1 : 0, b.toegang ? 1 : 0, sort.direction);
    });
  }, [items, sort]);
  const filteredItems = useMemo(() => {
    const terms = parseSearchTerms(zoek);
    if (terms.length === 0) {
      return sortedItems;
    }
    return sortedItems.filter((item) =>
      matchesAllTerms(
        `${item.naam || ''} ${item.gebruikersnaam || ''} ${item.wachtwoord || ''} ${item.email || ''} ${item.functie || ''} ${item.melding || ''} ${item.laatsteLogin || ''}`,
        terms
      )
    );
  }, [sortedItems, zoek]);

  const loadGebruikers = async () => {
    try {
      const live = await fetchNinoxGebruikers();
      setItems(live);
      setError('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Onbekende fout';
      setError(message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadGebruikers();
  }, []);

  const resetForm = () => {
    setNaam('');
    setGebruikersnaam('');
    setWachtwoord('');
    setEmail('');
    setFunctie('');
    setToegang(true);
    setBeheerder(false);
    setMelding('');
    setRelaties(false);
    setAfsprakenEnContracten(false);
    setVerkoopkansen(false);
    setAbonnementen(false);
    setKoppelingen(false);
    setTabellen(false);
    setMailen(false);
    setPersoneel(false);
    setPlanning(false);
    setFormError('');
    setEditingId(null);
    setActiveTab('Algemeen');
  };

  const openNieuw = () => {
    resetForm();
    setModalMode('nieuw');
  };

  const openBewerk = (gebruiker: Gebruiker) => {
    setNaam(gebruiker.naam);
    setGebruikersnaam(gebruiker.gebruikersnaam || '');
    setWachtwoord(gebruiker.wachtwoord || '');
    setEmail(gebruiker.email || '');
    setFunctie(gebruiker.functie || '');
    setToegang(gebruiker.toegang);
    setBeheerder(gebruiker.beheerder);
    setMelding(gebruiker.melding || '');
    setRelaties(gebruiker.relaties || false);
    setAfsprakenEnContracten(gebruiker.afsprakenEnContracten || false);
    setVerkoopkansen(gebruiker.verkoopkansen || false);
    setAbonnementen(gebruiker.abonnementen || false);
    setKoppelingen(gebruiker.koppelingen || false);
    setTabellen(gebruiker.tabellen || false);
    setMailen(gebruiker.mailen || false);
    setPersoneel(gebruiker.personeel || false);
    setPlanning(gebruiker.planning || false);
    setFormError('');
    setEditingId(gebruiker.id);
    setActiveTab('Algemeen');
    setModalMode('bewerk');
  };

  const handleOpenBewerkFromGrid = async (gebruiker: Gebruiker) => {
    setOpeningRowId(gebruiker.id);
    await waitForNextPaint();
    try {
      openBewerk(gebruiker);
    } finally {
      setOpeningRowId(null);
    }
  };

  const closeModal = () => {
    setModalMode(null);
    resetForm();
  };

  const handleSave = async () => {
    if (!naam.trim() || !gebruikersnaam.trim()) {
      setFormError('Naam en gebruikersnaam zijn verplicht.');
      return;
    }
    if (modalMode === 'nieuw' && !wachtwoord.trim()) {
      setFormError('Naam, gebruikersnaam en wachtwoord zijn verplicht.');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      if (modalMode === 'nieuw') {
        await createNinoxGebruiker({
          naam: naam.trim(),
          gebruikersnaam: gebruikersnaam.trim(),
          wachtwoord: wachtwoord.trim(),
          email: email.trim(),
          functie: functie.trim(),
          toegang,
          beheerder,
          melding: melding.trim(),
          relaties,
          afsprakenEnContracten,
          verkoopkansen,
          abonnementen,
          koppelingen,
          tabellen,
          mailen,
          personeel,
          planning,
        });
      } else if (modalMode === 'bewerk' && editingId) {
        await updateNinoxGebruiker(editingId, {
          naam: naam.trim(),
          gebruikersnaam: gebruikersnaam.trim(),
          wachtwoord: wachtwoord.trim() || undefined,
          email: email.trim(),
          functie: functie.trim(),
          toegang,
          beheerder,
          melding: melding.trim(),
          relaties,
          afsprakenEnContracten,
          verkoopkansen,
          abonnementen,
          koppelingen,
          tabellen,
          mailen,
          personeel,
          planning,
        });
      }
      await loadGebruikers();
      closeModal();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Opslaan mislukt.';
      setFormError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (gebruiker: Gebruiker) => {
    setGebruikerVoorVerwijderen(gebruiker);
  };

  const bevestigDelete = async () => {
    if (!gebruikerVoorVerwijderen) {
      return;
    }

    setDeletingId(gebruikerVoorVerwijderen.id);
    setError('');
    try {
      await deleteNinoxGebruiker(gebruikerVoorVerwijderen.id);
      setGebruikerVoorVerwijderen(null);
      closeModal();
      await loadGebruikers();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Verwijderen mislukt.';
      setError(message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <User size={24} className="text-dc-blue-500" />
          <h1 className="text-2xl font-semibold text-dc-gray-500">Gebruikers</h1>
        </div>
        <p className="text-sm text-dc-gray-400">Tabel Gebruikers ({items.length} records)</p>
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
            onChange={(e) => setZoek(e.target.value)}
            placeholder="Zoeken op alle kolommen, meerdere kolommen zoeken mogelijk door je zoekwoorden met een , te scheiden..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-dc-gray-100 rounded-lg text-sm text-dc-gray-500 placeholder:text-dc-gray-300 focus:outline-none focus:ring-2 focus:ring-dc-blue-500/30 focus:border-dc-blue-500"
          />
        </div>
      </div>

      <LoadingSpinner active={loading} message="Gebruikers laden uit Ninox..." />
      {error && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          Ninox laden mislukt: {error}
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
                label="Toegang"
                active={sort.key === 'toegang'}
                direction={sort.direction}
                onClick={() => setSort((current) => nextSortState(current, 'toegang'))}
                className="text-center px-3 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
              />
              <SortableTh
                label="Laatst gebruikt"
                active={sort.key === 'laatsteLogin'}
                direction={sort.direction}
                onClick={() => setSort((current) => nextSortState(current, 'laatsteLogin'))}
                className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase hidden lg:table-cell"
              />
              <th className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase hidden xl:table-cell"></th>
              
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((g) => (
              <tr key={g.id} className="dc-zebra-row dc-clickable-row" onClick={() => void handleOpenBewerkFromGrid(g)}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex w-4 h-4 items-center justify-center shrink-0">
                      {openingRowId === g.id && <Loader2 className="w-4 h-4 text-dc-blue-500 animate-spin" />}
                    </span>
                    <div className="w-8 h-8 rounded-full bg-dc-blue-500 flex items-center justify-center text-white text-xs font-bold">
                      {g.naam
                        .split(' ')
                        .map((w) => w[0])
                        .join('')
                        .slice(0, 2)}
                    </div>
                    <div>
                      <div className="font-medium text-dc-gray-500">{g.naam}</div>
                      {g.email && <div className="text-xs text-dc-gray-400">{g.email}</div>}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <div className="font-medium text-dc-gray-500">{g.gebruikersnaam || '-'}</div>
                </td>
                <td className="px-3 py-3 text-center">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${rolKleur[g.rol] || rolKleur.Gebruiker}`}>{g.beheerder ? 'Ja' : 'Nee'}</span>
                </td>
                <td className="px-3 py-3 text-center">
                  {g.toegang ? <CheckCircle size={18} className="text-emerald-500 inline" /> : <XCircle size={18} className="text-red-400 inline" />}
                </td>
                <td className="px-5 py-3 text-dc-gray-400 hidden lg:table-cell">{formatDateDdMmYyyy(g.laatsteLogin)}</td>
                <td className="px-5 py-3 text-dc-gray-400 hidden xl:table-cell max-w-[18rem] truncate" title={g.melding || ''}>
                  {g.melding || '-'}
                </td>

              </tr>
              ))}
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-dc-gray-300 text-sm">
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

            <div className="flex border-b border-dc-gray-200">
              {gebruikerFormTabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={
                    activeTab === tab
                      ? 'px-4 py-2 text-sm font-medium text-dc-blue-500 border-b-2 border-dc-blue-500'
                      : 'px-4 py-2 text-sm font-medium text-dc-gray-400 hover:text-dc-gray-500'
                  }
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6 min-h-[28rem]">
              {activeTab === 'Algemeen' && (
                <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                  <div className="md:col-span-3">
                    <label className="block text-xs font-medium text-dc-gray-400 mb-1">Rol</label>
                    <input
                      value={huidigeRol}
                      disabled
                      className="w-full rounded-lg border border-dc-gray-200 bg-dc-gray-50 text-dc-gray-300 px-3 py-2 text-sm outline-none cursor-not-allowed"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-xs font-medium text-dc-gray-400 mb-1">Laatst gebruikt</label>
                    <input
                      value={modalMode === 'bewerk' ? formatDateDdMmYyyy(items.find((item) => item.id === editingId)?.laatsteLogin || '') : '-'}
                      disabled
                      className="w-full rounded-lg border border-dc-gray-200 bg-dc-gray-50 text-dc-gray-300 px-3 py-2 text-sm outline-none cursor-not-allowed"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-xs font-medium text-dc-gray-400 mb-1">Naam</label>
                    <input
                      value={naam}
                      onChange={(e) => setNaam(e.target.value)}
                      placeholder="Naam"
                      className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-xs font-medium text-dc-gray-400 mb-1">Gebruikersnaam</label>
                    <input
                      value={gebruikersnaam}
                      onChange={(e) => setGebruikersnaam(e.target.value)}
                      placeholder="Gebruikersnaam"
                      className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-xs font-medium text-dc-gray-400 mb-1">Wachtwoord</label>
                    <input
                      type="password"
                      value={wachtwoord}
                      onChange={(e) => setWachtwoord(e.target.value)}
                      placeholder="Wachtwoord"
                      className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-xs font-medium text-dc-gray-400 mb-1">E-mail</label>
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="E-mail"
                      className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-xs font-medium text-dc-gray-400 mb-1">Toegang</label>
                    <YesNoSlicer value={toegang} onChange={setToegang} disabled={saving} />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-xs font-medium text-dc-gray-400 mb-1">Beheerder</label>
                    <YesNoSlicer value={beheerder} onChange={setBeheerder} disabled={saving} />
                  </div>
                  <div className="md:col-span-1" />
                  <div className="md:col-span-3">
                    <label className="block text-xs font-medium text-dc-gray-400 mb-1">Functie</label>
                    <input
                      value={functie}
                      onChange={(e) => setFunctie(e.target.value)}
                      placeholder="Functie"
                      className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'Rechten' && (
                <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-dc-gray-400 mb-1">Relaties</label>
                    <YesNoSlicer value={relaties} onChange={setRelaties} disabled={saving} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-dc-gray-400 mb-1">Verkoopkansen</label>
                    <YesNoSlicer value={verkoopkansen} onChange={setVerkoopkansen} disabled={saving} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-dc-gray-400 mb-1">Abonnementen</label>
                    <YesNoSlicer value={abonnementen} onChange={setAbonnementen} disabled={saving} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-dc-gray-400 mb-1">Koppelingen</label>
                    <YesNoSlicer value={koppelingen} onChange={setKoppelingen} disabled={saving} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-dc-gray-400 mb-1">Tabellen</label>
                    <YesNoSlicer value={tabellen} onChange={setTabellen} disabled={saving} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-dc-gray-400 mb-1">Mailen</label>
                    <YesNoSlicer value={mailen} onChange={setMailen} disabled={saving} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-dc-gray-400 mb-1">Personeel</label>
                    <YesNoSlicer value={personeel} onChange={setPersoneel} disabled={saving} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-dc-gray-400 mb-1">Planning</label>
                    <YesNoSlicer value={planning} onChange={setPlanning} disabled={saving} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-dc-gray-400 mb-1">Afspraken en Contracten</label>
                    <YesNoSlicer value={afsprakenEnContracten} onChange={setAfsprakenEnContracten} disabled={saving} />
                  </div>
                </div>
              )}

              {formError && (
                <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {formError}
                </div>
              )}
            </div>

            <div className="border-t border-dc-blue-500 px-6 py-4 flex items-center justify-between gap-2">
              <div>
                {modalMode === 'bewerk' && editingId && (
                  <button
                    onClick={() => { const currentItem = items.find((item) => item.id === editingId); if (currentItem) { void handleDelete(currentItem); } }}
                    disabled={Boolean(editingId && deletingId === editingId)}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-colors dc-grid-delete-btn disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {editingId && deletingId === editingId ? 'Bezig...' : 'Verwijderen'}
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
        message={gebruikerVoorVerwijderen ? `Weet je zeker dat je "${gebruikerVoorVerwijderen.naam}" wilt verwijderen?` : ''}
        confirming={gebruikerVoorVerwijderen ? deletingId === gebruikerVoorVerwijderen.id : false}
        onCancel={() => setGebruikerVoorVerwijderen(null)}
        onConfirm={() => void bevestigDelete()}
      />
    </div>
  );
}
