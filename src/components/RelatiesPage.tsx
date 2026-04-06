import { Loader2, Search, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  createNinoxRelatie,
  deleteNinoxContactpersoon,
  deleteNinoxRelatie,
  fetchNinoxContactpersonenVoorRelatie,
  fetchNinoxRelatieActiefOpties,
  fetchNinoxRelatieLandOpties,
  fetchNinoxRelaties,
  fetchNinoxRelatieTypeOpties,
  updateNinoxContactpersoon,
  updateNinoxRelatie,
  type NieuweRelatieInput,
} from '../lib/ninox';
import { formatDateDdMmYyyy } from '../lib/date';
import { matchesAllTerms, parseSearchTerms } from '../lib/search';
import { compareStrings, nextSortState, type SortState } from '../lib/sort';
import type { Contactpersoon, Relatie } from '../types';
import ConfirmDialog from './ui/ConfirmDialog';
import ComboBox from './ui/ComboBox';
import DateFieldInput from './ui/DateFieldInput';
import LoadingSpinner from './ui/LoadingSpinner';
import SortableTh from './ui/SortableTh';

type GridSortKey = 'naam' | 'type' | 'actief' | 'nummerExact' | 'gestoptPer';
type ContactpersonenSortKey = 'naam' | 'functie' | 'afdeling' | 'mobiel' | 'telefoon' | 'email';
type FormTab = 'Algemeen' | 'Financieel' | 'Checklist' | 'Contactpersonen';

const relatieTabs: FormTab[] = ['Algemeen', 'Financieel', 'Checklist', 'Contactpersonen'];

export default function RelatiesPage() {
  const [items, setItems] = useState<Relatie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [zoek, setZoek] = useState('');
  const [sort, setSort] = useState<SortState<GridSortKey>>({ key: 'naam', direction: 'asc' });
  const [contactpersonenSort, setContactpersonenSort] = useState<SortState<ContactpersonenSortKey>>({
    key: 'naam',
    direction: 'asc',
  });
  const [typeOpties, setTypeOpties] = useState<string[]>([]);
  const [typeOptiesLoaded, setTypeOptiesLoaded] = useState(false);
  const [actiefOpties, setActiefOpties] = useState<string[]>([]);
  const [actiefOptiesLoaded, setActiefOptiesLoaded] = useState(false);
  const [landOpties, setLandOpties] = useState<string[]>([]);
  const [landOptiesLoaded, setLandOptiesLoaded] = useState(false);
  const [modalMode, setModalMode] = useState<'nieuw' | 'bewerk' | null>(null);
  const [activeTab, setActiveTab] = useState<FormTab>('Algemeen');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [openingRowId, setOpeningRowId] = useState<number | null>(null);
  const [relatieVoorVerwijderen, setRelatieVoorVerwijderen] = useState<Relatie | null>(null);
  const [formError, setFormError] = useState('');
  const [contactpersonen, setContactpersonen] = useState<Contactpersoon[]>([]);
  const [contactpersonenLoading, setContactpersonenLoading] = useState(false);
  const [contactpersonenError, setContactpersonenError] = useState('');
  const [contactpersonenZoek, setContactpersonenZoek] = useState('');
  const [selectedContactpersoon, setSelectedContactpersoon] = useState<Contactpersoon | null>(null);
  const [contactpersoonNaam, setContactpersoonNaam] = useState('');
  const [contactpersoonRoepnaam, setContactpersoonRoepnaam] = useState('');
  const [contactpersoonEmail, setContactpersoonEmail] = useState('');
  const [contactpersoonSaving, setContactpersoonSaving] = useState(false);
  const [contactpersoonDeleting, setContactpersoonDeleting] = useState(false);

  const [naamRelatie, setNaamRelatie] = useState('');
  const [type, setType] = useState('');
  const [actief, setActief] = useState('');
  const [nummerExact, setNummerExact] = useState('');
  const [gestoptPer, setGestoptPer] = useState('');
  const [adres, setAdres] = useState('');
  const [postcode, setPostcode] = useState('');
  const [woonplaats, setWoonplaats] = useState('');
  const [land, setLand] = useState('');
  const [standaardGrootboekrekening, setStandaardGrootboekrekening] = useState('');
  const [opmerkingen, setOpmerkingen] = useState('');

  const loadRelaties = async () => {
    try {
      const live = await fetchNinoxRelaties();
      setItems(live);
      setError('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Onbekende fout';
      setItems([]);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const loadContactpersonen = async (relatieId: number) => {
    setContactpersonenLoading(true);
    try {
      const live = await fetchNinoxContactpersonenVoorRelatie(relatieId);
      setContactpersonen(live);
      setContactpersonenError('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Onbekende fout';
      setContactpersonen([]);
      setContactpersonenError(message);
    } finally {
      setContactpersonenLoading(false);
    }
  };

  const ensureTypeOptiesLoaded = async () => {
    if (typeOptiesLoaded && typeOpties.length > 0) {
      return;
    }
    const opties = await fetchNinoxRelatieTypeOpties();
    setTypeOpties(opties);
    setTypeOptiesLoaded(true);
  };

  const ensureActiefOptiesLoaded = async () => {
    if (actiefOptiesLoaded && actiefOpties.length > 0) {
      return;
    }
    const opties = await fetchNinoxRelatieActiefOpties();
    setActiefOpties(opties);
    setActiefOptiesLoaded(true);
  };

  const ensureLandOptiesLoaded = async () => {
    if (landOptiesLoaded && landOpties.length > 0) {
      return;
    }
    const opties = await fetchNinoxRelatieLandOpties();
    setLandOpties(opties);
    setLandOptiesLoaded(true);
  };

  useEffect(() => {
    void loadRelaties();
    void ensureTypeOptiesLoaded().catch(() => {
      setTypeOpties([]);
      setTypeOptiesLoaded(true);
    });
    void ensureActiefOptiesLoaded().catch(() => {
      setActiefOpties([]);
      setActiefOptiesLoaded(true);
    });
    void ensureLandOptiesLoaded().catch(() => {
      setLandOpties([]);
      setLandOptiesLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!modalMode) {
      return;
    }
    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
    };
  }, [modalMode]);

  useEffect(() => {
    if (activeTab !== 'Contactpersonen' || !editingId) {
      setContactpersonen([]);
      setContactpersonenError('');
      setContactpersonenLoading(false);
      return;
    }
    void loadContactpersonen(editingId);
  }, [activeTab, editingId]);

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      if (sort.key === 'type') {
        return compareStrings(a.type || '', b.type || '', sort.direction);
      }
      if (sort.key === 'actief') {
        return compareStrings(a.actief || '', b.actief || '', sort.direction);
      }
      if (sort.key === 'nummerExact') {
        return compareStrings(a.nummerExact || '', b.nummerExact || '', sort.direction);
      }
      if (sort.key === 'gestoptPer') {
        return compareStrings(a.gestoptPer || '', b.gestoptPer || '', sort.direction);
      }
      return compareStrings(a.naam || '', b.naam || '', sort.direction);
    });
  }, [items, sort]);

  const filteredItems = useMemo(() => {
    const terms = parseSearchTerms(zoek);
    if (terms.length === 0) {
      return sortedItems;
    }
    return sortedItems.filter((item) =>
      matchesAllTerms(
        `${item.naam || ''} ${item.type || ''} ${item.actief || ''} ${item.nummerExact || ''} ${item.gestoptPer || ''}`,
        terms
      )
    );
  }, [sortedItems, zoek]);

  const sortedContactpersonen = useMemo(() => {
    return [...contactpersonen].sort((a, b) => {
      if (contactpersonenSort.key === 'functie') {
        return compareStrings(a.functie || '', b.functie || '', contactpersonenSort.direction);
      }
      if (contactpersonenSort.key === 'afdeling') {
        return compareStrings(a.afdeling || '', b.afdeling || '', contactpersonenSort.direction);
      }
      if (contactpersonenSort.key === 'mobiel') {
        return compareStrings(a.mobiel || '', b.mobiel || '', contactpersonenSort.direction);
      }
      if (contactpersonenSort.key === 'telefoon') {
        return compareStrings(a.telefoon || '', b.telefoon || '', contactpersonenSort.direction);
      }
      if (contactpersonenSort.key === 'email') {
        return compareStrings(a.email || '', b.email || '', contactpersonenSort.direction);
      }
      return compareStrings(a.naam || '', b.naam || '', contactpersonenSort.direction);
    });
  }, [contactpersonen, contactpersonenSort]);

  const filteredContactpersonen = useMemo(() => {
    const terms = parseSearchTerms(contactpersonenZoek);
    if (terms.length === 0) {
      return sortedContactpersonen;
    }
    return sortedContactpersonen.filter((item) =>
      matchesAllTerms(
        `${item.naam || ''} ${item.functie || ''} ${item.afdeling || ''} ${item.mobiel || ''} ${item.telefoon || ''} ${item.email || ''}`,
        terms
      )
    );
  }, [contactpersonenZoek, sortedContactpersonen]);

  const showFooter = !(activeTab === 'Contactpersonen' && !selectedContactpersoon);

  const resetForm = () => {
    setNaamRelatie('');
    setType('');
    setActief('');
    setNummerExact('');
    setGestoptPer('');
    setAdres('');
    setPostcode('');
    setWoonplaats('');
    setLand('');
    setStandaardGrootboekrekening('');
    setOpmerkingen('');
    setContactpersonen([]);
    setContactpersonenError('');
    setContactpersonenZoek('');
    setSelectedContactpersoon(null);
    setFormError('');
    setEditingId(null);
    setActiveTab('Algemeen');
  };

  const mapRelatieToInput = (): NieuweRelatieInput => ({
    naamRelatie: naamRelatie.trim(),
    type: type.trim(),
    actief: actief.trim(),
    gestoptPer: gestoptPer.trim(),
    adres: adres.trim(),
    postcode: postcode.trim(),
    woonplaats: woonplaats.trim(),
    land: land.trim(),
    standaardGrootboekrekening: standaardGrootboekrekening.trim(),
    opmerkingen: opmerkingen.trim(),
  });

  const openNieuw = async () => {
    await ensureTypeOptiesLoaded();
    await ensureActiefOptiesLoaded();
    await ensureLandOptiesLoaded();
    resetForm();
    setModalMode('nieuw');
  };

  const populateRelatieForm = async (relatie: Relatie) => {
    await ensureTypeOptiesLoaded();
    await ensureActiefOptiesLoaded();
    await ensureLandOptiesLoaded();
    setNaamRelatie(relatie.naam || '');
    setType(relatie.type || '');
    setActief(relatie.actief || '');
    setNummerExact(relatie.nummerExact || '');
    setGestoptPer(relatie.gestoptPer || '');
    setAdres(relatie.adres || '');
    setPostcode(relatie.postcode || '');
    setWoonplaats(relatie.woonplaats || '');
    setLand(relatie.land || '');
    setStandaardGrootboekrekening(relatie.standaardGrootboekrekening || '');
    setOpmerkingen(relatie.opmerkingen || '');
    setFormError('');
    setEditingId(relatie.id);
  };

  const openBewerk = async (relatie: Relatie, tab: FormTab = 'Algemeen') => {
    await populateRelatieForm(relatie);
    setActiveTab(tab);
    setModalMode('bewerk');
  };

  const handleOpenBewerkFromGrid = async (relatie: Relatie) => {
    setOpeningRowId(relatie.id);
    try {
      await openBewerk(relatie);
    } finally {
      setOpeningRowId(null);
    }
  };

  const closeModal = () => {
    setModalMode(null);
    resetForm();
  };

  const resetContactpersoonForm = () => {
    setSelectedContactpersoon(null);
    setContactpersoonNaam('');
    setContactpersoonRoepnaam('');
    setContactpersoonEmail('');
  };

  const openContactpersoon = (item: Contactpersoon) => {
    setSelectedContactpersoon(item);
    setContactpersoonNaam(item.naam || '');
    setContactpersoonRoepnaam(item.roepnaam || '');
    setContactpersoonEmail(item.email || '');
    setContactpersonenError('');
  };

  const closeContactpersoon = () => {
    resetContactpersoonForm();
  };

  const handleSave = async () => {
    if (!naamRelatie.trim()) {
      setFormError('Naam relatie is verplicht.');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const payload = mapRelatieToInput();
      if (modalMode === 'nieuw') {
        await createNinoxRelatie(payload);
      } else if (modalMode === 'bewerk' && editingId) {
        await updateNinoxRelatie(editingId, payload);
      }
      await loadRelaties();
      closeModal();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Opslaan mislukt.';
      setFormError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!editingId) {
      return;
    }
    const relatie = items.find((item) => item.id === editingId);
    if (relatie) {
      setRelatieVoorVerwijderen(relatie);
    }
  };

  const bevestigDelete = async () => {
    if (!relatieVoorVerwijderen) {
      return;
    }

    setDeletingId(relatieVoorVerwijderen.id);
    setError('');
    try {
      await deleteNinoxRelatie(relatieVoorVerwijderen.id);
      setRelatieVoorVerwijderen(null);
      closeModal();
      await loadRelaties();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Vervallen mislukt.';
      setError(message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleUpdateContactpersoon = async () => {
    if (!selectedContactpersoon) {
      return;
    }
    if (!contactpersoonNaam.trim()) {
      setContactpersonenError('Naam is verplicht.');
      return;
    }

    setContactpersoonSaving(true);
    setContactpersonenError('');
    try {
      await updateNinoxContactpersoon(selectedContactpersoon.id, {
        naam: contactpersoonNaam.trim(),
        roepnaam: contactpersoonRoepnaam.trim(),
        email: contactpersoonEmail.trim(),
      });
      if (editingId) {
        await loadContactpersonen(editingId);
      }
      closeContactpersoon();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Bijwerken mislukt.';
      setContactpersonenError(message);
    } finally {
      setContactpersoonSaving(false);
    }
  };

  const handleDeleteContactpersoon = async () => {
    if (!selectedContactpersoon) {
      return;
    }

    setContactpersoonDeleting(true);
    setContactpersonenError('');
    try {
      await deleteNinoxContactpersoon(selectedContactpersoon.id);
      if (editingId) {
        await loadContactpersonen(editingId);
      }
      closeContactpersoon();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Vervallen mislukt.';
      setContactpersonenError(message);
    } finally {
      setContactpersoonDeleting(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Users size={24} className="text-dc-blue-500" />
          <h1 className="text-2xl font-semibold text-dc-gray-500">Relaties</h1>
        </div>
        <p className="text-sm text-dc-gray-400">Tabel Relaties ({items.length} records)</p>
      </div>

      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={() => void openNieuw()}
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

      <LoadingSpinner active={loading} message="Relaties laden uit Ninox..." />
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
                label="Naam relatie"
                active={sort.key === 'naam'}
                direction={sort.direction}
                onClick={() => setSort((current) => nextSortState(current, 'naam'))}
                className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
              />
              <SortableTh
                label="Type"
                active={sort.key === 'type'}
                direction={sort.direction}
                onClick={() => setSort((current) => nextSortState(current, 'type'))}
                className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
              />
              <SortableTh
                label="Actief"
                active={sort.key === 'actief'}
                direction={sort.direction}
                onClick={() => setSort((current) => nextSortState(current, 'actief'))}
                className="text-center px-3 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
              />
              <SortableTh
                label="Nummer Exact"
                active={sort.key === 'nummerExact'}
                direction={sort.direction}
                onClick={() => setSort((current) => nextSortState(current, 'nummerExact'))}
                className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
              />
              <SortableTh
                label="Gestopt per"
                active={sort.key === 'gestoptPer'}
                direction={sort.direction}
                onClick={() => setSort((current) => nextSortState(current, 'gestoptPer'))}
                className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
              />
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => (
              <tr key={item.id} className="dc-zebra-row dc-clickable-row" onClick={() => void handleOpenBewerkFromGrid(item)}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex w-4 h-4 items-center justify-center shrink-0">
                      {openingRowId === item.id && <Loader2 className="w-4 h-4 text-dc-blue-500 animate-spin" />}
                    </span>
                    <div>
                      <div className="font-medium text-dc-gray-500">{item.naam}</div>
                      {item.email ? <div className="text-xs text-dc-gray-400">{item.email}</div> : null}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 text-dc-gray-500">{item.type || '-'}</td>
                <td
                  className={`px-3 py-3 text-center ${
                    String(item.actief || '').trim().toLowerCase() === 'gestopt'
                      ? 'text-red-600'
                      : String(item.actief || '').trim().toLowerCase() === 'actief'
                        ? 'text-emerald-600'
                        : 'text-dc-gray-500'
                  }`}
                >
                  {item.actief || '-'}
                </td>
                <td className="px-5 py-3 text-dc-gray-500">{item.nummerExact || '-'}</td>
                <td className="px-5 py-3 text-dc-gray-400">{item.gestoptPer ? formatDateDdMmYyyy(item.gestoptPer) : '-'}</td>
              </tr>
            ))}
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-dc-gray-300 text-sm">
                  Geen relaties gevonden
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
            style={{ width: '1024px', minWidth: '1024px', height: 'calc(100vh - 12rem)' }}
          >
            <div className="px-6 py-4 border-b border-dc-blue-500">
              <h2 className="text-lg font-semibold text-dc-gray-500">
                {modalMode === 'nieuw' ? 'Nieuwe relatie' : `Relatie bewerken - ${naamRelatie || ''}`}
              </h2>
            </div>

            <div className="flex border-b border-dc-gray-200">
              {relatieTabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
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
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-[repeat(16,minmax(0,1fr))] gap-3">
                    <div className="md:col-span-6">
                      <label className="block text-xs font-medium text-dc-gray-400 mb-1">Naam relatie</label>
                      <input
                        value={naamRelatie}
                        onChange={(e) => setNaamRelatie(e.target.value)}
                        placeholder="Naam relatie"
                        className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-xs font-medium text-dc-gray-400 mb-1">Type</label>
                      <ComboBox
                        value={type}
                        onChange={setType}
                        options={typeOpties.map((option) => ({ value: option, label: option }))}
                        placeholder="Type"
                        searchable={false}
                      />
                    </div>
                    <div className="md:col-span-4">
                      <label className="block text-xs font-medium text-dc-gray-400 mb-1">Actief</label>
                      <ComboBox
                        value={actief}
                        onChange={setActief}
                        options={actiefOpties.map((option) => ({ value: option, label: option }))}
                        placeholder="Actief"
                        searchable={false}
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-xs font-medium text-dc-gray-400 mb-1">Gestopt per</label>
                      <DateFieldInput value={gestoptPer} onChange={setGestoptPer} placeholder="dd/mm/yyyy" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-[repeat(16,minmax(0,1fr))] gap-3">
                    <div className="md:col-span-6">
                      <label className="block text-xs font-medium text-dc-gray-400 mb-1">Adres</label>
                      <input
                        value={adres}
                        onChange={(e) => setAdres(e.target.value)}
                        placeholder="Adres"
                        className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-xs font-medium text-dc-gray-400 mb-1">Postcode</label>
                      <input
                        value={postcode}
                        onChange={(e) => setPostcode(e.target.value)}
                        placeholder="Postcode"
                        className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500"
                      />
                    </div>
                    <div className="md:col-span-4">
                      <label className="block text-xs font-medium text-dc-gray-400 mb-1">Woonplaats</label>
                      <input
                        value={woonplaats}
                        onChange={(e) => setWoonplaats(e.target.value)}
                        placeholder="Woonplaats"
                        className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-xs font-medium text-dc-gray-400 mb-1">Land</label>
                      <ComboBox
                        value={land}
                        onChange={setLand}
                        options={landOpties.map((option) => ({ value: option, label: option }))}
                        placeholder="Land"
                        searchable={false}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-[repeat(16,minmax(0,1fr))] gap-3">
                    <div className="border-t border-red-500 my-1" style={{ gridColumn: '1 / -1' }} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-[repeat(16,minmax(0,1fr))] gap-3">
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label className="block text-xs font-medium text-dc-gray-400 mb-1">Opmerkingen</label>
                      <textarea
                        value={opmerkingen}
                        onChange={(e) => setOpmerkingen(e.target.value)}
                        rows={4}
                        className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500 resize-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'Financieel' && (
                <div className="grid grid-cols-1 md:grid-cols-[repeat(16,minmax(0,1fr))] gap-3">
                  <div className="md:col-span-8">
                    <label className="block text-xs font-medium text-dc-gray-400 mb-1">Standaard grootboekrekening</label>
                    <input
                      value={standaardGrootboekrekening}
                      onChange={(e) => setStandaardGrootboekrekening(e.target.value)}
                      placeholder="Standaard grootboekrekening"
                      className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500"
                    />
                  </div>
                  <div className="md:col-span-4">
                    <label className="block text-xs font-medium text-dc-gray-400 mb-1">Nummer Exact</label>
                    <input
                      value={nummerExact}
                      onChange={(e) => setNummerExact(e.target.value)}
                      placeholder="Nummer Exact"
                      className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'Checklist' && (
                <div className="grid grid-cols-1 md:grid-cols-[repeat(16,minmax(0,1fr))] gap-3">
                  <div className="md:col-span-16 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    Checklist-tab is aangemaakt. De inhoud hiervan werken we hierna verder uit.
                  </div>
                </div>
              )}

              {activeTab === 'Contactpersonen' && (
                <div className="space-y-4">
                  {!editingId ? (
                    <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      Sla deze relatie eerst op voordat contactpersonen gekoppeld kunnen worden.
                    </div>
                  ) : (
                    <>
                      {!selectedContactpersoon && (
                        <div className="flex flex-col gap-3 md:flex-row md:items-center">
                          <button
                            type="button"
                            onClick={() => setContactpersonenError('Formulier voor nieuwe contactpersonen volgt hierna.')}
                            className="px-4 py-2 rounded-lg bg-yellow-400 text-dc-gray-700 text-sm font-medium hover:bg-yellow-500"
                          >
                            Nieuw
                          </button>
                          <div className="relative w-full flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dc-gray-300" />
                            <input
                              value={contactpersonenZoek}
                              onChange={(e) => setContactpersonenZoek(e.target.value)}
                              placeholder="Zoeken op alle kolommen, meerdere kolommen zoeken mogelijk door je zoekwoorden met een , te scheiden..."
                              className="w-full rounded-lg border border-dc-gray-200 bg-white pl-9 pr-3 py-2 text-sm text-dc-gray-500 outline-none focus:border-dc-blue-500"
                            />
                          </div>
                        </div>
                      )}

                      {contactpersonenError && (
                        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                          {contactpersonenError}
                        </div>
                      )}

                      {!selectedContactpersoon ? (
                        <div className="bg-white rounded-xl border border-dc-gray-100 overflow-hidden">
                          <table className="min-w-full text-sm">
                            <thead className="bg-dc-gray-50">
                              <tr>
                                <SortableTh
                                  label="Naam"
                                  active={contactpersonenSort.key === 'naam'}
                                  direction={contactpersonenSort.direction}
                                  onClick={() => setContactpersonenSort((current) => nextSortState(current, 'naam'))}
                                  className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400"
                                />
                                <SortableTh
                                  label="Functie"
                                  active={contactpersonenSort.key === 'functie'}
                                  direction={contactpersonenSort.direction}
                                  onClick={() => setContactpersonenSort((current) => nextSortState(current, 'functie'))}
                                  className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400"
                                />
                                <SortableTh
                                  label="Afdeling"
                                  active={contactpersonenSort.key === 'afdeling'}
                                  direction={contactpersonenSort.direction}
                                  onClick={() => setContactpersonenSort((current) => nextSortState(current, 'afdeling'))}
                                  className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400"
                                />
                                <SortableTh
                                  label="Mobiel"
                                  active={contactpersonenSort.key === 'mobiel'}
                                  direction={contactpersonenSort.direction}
                                  onClick={() => setContactpersonenSort((current) => nextSortState(current, 'mobiel'))}
                                  className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400"
                                />
                                <SortableTh
                                  label="Telefoon"
                                  active={contactpersonenSort.key === 'telefoon'}
                                  direction={contactpersonenSort.direction}
                                  onClick={() => setContactpersonenSort((current) => nextSortState(current, 'telefoon'))}
                                  className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400"
                                />
                                <SortableTh
                                  label="Email"
                                  active={contactpersonenSort.key === 'email'}
                                  direction={contactpersonenSort.direction}
                                  onClick={() => setContactpersonenSort((current) => nextSortState(current, 'email'))}
                                  className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400"
                                />
                              </tr>
                            </thead>
                            <tbody>
                              {contactpersonenLoading ? (
                                <tr>
                                  <td colSpan={6} className="px-5 py-8">
                                    <div className="flex items-center justify-center">
                                      <LoadingSpinner message="Contactpersonen laden..." overlay={false} size="md" />
                                    </div>
                                  </td>
                                </tr>
                              ) : filteredContactpersonen.map((item, index) => (
                                <tr
                                  key={item.id}
                                  onClick={() => openContactpersoon(item)}
                                  className={`${index % 2 === 0 ? 'dc-zebra-row' : 'bg-white'} dc-clickable-row cursor-pointer`}
                                >
                                  <td className="px-5 py-3 text-dc-gray-500">{item.naam || '-'}</td>
                                  <td className="px-5 py-3 text-dc-gray-500">{item.functie || '-'}</td>
                                  <td className="px-5 py-3 text-dc-gray-500">{item.afdeling || '-'}</td>
                                  <td className="px-5 py-3 text-dc-gray-500">{item.mobiel || '-'}</td>
                                  <td className="px-5 py-3 text-dc-gray-500">{item.telefoon || '-'}</td>
                                  <td className="px-5 py-3 text-dc-gray-500">{item.email || '-'}</td>
                                </tr>
                              ))}
                              {!contactpersonenLoading && filteredContactpersonen.length === 0 && (
                                <tr>
                                  <td colSpan={6} className="px-5 py-8 text-center text-dc-gray-300 text-sm">
                                    Geen contactpersonen gevonden
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-[repeat(16,minmax(0,1fr))] gap-3">
                            <div className="md:col-span-4">
                              <label className="block text-xs font-medium text-dc-gray-400 mb-1">Naam</label>
                              <input
                                value={contactpersoonNaam}
                                onChange={(e) => setContactpersoonNaam(e.target.value)}
                                className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500"
                              />
                            </div>
                            <div className="md:col-span-4">
                              <label className="block text-xs font-medium text-dc-gray-400 mb-1">Roepnaam</label>
                              <input
                                value={contactpersoonRoepnaam}
                                onChange={(e) => setContactpersoonRoepnaam(e.target.value)}
                                className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-[repeat(16,minmax(0,1fr))] gap-3">
                            <div className="md:col-span-6">
                              <label className="block text-xs font-medium text-dc-gray-400 mb-1">Email</label>
                              <input
                                value={contactpersoonEmail}
                                onChange={(e) => setContactpersoonEmail(e.target.value)}
                                className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {formError && (
                <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {formError}
                </div>
              )}
            </div>

            {showFooter && (
              <div className="border-t border-dc-blue-500 px-6 py-4 flex items-center justify-between">
                <div>
                  {activeTab === 'Contactpersonen' ? (
                    <button
                      type="button"
                      onClick={() => void handleDeleteContactpersoon()}
                      disabled={contactpersoonSaving || contactpersoonDeleting}
                      className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {contactpersoonDeleting && <Loader2 className="inline w-4 h-4 mr-2 animate-spin" />}
                      {contactpersoonDeleting ? 'Bezig...' : 'Vervallen'}
                    </button>
                  ) : modalMode === 'bewerk' && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={saving || deletingId === editingId}
                      className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {deletingId === editingId && <Loader2 className="inline w-4 h-4 mr-2 animate-spin" />}
                      {deletingId === editingId ? 'Bezig...' : 'Vervallen'}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={activeTab === 'Contactpersonen' ? closeContactpersoon : closeModal}
                    disabled={saving || contactpersoonSaving || contactpersoonDeleting}
                    className="px-4 py-2 rounded-lg border border-dc-gray-200 text-sm font-medium text-dc-gray-500 hover:bg-dc-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    Annuleren
                  </button>
                  <button
                    type="button"
                    onClick={activeTab === 'Contactpersonen' ? () => void handleUpdateContactpersoon() : () => void handleSave()}
                    disabled={saving || contactpersoonSaving || contactpersoonDeleting}
                    className="px-4 py-2 rounded-lg bg-dc-blue-500 text-white text-sm font-medium hover:bg-dc-blue-600 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {(saving || contactpersoonSaving) && <Loader2 className="inline w-4 h-4 mr-2 animate-spin" />}
                    {saving || contactpersoonSaving ? 'Bezig...' : activeTab === 'Contactpersonen' ? 'Bijwerken' : modalMode === 'nieuw' ? 'Opslaan' : 'Bijwerken'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(relatieVoorVerwijderen)}
        title="Relatie vervallen"
        message={`Weet u zeker dat relatie ${relatieVoorVerwijderen?.naam || ''} vervallen mag worden?`}
        cancelLabel="Nee"
        confirmLabel="Ja"
        confirming={deletingId === relatieVoorVerwijderen?.id}
        onCancel={() => {
          if (!deletingId) {
            setRelatieVoorVerwijderen(null);
          }
        }}
        onConfirm={() => void bevestigDelete()}
      />
    </div>
  );
}
