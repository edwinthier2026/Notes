import { FileText, LayoutDashboard, Loader2, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  createNinoxContactpersoon,
  fetchNinoxAfsprakenContractBlokkenVoorRelatie,
  fetchNinoxAfsprakenEnContractenVoorRelatie,
  fetchNinoxContactpersonen,
  fetchNinoxDossierDocument,
  fetchNinoxInkoopopdrachtDocument,
  fetchNinoxRelaties,
  updateNinoxContactpersoon,
  deleteNinoxContactpersoon,
} from '../lib/ninox';
import { formatDutchNumber } from '../lib/amount';
import { formatDateDdMmYyyy } from '../lib/date';
import { matchesAllTerms, parseSearchTerms } from '../lib/search';
import { compareStrings, nextSortState, type SortState } from '../lib/sort';
import type { Contactpersoon, DossierItem, InkoopopdrachtItem, PrijsafspraakItem, Relatie } from '../types';
import ConfirmDialog from './ui/ConfirmDialog';
import LoadingSpinner from './ui/LoadingSpinner';
import SortableTh from './ui/SortableTh';

type RelatieZoekSortKey = 'naam' | 'type' | 'actief' | 'nummerExact' | 'gestoptPer';
type ContactpersoonZoekSortKey = 'naam' | 'functie' | 'afdeling' | 'mobiel' | 'telefoon' | 'email';
type DossierDashboardSortKey = 'typeDocument' | 'omschrijving' | 'startdatum' | 'einddatum';
type InkoopDashboardSortKey = 'omschrijving' | 'startdatum' | 'einddatum';
type PrijsDashboardSortKey = 'artikel' | 'prijs' | 'eenheid';

export default function HomePage() {
  const { user } = useAuth();
  const [zoekterm, setZoekterm] = useState('');
  const [zoektermUitgevoerd, setZoektermUitgevoerd] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [heeftGezocht, setHeeftGezocht] = useState(false);
  const [relaties, setRelaties] = useState<Relatie[]>([]);
  const [contactpersonen, setContactpersonen] = useState<Contactpersoon[]>([]);
  const [geselecteerdeRelatieId, setGeselecteerdeRelatieId] = useState<number | null>(null);
  const [geselecteerdeContactpersoonId, setGeselecteerdeContactpersoonId] = useState<number | null>(null);
  const [relatieAfsprakenLoading, setRelatieAfsprakenLoading] = useState(false);
  const [relatieAfsprakenError, setRelatieAfsprakenError] = useState('');
  const [relatieDossierItems, setRelatieDossierItems] = useState<DossierItem[]>([]);
  const [relatieInkoopItems, setRelatieInkoopItems] = useState<InkoopopdrachtItem[]>([]);
  const [relatiePrijsItems, setRelatiePrijsItems] = useState<PrijsafspraakItem[]>([]);
  const [relatieSort, setRelatieSort] = useState<SortState<RelatieZoekSortKey>>({ key: 'naam', direction: 'asc' });
  const [contactpersoonSort, setContactpersoonSort] = useState<SortState<ContactpersoonZoekSortKey>>({ key: 'naam', direction: 'asc' });
  const [contactpersonenZoek, setContactpersonenZoek] = useState('');
  const [dashboardContactpersoonMode, setDashboardContactpersoonMode] = useState<'nieuw' | 'bewerk'>('bewerk');
  const [dashboardContactpersoon, setDashboardContactpersoon] = useState<Contactpersoon | null>(null);
  const [dashboardContactpersoonNaam, setDashboardContactpersoonNaam] = useState('');
  const [dashboardContactpersoonRoepnaam, setDashboardContactpersoonRoepnaam] = useState('');
  const [dashboardContactpersoonEmail, setDashboardContactpersoonEmail] = useState('');
  const [dashboardContactpersoonError, setDashboardContactpersoonError] = useState('');
  const [dashboardContactpersoonSaving, setDashboardContactpersoonSaving] = useState(false);
  const [dashboardContactpersoonDeleting, setDashboardContactpersoonDeleting] = useState(false);
  const [dashboardContactpersoonVoorVerwijderen, setDashboardContactpersoonVoorVerwijderen] = useState<Contactpersoon | null>(null);
  const [openingDossierId, setOpeningDossierId] = useState<number | null>(null);
  const [openingInkoopId, setOpeningInkoopId] = useState<number | null>(null);
  const [dossierSort, setDossierSort] = useState<SortState<DossierDashboardSortKey>>({ key: 'typeDocument', direction: 'asc' });
  const [inkoopSort, setInkoopSort] = useState<SortState<InkoopDashboardSortKey>>({ key: 'omschrijving', direction: 'asc' });
  const [prijsSort, setPrijsSort] = useState<SortState<PrijsDashboardSortKey>>({ key: 'artikel', direction: 'asc' });

  const relatieResultaten = useMemo(() => {
    const terms = parseSearchTerms(zoektermUitgevoerd);
    if (terms.length === 0) {
      return [];
    }
    const filtered = relaties
      .filter((item) =>
        matchesAllTerms(
          `${item.naam || ''} ${item.type || ''} ${item.actief || ''} ${item.nummerExact || ''} ${item.gestoptPer || ''} ${item.adres || ''} ${item.postcode || ''} ${item.woonplaats || ''} ${item.land || ''} ${item.standaardGrootboekrekening || ''} ${item.opmerkingen || ''}`,
          terms
        )
      )
      .filter((item) => {
        if (!geselecteerdeContactpersoonId) {
          return true;
        }
        const selectedContactpersoon = contactpersonen.find((entry) => entry.id === geselecteerdeContactpersoonId);
        if (!selectedContactpersoon || !Array.isArray(selectedContactpersoon.relatieIds) || selectedContactpersoon.relatieIds.length === 0) {
          return false;
        }
        return selectedContactpersoon.relatieIds.includes(item.id);
      });
    return [...filtered].sort((a, b) => {
      if (relatieSort.key === 'type') {
        return compareStrings(a.type || '', b.type || '', relatieSort.direction);
      }
      if (relatieSort.key === 'actief') {
        return compareStrings(a.actief || '', b.actief || '', relatieSort.direction);
      }
      if (relatieSort.key === 'nummerExact') {
        return compareStrings(a.nummerExact || '', b.nummerExact || '', relatieSort.direction);
      }
      if (relatieSort.key === 'gestoptPer') {
        return compareStrings(a.gestoptPer || '', b.gestoptPer || '', relatieSort.direction);
      }
      return compareStrings(a.naam || '', b.naam || '', relatieSort.direction);
    });
  }, [contactpersonen, geselecteerdeContactpersoonId, relatieSort, relaties, zoektermUitgevoerd]);

  const effectieveRelatieId = useMemo(() => {
    if (geselecteerdeRelatieId) {
      return geselecteerdeRelatieId;
    }
    return relatieResultaten.length === 1 ? relatieResultaten[0].id : null;
  }, [geselecteerdeRelatieId, relatieResultaten]);

  const effectieveRelatie = useMemo(
    () => (effectieveRelatieId ? relaties.find((item) => item.id === effectieveRelatieId) ?? null : null),
    [effectieveRelatieId, relaties]
  );

  const zichtbareRelatieResultaten = useMemo(() => {
    if (!effectieveRelatieId) {
      return relatieResultaten;
    }
    return relatieResultaten.filter((item) => item.id === effectieveRelatieId);
  }, [effectieveRelatieId, relatieResultaten]);

  const sortedRelatieDossierItems = useMemo(() => {
    return [...relatieDossierItems].sort((a, b) => {
      if (dossierSort.key === 'omschrijving') {
        return compareStrings(a.omschrijving || '', b.omschrijving || '', dossierSort.direction);
      }
      if (dossierSort.key === 'startdatum') {
        return compareStrings(a.startdatum || '', b.startdatum || '', dossierSort.direction);
      }
      if (dossierSort.key === 'einddatum') {
        return compareStrings(a.einddatum || '', b.einddatum || '', dossierSort.direction);
      }
      return compareStrings(a.typeDocument || '', b.typeDocument || '', dossierSort.direction);
    });
  }, [dossierSort, relatieDossierItems]);

  const sortedRelatieInkoopItems = useMemo(() => {
    return [...relatieInkoopItems].sort((a, b) => {
      if (inkoopSort.key === 'startdatum') {
        return compareStrings(a.startdatum || '', b.startdatum || '', inkoopSort.direction);
      }
      if (inkoopSort.key === 'einddatum') {
        return compareStrings(a.einddatum || '', b.einddatum || '', inkoopSort.direction);
      }
      return compareStrings(a.omschrijving || '', b.omschrijving || '', inkoopSort.direction);
    });
  }, [inkoopSort, relatieInkoopItems]);

  const sortedRelatiePrijsItems = useMemo(() => {
    return [...relatiePrijsItems].sort((a, b) => {
      if (prijsSort.key === 'prijs') {
        return (prijsSort.direction === 'asc' ? 1 : -1) * ((a.prijs || 0) - (b.prijs || 0));
      }
      if (prijsSort.key === 'eenheid') {
        return compareStrings(a.eenheid || '', b.eenheid || '', prijsSort.direction);
      }
      return compareStrings(a.artikel || '', b.artikel || '', prijsSort.direction);
    });
  }, [prijsSort, relatiePrijsItems]);

  useEffect(() => {
    let cancelled = false;

    const loadRelatieBlokken = async () => {
      if (!effectieveRelatieId) {
        setRelatieDossierItems([]);
        setRelatieInkoopItems([]);
        setRelatiePrijsItems([]);
        setRelatieAfsprakenError('');
        setRelatieAfsprakenLoading(false);
        return;
      }

      setRelatieAfsprakenLoading(true);
      setRelatieAfsprakenError('');
      try {
        const afsprakenVoorRelatie = await fetchNinoxAfsprakenEnContractenVoorRelatie(effectieveRelatieId);
        const blokken = await fetchNinoxAfsprakenContractBlokkenVoorRelatie(effectieveRelatieId);

        if (cancelled) {
          return;
        }

        if (afsprakenVoorRelatie.length === 0 || blokken.afspraakIds.length === 0) {
          setRelatieDossierItems([]);
          setRelatieInkoopItems([]);
          setRelatiePrijsItems([]);
          return;
        }

        setRelatieDossierItems(blokken.dossierItems);
        setRelatieInkoopItems(blokken.inkoopItems);
        setRelatiePrijsItems(blokken.prijsItems);
      } catch (err) {
        if (cancelled) {
          return;
        }
        setRelatieDossierItems([]);
        setRelatieInkoopItems([]);
        setRelatiePrijsItems([]);
        setRelatieAfsprakenError(err instanceof Error ? err.message : 'Onbekende fout bij laden van gerelateerde regels.');
      } finally {
        if (!cancelled) {
          setRelatieAfsprakenLoading(false);
        }
      }
    };

    void loadRelatieBlokken();

    return () => {
      cancelled = true;
    };
  }, [effectieveRelatieId]);

  const closeDashboardContactpersoonModal = () => {
    setDashboardContactpersoon(null);
    setDashboardContactpersoonMode('bewerk');
    setDashboardContactpersoonNaam('');
    setDashboardContactpersoonRoepnaam('');
    setDashboardContactpersoonEmail('');
    setDashboardContactpersoonError('');
    setDashboardContactpersoonVoorVerwijderen(null);
  };

  const openDashboardContactpersoonModal = (item: Contactpersoon) => {
    setDashboardContactpersoonMode('bewerk');
    setDashboardContactpersoon(item);
    setDashboardContactpersoonNaam(item.naam || '');
    setDashboardContactpersoonRoepnaam(item.roepnaam || '');
    setDashboardContactpersoonEmail(item.email || '');
    setDashboardContactpersoonError('');
    setDashboardContactpersoonVoorVerwijderen(null);
  };

  const openNieuwDashboardContactpersoonModal = () => {
    if (!effectieveRelatieId) {
      setDashboardContactpersoonError('Selecteer eerst een relatie voordat je een contactpersoon toevoegt.');
      return;
    }
    setDashboardContactpersoonMode('nieuw');
    setDashboardContactpersoon({
      id: 0,
      naam: '',
      roepnaam: '',
      email: '',
      relatieIds: [effectieveRelatieId],
    });
    setDashboardContactpersoonNaam('');
    setDashboardContactpersoonRoepnaam('');
    setDashboardContactpersoonEmail('');
    setDashboardContactpersoonError('');
    setDashboardContactpersoonVoorVerwijderen(null);
  };

  const refreshDashboardContactpersonen = async () => {
    const live = await fetchNinoxContactpersonen();
    setContactpersonen(live);
  };

  const handleDashboardContactpersoonSave = async () => {
    if (!dashboardContactpersoon) {
      return;
    }
    if (!dashboardContactpersoonNaam.trim()) {
      setDashboardContactpersoonError('Naam is verplicht.');
      return;
    }

    setDashboardContactpersoonSaving(true);
    setDashboardContactpersoonError('');
    try {
      if (dashboardContactpersoonMode === 'nieuw') {
        if (!effectieveRelatieId) {
          throw new Error('Geen relatie geselecteerd voor deze nieuwe contactpersoon.');
        }
        await createNinoxContactpersoon({
          relatieId: effectieveRelatieId,
          naam: dashboardContactpersoonNaam.trim(),
          roepnaam: dashboardContactpersoonRoepnaam.trim(),
          email: dashboardContactpersoonEmail.trim(),
        });
      } else {
        await updateNinoxContactpersoon(dashboardContactpersoon.id, {
          naam: dashboardContactpersoonNaam.trim(),
          roepnaam: dashboardContactpersoonRoepnaam.trim(),
          email: dashboardContactpersoonEmail.trim(),
        });
      }
      await refreshDashboardContactpersonen();
      closeDashboardContactpersoonModal();
    } catch (err) {
      setDashboardContactpersoonError(err instanceof Error ? err.message : 'Bijwerken mislukt.');
    } finally {
      setDashboardContactpersoonSaving(false);
    }
  };

  const bevestigDashboardContactpersoonDelete = async () => {
    if (!dashboardContactpersoonVoorVerwijderen) {
      return;
    }

    setDashboardContactpersoonDeleting(true);
    setDashboardContactpersoonError('');
    try {
      await deleteNinoxContactpersoon(dashboardContactpersoonVoorVerwijderen.id);
      await refreshDashboardContactpersonen();
      closeDashboardContactpersoonModal();
    } catch (err) {
      setDashboardContactpersoonError(err instanceof Error ? err.message : 'Verwijderen mislukt.');
    } finally {
      setDashboardContactpersoonDeleting(false);
    }
  };

  const handleOpenDashboardDossierPdf = async (item: DossierItem) => {
    setOpeningDossierId(item.id);
    setRelatieAfsprakenError('');
    try {
      const doc = await fetchNinoxDossierDocument(item.id);
      if (!doc) {
        setRelatieAfsprakenError('Geen PDF gevonden voor deze dossierregel.');
        return;
      }
      const url = URL.createObjectURL(doc.blob);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'PDF openen mislukt.';
      setRelatieAfsprakenError(message);
    } finally {
      setOpeningDossierId(null);
    }
  };

  const handleOpenDashboardInkoopPdf = async (item: InkoopopdrachtItem) => {
    setOpeningInkoopId(item.id);
    setRelatieAfsprakenError('');
    try {
      const doc = await fetchNinoxInkoopopdrachtDocument(item.id);
      if (!doc) {
        setRelatieAfsprakenError('Geen PDF gevonden voor deze inkoopopdracht.');
        return;
      }
      const url = URL.createObjectURL(doc.blob);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'PDF openen mislukt.';
      setRelatieAfsprakenError(message);
    } finally {
      setOpeningInkoopId(null);
    }
  };

  const contactpersoonResultaten = useMemo(() => {
    const terms = parseSearchTerms(zoektermUitgevoerd);
    const lokaleTerms = parseSearchTerms(contactpersonenZoek);
    if (terms.length === 0) {
      return [];
    }
    const filtered = contactpersonen
      .filter((item) => {
        if (effectieveRelatieId) {
          return Array.isArray(item.relatieIds) && item.relatieIds.includes(effectieveRelatieId);
        }
        return matchesAllTerms(
          `${item.naam || ''} ${item.roepnaam || ''} ${item.functie || ''} ${item.afdeling || ''} ${item.mobiel || ''} ${item.telefoon || ''} ${item.email || ''}`,
          terms
        );
      })
      .filter((item) => {
        if (lokaleTerms.length === 0) {
          return true;
        }
        return matchesAllTerms(
          `${item.naam || ''} ${item.roepnaam || ''} ${item.functie || ''} ${item.afdeling || ''} ${item.mobiel || ''} ${item.telefoon || ''} ${item.email || ''}`,
          lokaleTerms
        );
      });
    return [...filtered].sort((a, b) => {
      if (contactpersoonSort.key === 'functie') {
        return compareStrings(a.functie || '', b.functie || '', contactpersoonSort.direction);
      }
      if (contactpersoonSort.key === 'afdeling') {
        return compareStrings(a.afdeling || '', b.afdeling || '', contactpersoonSort.direction);
      }
      if (contactpersoonSort.key === 'mobiel') {
        return compareStrings(a.mobiel || '', b.mobiel || '', contactpersoonSort.direction);
      }
      if (contactpersoonSort.key === 'telefoon') {
        return compareStrings(a.telefoon || '', b.telefoon || '', contactpersoonSort.direction);
      }
      if (contactpersoonSort.key === 'email') {
        return compareStrings(a.email || '', b.email || '', contactpersoonSort.direction);
      }
      return compareStrings(a.naam || '', b.naam || '', contactpersoonSort.direction);
    });
  }, [contactpersoonSort, contactpersonen, contactpersonenZoek, effectieveRelatieId, zoektermUitgevoerd]);

  const handleZoeken = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = zoekterm.trim();
    const terms = parseSearchTerms(trimmed);
    if (terms.length === 0) {
      setHeeftGezocht(false);
      setZoektermUitgevoerd('');
      setRelaties([]);
      setContactpersonen([]);
      setGeselecteerdeContactpersoonId(null);
      setGeselecteerdeRelatieId(null);
      setSearchError('');
      return;
    }

    setSearching(true);
    setSearchError('');
    setHeeftGezocht(true);
    setGeselecteerdeContactpersoonId(null);
    setGeselecteerdeRelatieId(null);
    setZoektermUitgevoerd(trimmed);
    try {
      const [relatiesData, contactpersonenData] = await Promise.all([fetchNinoxRelaties(), fetchNinoxContactpersonen()]);
      setRelaties(relatiesData);
      setContactpersonen(contactpersonenData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Onbekende fout bij zoeken.';
      setRelaties([]);
      setContactpersonen([]);
      setSearchError(message);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <LayoutDashboard size={24} className="text-dc-blue-500" />
          <h1 className="text-2xl font-semibold text-dc-gray-500">Dashboard</h1>
        </div>
        <p className="text-sm text-dc-gray-400">NinoxPlanning overzicht voor {user?.naam || 'gebruiker'}</p>
      </div>

      <form onSubmit={handleZoeken} className="mb-6 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dc-gray-300" />
          <input
            value={zoekterm}
            onChange={(e) => setZoekterm(e.target.value)}
            placeholder="Zoeken in Relaties en Contactpersonen, meerdere kolommen zoeken mogelijk door je zoekwoorden met een , te scheiden..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-dc-gray-100 rounded-lg text-sm text-dc-gray-500 placeholder:text-dc-gray-300 focus:outline-none focus:ring-2 focus:ring-dc-blue-500/30 focus:border-dc-blue-500"
          />
        </div>
        <button
          type="submit"
          disabled={searching}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {searching ? <Loader2 className="inline w-4 h-4 mr-2 animate-spin" /> : <Search size={16} />}
          {searching ? 'Bezig...' : 'Zoeken'}
        </button>
      </form>

      {searchError && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          Zoeken mislukt: {searchError}
        </div>
      )}

      {searching && <LoadingSpinner active={searching} message="Zoekresultaten laden uit Ninox..." />}

      {heeftGezocht && !searching && (
        <div className="space-y-6">
          <div>
            <div className="mb-3">
              <h2 className="text-lg font-semibold text-dc-gray-500">
                Relaties <span className="text-sm font-normal text-dc-gray-400">- na kiezen relatie worden Afspraken en Contracten getoond</span>
              </h2>
            </div>
            <div className="bg-white rounded-xl border border-dc-gray-100 overflow-hidden">
              <div className={`${effectieveRelatie ? 'max-h-[5.25rem]' : 'max-h-[31rem]'} overflow-y-auto`}>
                <table className="w-full text-sm">
                  <thead className="bg-white">
                    <tr className="border-b border-dc-gray-100">
                      <SortableTh
                        label="Naam relatie"
                        active={relatieSort.key === 'naam'}
                        direction={relatieSort.direction}
                        onClick={() => setRelatieSort((current) => nextSortState(current, 'naam'))}
                        className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
                      />
                      <SortableTh
                        label="Type"
                        active={relatieSort.key === 'type'}
                        direction={relatieSort.direction}
                        onClick={() => setRelatieSort((current) => nextSortState(current, 'type'))}
                        className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
                      />
                      <SortableTh
                        label="Actief"
                        active={relatieSort.key === 'actief'}
                        direction={relatieSort.direction}
                        onClick={() => setRelatieSort((current) => nextSortState(current, 'actief'))}
                        className="text-center px-3 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
                      />
                      <SortableTh
                        label="Nummer Exact"
                        active={relatieSort.key === 'nummerExact'}
                        direction={relatieSort.direction}
                        onClick={() => setRelatieSort((current) => nextSortState(current, 'nummerExact'))}
                        className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
                      />
                      <SortableTh
                        label="Gestopt per"
                        active={relatieSort.key === 'gestoptPer'}
                        direction={relatieSort.direction}
                        onClick={() => setRelatieSort((current) => nextSortState(current, 'gestoptPer'))}
                        className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {zichtbareRelatieResultaten.map((item, index) => (
                      <tr
                        key={item.id}
                        onClick={() => {
                          setGeselecteerdeRelatieId(item.id);
                          setGeselecteerdeContactpersoonId(null);
                        }}
                        className={`dc-clickable-row cursor-pointer ${
                          effectieveRelatieId === item.id
                            ? 'bg-dc-blue-50'
                            : zichtbareRelatieResultaten.length === 1
                              ? 'bg-white'
                              : index % 2 === 0
                              ? 'dc-zebra-row'
                              : 'bg-white'
                        }`}
                      >
                        <td className="px-5 py-3">
                          <div className="font-medium text-dc-gray-500">{item.naam || '-'}</div>
                          {item.email ? <div className="text-xs text-dc-gray-400">{item.email}</div> : null}
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
                    {zichtbareRelatieResultaten.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-5 py-8 text-center text-dc-gray-300 text-sm">
                          Geen relaties gevonden
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-3">
              <h2 className="text-lg font-semibold text-dc-gray-500">Contactpersonen</h2>
            </div>
            {effectieveRelatie && (
              <div className="mb-3 rounded-lg border border-dc-blue-100 bg-dc-blue-50 px-3 py-2 text-sm text-dc-blue-700">
                Geselecteerde relatie: <span className="font-medium">{effectieveRelatie.naam || '-'}</span>
              </div>
            )}
            <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center">
              {effectieveRelatie ? (
                <button
                  type="button"
                  onClick={openNieuwDashboardContactpersoonModal}
                  className="px-4 py-2 rounded-lg bg-dc-blue-500 text-white text-sm font-medium hover:bg-dc-blue-600"
                >
                  Nieuw
                </button>
              ) : null}
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
            <div className="bg-white rounded-xl border border-dc-gray-100 overflow-hidden">
              <div className="max-h-[13.5rem] overflow-y-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-white">
                    <tr className="border-b border-dc-gray-100">
                      <SortableTh
                        label="Naam"
                        active={contactpersoonSort.key === 'naam'}
                        direction={contactpersoonSort.direction}
                        onClick={() => setContactpersoonSort((current) => nextSortState(current, 'naam'))}
                        className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
                      />
                      <SortableTh
                        label="Functie"
                        active={contactpersoonSort.key === 'functie'}
                        direction={contactpersoonSort.direction}
                        onClick={() => setContactpersoonSort((current) => nextSortState(current, 'functie'))}
                        className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
                      />
                      <SortableTh
                        label="Afdeling"
                        active={contactpersoonSort.key === 'afdeling'}
                        direction={contactpersoonSort.direction}
                        onClick={() => setContactpersoonSort((current) => nextSortState(current, 'afdeling'))}
                        className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
                      />
                      <SortableTh
                        label="Mobiel"
                        active={contactpersoonSort.key === 'mobiel'}
                        direction={contactpersoonSort.direction}
                        onClick={() => setContactpersoonSort((current) => nextSortState(current, 'mobiel'))}
                        className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
                      />
                      <SortableTh
                        label="Telefoon"
                        active={contactpersoonSort.key === 'telefoon'}
                        direction={contactpersoonSort.direction}
                        onClick={() => setContactpersoonSort((current) => nextSortState(current, 'telefoon'))}
                        className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
                      />
                      <SortableTh
                        label="Email"
                        active={contactpersoonSort.key === 'email'}
                        direction={contactpersoonSort.direction}
                        onClick={() => setContactpersoonSort((current) => nextSortState(current, 'email'))}
                        className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {contactpersoonResultaten.map((item, index) => (
                      <tr
                        key={item.id}
                        onClick={() => openDashboardContactpersoonModal(item)}
                        className={`dc-clickable-row cursor-pointer ${
                          geselecteerdeContactpersoonId === item.id
                            ? 'bg-dc-blue-50'
                            : index % 2 === 0
                              ? 'dc-zebra-row'
                              : 'bg-white'
                        }`}
                      >
                        <td className="px-5 py-3 text-dc-gray-500">{item.naam || '-'}</td>
                        <td className="px-5 py-3 text-dc-gray-500">{item.functie || '-'}</td>
                        <td className="px-5 py-3 text-dc-gray-500">{item.afdeling || '-'}</td>
                        <td className="px-5 py-3 text-dc-gray-500">{item.mobiel || '-'}</td>
                        <td className="px-5 py-3 text-dc-gray-500">{item.telefoon || '-'}</td>
                        <td className="px-5 py-3 text-dc-gray-500">{item.email || '-'}</td>
                      </tr>
                    ))}
                    {contactpersoonResultaten.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-5 py-8 text-center text-dc-gray-300 text-sm">
                          Geen contactpersonen gevonden
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {effectieveRelatie && (
            <div className="space-y-3">
              {relatieAfsprakenError && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  Gerelateerde regels laden mislukt: {relatieAfsprakenError}
                </div>
              )}

              {relatieAfsprakenLoading ? (
                <LoadingSpinner active={true} message="" />
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                  <div>
                    <div className="mb-3">
                      <h2 className="text-lg font-semibold text-dc-gray-500">Dossier</h2>
                    </div>
                    <div className="bg-white rounded-xl border border-dc-gray-100 overflow-hidden">
                      <div className="max-h-[16rem] overflow-y-auto">
                        <table className="min-w-full text-sm">
                          <thead className="bg-white">
                            <tr className="border-b border-dc-gray-100">
                              <SortableTh
                                label="Type document"
                                active={dossierSort.key === 'typeDocument'}
                                direction={dossierSort.direction}
                                onClick={() => setDossierSort((current) => nextSortState(current, 'typeDocument'))}
                                className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
                              />
                              <SortableTh
                                label="Startdatum"
                                active={dossierSort.key === 'startdatum'}
                                direction={dossierSort.direction}
                                onClick={() => setDossierSort((current) => nextSortState(current, 'startdatum'))}
                                className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
                              />
                              <SortableTh
                                label="Einddatum"
                                active={dossierSort.key === 'einddatum'}
                                direction={dossierSort.direction}
                                onClick={() => setDossierSort((current) => nextSortState(current, 'einddatum'))}
                                className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
                              />
                            </tr>
                          </thead>
                          <tbody>
                            {sortedRelatieDossierItems.map((item, index) => (
                              <tr
                                key={item.id}
                                onClick={() => void handleOpenDashboardDossierPdf(item)}
                                className={`${index % 2 === 0 ? 'dc-zebra-row' : 'bg-white'} dc-clickable-row cursor-pointer`}
                              >
                                <td className="px-5 py-3 text-dc-gray-500">
                                  <div className="flex items-center gap-3">
                                    <span className="inline-flex w-4 h-4 items-center justify-center shrink-0">
                                      {openingDossierId === item.id ? <Loader2 className="w-4 h-4 text-dc-blue-500 animate-spin" /> : null}
                                    </span>
                                    <FileText className="w-4 h-4 shrink-0 text-red-500" />
                                    <span>{item.typeDocument || '-'}</span>
                                  </div>
                                </td>
                                <td className="px-5 py-3 text-dc-gray-500">{item.startdatum ? formatDateDdMmYyyy(item.startdatum) : '-'}</td>
                                <td className="px-5 py-3 text-dc-gray-500">{item.einddatum ? formatDateDdMmYyyy(item.einddatum) : '-'}</td>
                              </tr>
                            ))}
                            {sortedRelatieDossierItems.length === 0 && (
                              <tr>
                                <td colSpan={3} className="px-5 py-8 text-center text-dc-gray-300 text-sm">
                                  Geen dossierregels gevonden
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="mb-3">
                      <h2 className="text-lg font-semibold text-dc-gray-500">Inkoopopdrachten</h2>
                    </div>
                    <div className="bg-white rounded-xl border border-dc-gray-100 overflow-hidden">
                      <div className="max-h-[16rem] overflow-y-auto">
                        <table className="min-w-full text-sm">
                          <thead className="bg-white">
                            <tr className="border-b border-dc-gray-100">
                              <SortableTh
                                label="Omschrijving"
                                active={inkoopSort.key === 'omschrijving'}
                                direction={inkoopSort.direction}
                                onClick={() => setInkoopSort((current) => nextSortState(current, 'omschrijving'))}
                                className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
                              />
                              <SortableTh
                                label="Startdatum"
                                active={inkoopSort.key === 'startdatum'}
                                direction={inkoopSort.direction}
                                onClick={() => setInkoopSort((current) => nextSortState(current, 'startdatum'))}
                                className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
                              />
                              <SortableTh
                                label="Einddatum"
                                active={inkoopSort.key === 'einddatum'}
                                direction={inkoopSort.direction}
                                onClick={() => setInkoopSort((current) => nextSortState(current, 'einddatum'))}
                                className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
                              />
                            </tr>
                          </thead>
                          <tbody>
                            {sortedRelatieInkoopItems.map((item, index) => (
                              <tr
                                key={item.id}
                                onClick={() => void handleOpenDashboardInkoopPdf(item)}
                                className={`${index % 2 === 0 ? 'dc-zebra-row' : 'bg-white'} dc-clickable-row cursor-pointer`}
                              >
                                <td className="px-5 py-3 text-dc-gray-500">
                                  <div className="flex items-center gap-3">
                                    <span className="inline-flex w-4 h-4 items-center justify-center shrink-0">
                                      {openingInkoopId === item.id ? <Loader2 className="w-4 h-4 text-dc-blue-500 animate-spin" /> : null}
                                    </span>
                                    <FileText className="w-4 h-4 shrink-0 text-red-500" />
                                    <span>{item.omschrijving || '-'}</span>
                                  </div>
                                </td>
                                <td className="px-5 py-3 text-dc-gray-500">{item.startdatum ? formatDateDdMmYyyy(item.startdatum) : '-'}</td>
                                <td className="px-5 py-3 text-dc-gray-500">{item.einddatum ? formatDateDdMmYyyy(item.einddatum) : '-'}</td>
                              </tr>
                            ))}
                            {sortedRelatieInkoopItems.length === 0 && (
                              <tr>
                                <td colSpan={3} className="px-5 py-8 text-center text-dc-gray-300 text-sm">
                                  Geen inkoopopdrachten gevonden
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="mb-3">
                      <h2 className="text-lg font-semibold text-dc-gray-500">Prijsafspraken</h2>
                    </div>
                    <div className="bg-white rounded-xl border border-dc-gray-100 overflow-hidden">
                      <div className="max-h-[16rem] overflow-y-auto">
                        <table className="min-w-full text-sm">
                          <thead className="bg-white">
                            <tr className="border-b border-dc-gray-100">
                              <SortableTh
                                label="Artikel"
                                active={prijsSort.key === 'artikel'}
                                direction={prijsSort.direction}
                                onClick={() => setPrijsSort((current) => nextSortState(current, 'artikel'))}
                                className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
                              />
                              <SortableTh
                                label="Prijs"
                                active={prijsSort.key === 'prijs'}
                                direction={prijsSort.direction}
                                onClick={() => setPrijsSort((current) => nextSortState(current, 'prijs'))}
                                className="text-right px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
                              />
                              <SortableTh
                                label="Eenheid"
                                active={prijsSort.key === 'eenheid'}
                                direction={prijsSort.direction}
                                onClick={() => setPrijsSort((current) => nextSortState(current, 'eenheid'))}
                                className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
                              />
                            </tr>
                          </thead>
                          <tbody>
                            {sortedRelatiePrijsItems.map((item, index) => (
                              <tr key={item.id} className={index % 2 === 0 ? 'dc-zebra-row' : 'bg-white'}>
                                <td className="px-5 py-3 text-dc-gray-500">{item.artikel || '-'}</td>
                                <td className="px-5 py-3 text-right text-dc-gray-500">{formatDutchNumber(item.prijs || 0, 2)}</td>
                                <td className="px-5 py-3 text-dc-gray-500">{item.eenheid || '-'}</td>
                              </tr>
                            ))}
                            {sortedRelatiePrijsItems.length === 0 && (
                              <tr>
                                <td colSpan={3} className="px-5 py-8 text-center text-dc-gray-300 text-sm">
                                  Geen prijsafspraken gevonden
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {dashboardContactpersoon && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div
            className="w-full max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] bg-white rounded-xl border border-dc-gray-100 overflow-hidden flex flex-col"
            style={{ width: '768px', minWidth: '768px' }}
          >
            <div className="px-6 py-4 border-b border-dc-blue-500">
              <h2 className="text-lg font-semibold text-dc-gray-500">
                {dashboardContactpersoonMode === 'nieuw' ? 'Nieuwe contactpersoon' : 'Contactpersoon bewerken'}
              </h2>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-[repeat(16,minmax(0,1fr))] gap-3">
                <div className="md:col-span-4">
                  <label className="block text-xs font-medium text-dc-gray-400 mb-1">Naam</label>
                  <input
                    value={dashboardContactpersoonNaam}
                    onChange={(e) => setDashboardContactpersoonNaam(e.target.value)}
                    className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500"
                  />
                </div>
                <div className="md:col-span-4">
                  <label className="block text-xs font-medium text-dc-gray-400 mb-1">Roepnaam</label>
                  <input
                    value={dashboardContactpersoonRoepnaam}
                    onChange={(e) => setDashboardContactpersoonRoepnaam(e.target.value)}
                    className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500"
                  />
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-[repeat(16,minmax(0,1fr))] gap-3">
                <div className="md:col-span-6">
                  <label className="block text-xs font-medium text-dc-gray-400 mb-1">Email</label>
                  <input
                    value={dashboardContactpersoonEmail}
                    onChange={(e) => setDashboardContactpersoonEmail(e.target.value)}
                    className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500"
                  />
                </div>
              </div>

              {dashboardContactpersoonError && (
                <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {dashboardContactpersoonError}
                </div>
              )}
            </div>

            <div className="border-t border-dc-blue-500 px-6 py-4 flex items-center justify-between gap-2">
              <div>
                {dashboardContactpersoonMode === 'bewerk' && (
                  <button
                    type="button"
                    onClick={() => setDashboardContactpersoonVoorVerwijderen(dashboardContactpersoon)}
                    disabled={dashboardContactpersoonSaving || dashboardContactpersoonDeleting}
                    className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {dashboardContactpersoonDeleting && <Loader2 className="inline w-4 h-4 mr-2 animate-spin" />}
                    {dashboardContactpersoonDeleting ? 'Bezig...' : 'Verwijderen'}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={closeDashboardContactpersoonModal}
                  disabled={dashboardContactpersoonSaving || dashboardContactpersoonDeleting}
                  className="px-4 py-2 rounded-lg border border-dc-gray-200 text-sm font-medium text-dc-gray-500 hover:bg-dc-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Annuleren
                </button>
                <button
                  type="button"
                  onClick={() => void handleDashboardContactpersoonSave()}
                  disabled={dashboardContactpersoonSaving || dashboardContactpersoonDeleting}
                  className="px-4 py-2 rounded-lg bg-dc-blue-500 text-white text-sm font-medium hover:bg-dc-blue-600 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {dashboardContactpersoonSaving && <Loader2 className="inline w-4 h-4 mr-2 animate-spin" />}
                  {dashboardContactpersoonSaving
                    ? dashboardContactpersoonMode === 'nieuw'
                      ? 'Opslaan...'
                      : 'Bijwerken...'
                    : dashboardContactpersoonMode === 'nieuw'
                    ? 'Opslaan'
                    : 'Bijwerken'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(dashboardContactpersoonVoorVerwijderen)}
        title="Verwijderen"
        message={
          dashboardContactpersoonVoorVerwijderen
            ? `Weet je zeker dat je contactpersoon "${dashboardContactpersoonVoorVerwijderen.naam || 'onbekend'}" wilt verwijderen?`
            : ''
        }
        confirmLabel="Verwijderen"
        confirming={dashboardContactpersoonDeleting}
        onCancel={() => setDashboardContactpersoonVoorVerwijderen(null)}
        onConfirm={() => void bevestigDashboardContactpersoonDelete()}
      />
    </div>
  );
}
