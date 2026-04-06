import { FileText, Loader2, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import {
  clearNinoxInkoopopdrachtDocument,
  clearNinoxDossierDocument,
  createNinoxAfspraakContract,
  createNinoxDossier,
  createNinoxInkoopopdracht,
  createNinoxPrijsafspraak,
  deleteNinoxAfspraakContract,
  deleteNinoxDossier,
  deleteNinoxInkoopopdracht,
  deleteNinoxPrijsafspraak,
  fetchNinoxAfsprakenEnContracten,
  fetchNinoxArtikelenLookup,
  fetchNinoxDossierDocument,
  fetchNinoxDossierTypeDocumentOpties,
  fetchNinoxDossierVoorAfspraakContract,
  fetchNinoxInkoopopdrachtDocument,
  fetchNinoxInkoopopdrachtenVoorAfspraakContract,
  fetchNinoxPrijsafsprakenEenheidOpties,
  fetchNinoxPrijsafsprakenVoorAfspraakContract,
  fetchNinoxRelatiesLookup,
  uploadNinoxInkoopopdrachtDocument,
  uploadNinoxDossierDocument,
  updateNinoxDossier,
  updateNinoxAfspraakContract,
  updateNinoxInkoopopdracht,
  updateNinoxPrijsafspraak,
  type NinoxLookupOption,
} from '../lib/ninox';
import { formatDutchNumber, formatDutchNumberInputLive, parseDutchNumber } from '../lib/amount';
import { formatDateDdMmYyyy } from '../lib/date';
import { waitForNextPaint } from '../lib/render';
import { matchesAllTerms, parseSearchTerms } from '../lib/search';
import { compareStrings, nextSortState, type SortState } from '../lib/sort';
import type { AfspraakContract, DossierItem, InkoopopdrachtItem, PrijsafspraakItem } from '../types';
import ComboBox from './ui/ComboBox';
import ConfirmDialog from './ui/ConfirmDialog';
import DateFieldInput from './ui/DateFieldInput';
import LoadingSpinner from './ui/LoadingSpinner';
import SortableTh from './ui/SortableTh';

type GridSortKey = 'relatie' | 'onderdeel';
type FormTab = 'Algemeen' | 'Dossier' | 'Inkoopopdrachten' | 'Prijsafspraken';
type DossierSortKey = 'typeDocument' | 'omschrijving' | 'extraInformatie' | 'startdatum' | 'einddatum';

const formTabs: FormTab[] = ['Algemeen', 'Dossier', 'Inkoopopdrachten', 'Prijsafspraken'];

export default function AfsprakenEnContractenPage() {
  const [items, setItems] = useState<AfspraakContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [zoek, setZoek] = useState('');
  const [sort, setSort] = useState<SortState<GridSortKey>>({ key: 'relatie', direction: 'asc' });
  const [modalMode, setModalMode] = useState<'nieuw' | 'bewerk' | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [openingRowId, setOpeningRowId] = useState<number | null>(null);
  const [itemVoorVerwijderen, setItemVoorVerwijderen] = useState<AfspraakContract | null>(null);
  const [formError, setFormError] = useState('');
  const [activeTab, setActiveTab] = useState<FormTab>('Algemeen');
  const [relatieOpties, setRelatieOpties] = useState<NinoxLookupOption[]>([]);
  const [relatieOptiesLoaded, setRelatieOptiesLoaded] = useState(false);
  const [relatieId, setRelatieId] = useState('');
  const [onderdeel, setOnderdeel] = useState('');
  const [opmerkingen, setOpmerkingen] = useState('');
  const [opmerkingenExpanded, setOpmerkingenExpanded] = useState(false);
  const [dossierItems, setDossierItems] = useState<DossierItem[]>([]);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [dossierError, setDossierError] = useState('');
  const [dossierZoek, setDossierZoek] = useState('');
  const [dossierSort, setDossierSort] = useState<SortState<DossierSortKey>>({ key: 'typeDocument', direction: 'asc' });
  const [dossierMode, setDossierMode] = useState<'grid' | 'nieuw' | 'bewerk'>('grid');
  const [selectedDossierItem, setSelectedDossierItem] = useState<DossierItem | null>(null);
  const [dossierTypeDocumentOpties, setDossierTypeDocumentOpties] = useState<string[]>([]);
  const [dossierTypeDocumentOptiesLoaded, setDossierTypeDocumentOptiesLoaded] = useState(false);
  const [dossierTypeDocument, setDossierTypeDocument] = useState('');
  const [dossierOmschrijving, setDossierOmschrijving] = useState('');
  const [dossierStartdatum, setDossierStartdatum] = useState('');
  const [dossierEinddatum, setDossierEinddatum] = useState('');
  const [dossierExtraInformatie, setDossierExtraInformatie] = useState('');
  const [dossierDocumentNaam, setDossierDocumentNaam] = useState('');
  const [dossierDocumentPreviewUrl, setDossierDocumentPreviewUrl] = useState('');
  const [dossierDocumentDragActive, setDossierDocumentDragActive] = useState(false);
  const [dossierUploadingDocument, setDossierUploadingDocument] = useState(false);
  const [dossierSaving, setDossierSaving] = useState(false);
  const [dossierFormError, setDossierFormError] = useState('');
  const [dossierDeleting, setDossierDeleting] = useState(false);
  const [dossierVoorVerwijderen, setDossierVoorVerwijderen] = useState<DossierItem | null>(null);
  const [inkoopItems, setInkoopItems] = useState<InkoopopdrachtItem[]>([]);
  const [inkoopLoading, setInkoopLoading] = useState(false);
  const [inkoopError, setInkoopError] = useState('');
  const [inkoopZoek, setInkoopZoek] = useState('');
  const [inkoopSort, setInkoopSort] = useState<SortState<DossierSortKey>>({ key: 'omschrijving', direction: 'asc' });
  const [inkoopMode, setInkoopMode] = useState<'grid' | 'nieuw' | 'bewerk'>('grid');
  const [selectedInkoopItem, setSelectedInkoopItem] = useState<InkoopopdrachtItem | null>(null);
  const [inkoopTypeDocument, setInkoopTypeDocument] = useState('');
  const [inkoopOmschrijving, setInkoopOmschrijving] = useState('');
  const [inkoopStartdatum, setInkoopStartdatum] = useState('');
  const [inkoopEinddatum, setInkoopEinddatum] = useState('');
  const [inkoopExtraInformatie, setInkoopExtraInformatie] = useState('');
  const [inkoopDocumentNaam, setInkoopDocumentNaam] = useState('');
  const [inkoopDocumentPreviewUrl, setInkoopDocumentPreviewUrl] = useState('');
  const [inkoopDocumentDragActive, setInkoopDocumentDragActive] = useState(false);
  const [inkoopUploadingDocument, setInkoopUploadingDocument] = useState(false);
  const [inkoopSaving, setInkoopSaving] = useState(false);
  const [inkoopFormError, setInkoopFormError] = useState('');
  const [inkoopDeleting, setInkoopDeleting] = useState(false);
  const [inkoopVoorVerwijderen, setInkoopVoorVerwijderen] = useState<InkoopopdrachtItem | null>(null);
  const [prijsItems, setPrijsItems] = useState<PrijsafspraakItem[]>([]);
  const [prijsLoading, setPrijsLoading] = useState(false);
  const [prijsError, setPrijsError] = useState('');
  const [prijsZoek, setPrijsZoek] = useState('');
  const [prijsSort, setPrijsSort] = useState<SortState<DossierSortKey>>({ key: 'omschrijving', direction: 'asc' });
  const [prijsMode, setPrijsMode] = useState<'grid' | 'nieuw' | 'bewerk'>('grid');
  const [selectedPrijsItem, setSelectedPrijsItem] = useState<PrijsafspraakItem | null>(null);
  const [artikelOpties, setArtikelOpties] = useState<NinoxLookupOption[]>([]);
  const [artikelOptiesLoaded, setArtikelOptiesLoaded] = useState(false);
  const [prijsEenheidOpties, setPrijsEenheidOpties] = useState<string[]>([]);
  const [prijsEenheidOptiesLoaded, setPrijsEenheidOptiesLoaded] = useState(false);
  const [prijsArtikelId, setPrijsArtikelId] = useState('');
  const [prijsWaarde, setPrijsWaarde] = useState('');
  const [prijsEenheid, setPrijsEenheid] = useState('');
  const [prijsStartdatum, setPrijsStartdatum] = useState('');
  const [prijsEinddatum, setPrijsEinddatum] = useState('');
  const [prijsSaving, setPrijsSaving] = useState(false);
  const [prijsFormError, setPrijsFormError] = useState('');
  const [prijsDeleting, setPrijsDeleting] = useState(false);
  const [prijsVoorVerwijderen, setPrijsVoorVerwijderen] = useState<PrijsafspraakItem | null>(null);
  const dossierDocumentInputRef = useRef<HTMLInputElement | null>(null);
  const dossierDocumentPreviewUrlRef = useRef('');
  const inkoopDocumentInputRef = useRef<HTMLInputElement | null>(null);
  const inkoopDocumentPreviewUrlRef = useRef('');

  useEffect(() => {
    let cancelled = false;

    const loadItems = async () => {
      setLoading(true);
      try {
        const live = await fetchNinoxAfsprakenEnContracten();
        if (!cancelled) {
          setItems(live);
          setError('');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Onbekende fout';
        if (!cancelled) {
          setItems([]);
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadItems();

    return () => {
      cancelled = true;
    };
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
    return () => {
      if (dossierDocumentPreviewUrlRef.current) {
        URL.revokeObjectURL(dossierDocumentPreviewUrlRef.current);
      }
      if (inkoopDocumentPreviewUrlRef.current) {
        URL.revokeObjectURL(inkoopDocumentPreviewUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (activeTab !== 'Dossier' || !editingId) {
      setDossierItems([]);
      setSelectedDossierItem(null);
      setDossierMode('grid');
      setDossierError('');
      setDossierLoading(false);
      return;
    }

    const loadDossier = async () => {
      setDossierLoading(true);
      try {
        const live = await fetchNinoxDossierVoorAfspraakContract(editingId);
        setDossierItems(live);
        setDossierError('');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Onbekende fout';
        setDossierItems([]);
        setDossierError(message);
      } finally {
        setDossierLoading(false);
      }
    };

    void loadDossier();
  }, [activeTab, editingId]);

  useEffect(() => {
    if (activeTab !== 'Inkoopopdrachten' || !editingId) {
      setInkoopItems([]);
      setSelectedInkoopItem(null);
      setInkoopMode('grid');
      setInkoopError('');
      setInkoopLoading(false);
      return;
    }

    const loadInkoopopdrachten = async () => {
      setInkoopLoading(true);
      try {
        const live = await fetchNinoxInkoopopdrachtenVoorAfspraakContract(editingId);
        setInkoopItems(live);
        setInkoopError('');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Onbekende fout';
        setInkoopItems([]);
        setInkoopError(message);
      } finally {
        setInkoopLoading(false);
      }
    };

    void loadInkoopopdrachten();
  }, [activeTab, editingId]);

  useEffect(() => {
    if (activeTab !== 'Prijsafspraken' || !editingId) {
      setPrijsItems([]);
      setSelectedPrijsItem(null);
      setPrijsMode('grid');
      setPrijsError('');
      setPrijsLoading(false);
      return;
    }

    const loadPrijsafspraken = async () => {
      setPrijsLoading(true);
      try {
        const live = await fetchNinoxPrijsafsprakenVoorAfspraakContract(editingId);
        setPrijsItems(live);
        setPrijsError('');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Onbekende fout';
        setPrijsItems([]);
        setPrijsError(message);
      } finally {
        setPrijsLoading(false);
      }
    };

    void loadPrijsafspraken();
  }, [activeTab, editingId]);

  const loadItems = async () => {
    setLoading(true);
    try {
      const live = await fetchNinoxAfsprakenEnContracten();
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

  const ensureRelatieOptiesLoaded = async () => {
    if (relatieOptiesLoaded) {
      return;
    }
    const opties = await fetchNinoxRelatiesLookup();
    setRelatieOpties(opties);
    setRelatieOptiesLoaded(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setActiveTab('Algemeen');
    setRelatieId('');
    setOnderdeel('');
    setOpmerkingen('');
    setOpmerkingenExpanded(false);
    setDossierItems([]);
    setSelectedDossierItem(null);
    setDossierMode('grid');
    setDossierError('');
    setDossierZoek('');
    setDossierLoading(false);
    setDossierSort({ key: 'typeDocument', direction: 'asc' });
    setDossierTypeDocument('');
    setDossierOmschrijving('');
    setDossierStartdatum('');
    setDossierEinddatum('');
    setDossierExtraInformatie('');
    if (dossierDocumentPreviewUrlRef.current) {
      URL.revokeObjectURL(dossierDocumentPreviewUrlRef.current);
    }
    dossierDocumentPreviewUrlRef.current = '';
    setDossierDocumentNaam('');
    setDossierDocumentPreviewUrl('');
    setDossierDocumentDragActive(false);
    setDossierUploadingDocument(false);
    setDossierFormError('');
    setInkoopItems([]);
    setSelectedInkoopItem(null);
    setInkoopMode('grid');
    setInkoopError('');
    setInkoopZoek('');
    setInkoopLoading(false);
    setInkoopSort({ key: 'omschrijving', direction: 'asc' });
    setInkoopTypeDocument('');
    setInkoopOmschrijving('');
    setInkoopStartdatum('');
    setInkoopEinddatum('');
    setInkoopExtraInformatie('');
    if (inkoopDocumentPreviewUrlRef.current) {
      URL.revokeObjectURL(inkoopDocumentPreviewUrlRef.current);
    }
    inkoopDocumentPreviewUrlRef.current = '';
    setInkoopDocumentNaam('');
    setInkoopDocumentPreviewUrl('');
    setInkoopDocumentDragActive(false);
    setInkoopUploadingDocument(false);
    setInkoopSaving(false);
    setInkoopFormError('');
    setInkoopDeleting(false);
    setInkoopVoorVerwijderen(null);
    setPrijsItems([]);
    setSelectedPrijsItem(null);
    setPrijsError('');
    setPrijsZoek('');
    setPrijsLoading(false);
    setPrijsSort({ key: 'omschrijving', direction: 'asc' });
    setPrijsMode('grid');
    setPrijsArtikelId('');
    setPrijsWaarde('');
    setPrijsEenheid('');
    setPrijsEenheidOpties([]);
    setPrijsEenheidOptiesLoaded(false);
    setPrijsStartdatum('');
    setPrijsEinddatum('');
    setPrijsSaving(false);
    setPrijsFormError('');
    setPrijsDeleting(false);
    setPrijsVoorVerwijderen(null);
    setFormError('');
  };

  const openNieuw = async () => {
    await ensureRelatieOptiesLoaded();
    resetForm();
    setModalMode('nieuw');
  };

  const openBewerk = async (item: AfspraakContract) => {
    await ensureRelatieOptiesLoaded();
    setEditingId(item.id);
    setRelatieId(item.relatieId ? String(item.relatieId) : item.relatie || '');
    setOnderdeel(item.onderdeel || '');
    setOpmerkingen(item.opmerkingen || '');
    setOpmerkingenExpanded(false);
    setFormError('');
    setModalMode('bewerk');
  };

  const ensureHoofdrecordVoorDossierTab = async (): Promise<number | null> => {
    if (editingId) {
      return editingId;
    }
    if (modalMode !== 'nieuw') {
      return null;
    }

    const payload = {
      relatieId: relatieId.trim(),
      relatieNaam: relatieOpties.find((option) => option.id === relatieId)?.label || '',
      onderdeel: onderdeel.trim(),
      opmerkingen: opmerkingen.trim(),
    };
    const nieuwId = await createNinoxAfspraakContract(payload);
    await loadItems();
    setEditingId(nieuwId);
    setModalMode('bewerk');
    return nieuwId;
  };

  const handleOpenBewerkFromGrid = async (item: AfspraakContract) => {
    setOpeningRowId(item.id);
    try {
      await waitForNextPaint();
      await openBewerk(item);
    } finally {
      setOpeningRowId(null);
    }
  };

  const closeModal = () => {
    setModalMode(null);
    resetForm();
  };

  const handleSave = async () => {
    const selectedRelatie = relatieOpties.find((option) => option.id === relatieId);
    if (!selectedRelatie) {
      setFormError('Relatie is verplicht.');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const payload = {
        relatieId: selectedRelatie.id,
        relatieNaam: selectedRelatie.label,
        onderdeel: onderdeel.trim(),
        opmerkingen: opmerkingen.trim(),
      };
      if (modalMode === 'nieuw') {
        await createNinoxAfspraakContract(payload);
      } else if (modalMode === 'bewerk' && editingId) {
        await updateNinoxAfspraakContract(editingId, payload);
      }
      await loadItems();
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
    const current = items.find((item) => item.id === editingId);
    if (current) {
      setItemVoorVerwijderen(current);
    }
  };

  const bevestigDelete = async () => {
    if (!itemVoorVerwijderen) {
      return;
    }
    setDeletingId(itemVoorVerwijderen.id);
    setError('');
    try {
      await deleteNinoxAfspraakContract(itemVoorVerwijderen.id);
      setItemVoorVerwijderen(null);
      closeModal();
      await loadItems();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Vervallen mislukt.';
      setError(message);
    } finally {
      setDeletingId(null);
    }
  };

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      if (sort.key === 'onderdeel') {
        return compareStrings(a.onderdeel || '', b.onderdeel || '', sort.direction);
      }
      return compareStrings(a.relatie || '', b.relatie || '', sort.direction);
    });
  }, [items, sort]);

  const filteredItems = useMemo(() => {
    const terms = parseSearchTerms(zoek);
    if (terms.length === 0) {
      return sortedItems;
    }

    return sortedItems.filter((item) => matchesAllTerms(`${item.relatie || ''} ${item.onderdeel || ''}`, terms));
  }, [sortedItems, zoek]);

  const sortedDossierItems = useMemo(() => {
    return [...dossierItems].sort((a, b) => {
      if (dossierSort.key === 'omschrijving') {
        return compareStrings(a.omschrijving || '', b.omschrijving || '', dossierSort.direction);
      }
      if (dossierSort.key === 'extraInformatie') {
        return compareStrings(a.extraInformatie || '', b.extraInformatie || '', dossierSort.direction);
      }
      if (dossierSort.key === 'startdatum') {
        return compareStrings(a.startdatum || '', b.startdatum || '', dossierSort.direction);
      }
      if (dossierSort.key === 'einddatum') {
        return compareStrings(a.einddatum || '', b.einddatum || '', dossierSort.direction);
      }
      return compareStrings(a.typeDocument || '', b.typeDocument || '', dossierSort.direction);
    });
  }, [dossierItems, dossierSort]);

  const filteredDossierItems = useMemo(() => {
    const terms = parseSearchTerms(dossierZoek);
    if (terms.length === 0) {
      return sortedDossierItems;
    }

    return sortedDossierItems.filter((item) =>
      matchesAllTerms(
        `${item.typeDocument || ''} ${item.omschrijving || ''} ${item.extraInformatie || ''} ${item.startdatum || ''} ${item.einddatum || ''}`,
        terms
      )
    );
  }, [dossierZoek, sortedDossierItems]);

  const sortedInkoopItems = useMemo(() => {
    return [...inkoopItems].sort((a, b) => {
      if (inkoopSort.key === 'omschrijving') {
        return compareStrings(a.omschrijving || '', b.omschrijving || '', inkoopSort.direction);
      }
      if (inkoopSort.key === 'extraInformatie') {
        return compareStrings(a.extraInformatie || '', b.extraInformatie || '', inkoopSort.direction);
      }
      if (inkoopSort.key === 'startdatum') {
        return compareStrings(a.startdatum || '', b.startdatum || '', inkoopSort.direction);
      }
      if (inkoopSort.key === 'einddatum') {
        return compareStrings(a.einddatum || '', b.einddatum || '', inkoopSort.direction);
      }
      return compareStrings(a.typeDocument || '', b.typeDocument || '', inkoopSort.direction);
    });
  }, [inkoopItems, inkoopSort]);

  const filteredInkoopItems = useMemo(() => {
    const terms = parseSearchTerms(inkoopZoek);
    if (terms.length === 0) {
      return sortedInkoopItems;
    }

    return sortedInkoopItems.filter((item) =>
      matchesAllTerms(
        `${item.typeDocument || ''} ${item.omschrijving || ''} ${item.extraInformatie || ''} ${item.startdatum || ''} ${item.einddatum || ''}`,
        terms
      )
    );
  }, [inkoopZoek, sortedInkoopItems]);

  const sortedPrijsItems = useMemo(() => {
    return [...prijsItems].sort((a, b) => {
      if (prijsSort.key === 'extraInformatie') {
        return compareStrings(a.eenheid || '', b.eenheid || '', prijsSort.direction);
      }
      if (prijsSort.key === 'startdatum') {
        return compareStrings(a.startdatum || '', b.startdatum || '', prijsSort.direction);
      }
      if (prijsSort.key === 'einddatum') {
        return compareStrings(a.einddatum || '', b.einddatum || '', prijsSort.direction);
      }
      if (prijsSort.key === 'typeDocument') {
        return compareStrings(String(a.prijs ?? ''), String(b.prijs ?? ''), prijsSort.direction);
      }
      return compareStrings(a.artikel || '', b.artikel || '', prijsSort.direction);
    });
  }, [prijsItems, prijsSort]);

  const filteredPrijsItems = useMemo(() => {
    const terms = parseSearchTerms(prijsZoek);
    if (terms.length === 0) {
      return sortedPrijsItems;
    }

    return sortedPrijsItems.filter((item) =>
      matchesAllTerms(
        `${item.artikel || ''} ${item.prijs ?? ''} ${item.eenheid || ''} ${item.startdatum || ''} ${item.einddatum || ''}`,
        terms
      )
    );
  }, [prijsZoek, sortedPrijsItems]);

  const ensureArtikelOptiesLoaded = async (): Promise<NinoxLookupOption[]> => {
    if (artikelOptiesLoaded) {
      return artikelOpties;
    }
    const opties = await fetchNinoxArtikelenLookup();
    setArtikelOpties(opties);
    setArtikelOptiesLoaded(true);
    return opties;
  };

  const ensurePrijsEenheidOptiesLoaded = async (): Promise<string[]> => {
    if (prijsEenheidOptiesLoaded) {
      return prijsEenheidOpties;
    }
    const opties = await fetchNinoxPrijsafsprakenEenheidOpties();
    setPrijsEenheidOpties(opties);
    setPrijsEenheidOptiesLoaded(true);
    return opties;
  };

  const openPrijsItem = async (item: PrijsafspraakItem) => {
    const opties = await ensureArtikelOptiesLoaded();
    await ensurePrijsEenheidOptiesLoaded();
    setPrijsMode('bewerk');
    setSelectedPrijsItem(item);
    const selectedArtikel = opties.find((option) => option.label === (item.artikel || ''));
    setPrijsArtikelId(selectedArtikel?.id || item.artikel || '');
    setPrijsWaarde(typeof item.prijs === 'number' ? formatDutchNumber(item.prijs) : '');
    setPrijsEenheid(item.eenheid || '');
    setPrijsStartdatum(item.startdatum || '');
    setPrijsEinddatum(item.einddatum || '');
    setPrijsFormError('');
  };

  const openNieuwPrijsItem = async () => {
    await ensureArtikelOptiesLoaded();
    await ensurePrijsEenheidOptiesLoaded();
    setPrijsMode('nieuw');
    setSelectedPrijsItem(null);
    setPrijsArtikelId('');
    setPrijsWaarde('');
    setPrijsEenheid('');
    setPrijsStartdatum('');
    setPrijsEinddatum('');
    setPrijsFormError('');
  };

  const closePrijsItem = () => {
    setSelectedPrijsItem(null);
    setPrijsMode('grid');
    setPrijsArtikelId('');
    setPrijsWaarde('');
    setPrijsEenheid('');
    setPrijsStartdatum('');
    setPrijsEinddatum('');
    setPrijsFormError('');
  };

  const ensureDossierTypeDocumentOptiesLoaded = async () => {
    if (dossierTypeDocumentOptiesLoaded) {
      return;
    }
    const opties = await fetchNinoxDossierTypeDocumentOpties();
    setDossierTypeDocumentOpties(opties);
    setDossierTypeDocumentOptiesLoaded(true);
  };

  const openDossierItem = async (item: DossierItem) => {
    await ensureDossierTypeDocumentOptiesLoaded();
    setDossierMode('bewerk');
    setSelectedDossierItem(item);
    setDossierTypeDocument(item.typeDocument || '');
    setDossierOmschrijving(item.omschrijving || '');
    setDossierStartdatum(item.startdatum || '');
    setDossierEinddatum(item.einddatum || '');
    setDossierExtraInformatie(item.extraInformatie || '');
    setDossierFormError('');
    if (dossierDocumentPreviewUrlRef.current) {
      URL.revokeObjectURL(dossierDocumentPreviewUrlRef.current);
    }
    dossierDocumentPreviewUrlRef.current = '';
    setDossierDocumentNaam('');
    setDossierDocumentPreviewUrl('');
    try {
      const doc = await fetchNinoxDossierDocument(item.id);
      if (doc) {
        const url = URL.createObjectURL(doc.blob);
        dossierDocumentPreviewUrlRef.current = url;
        setDossierDocumentPreviewUrl(url);
        setDossierDocumentNaam(doc.naam);
      }
    } catch {
      // Geen bestaand document is toegestaan.
    }
  };

  const openNieuwDossierItem = async () => {
    await ensureDossierTypeDocumentOptiesLoaded();
    setDossierMode('nieuw');
    setSelectedDossierItem(null);
    setDossierTypeDocument('');
    setDossierOmschrijving('');
    setDossierStartdatum('');
    setDossierEinddatum('');
    setDossierExtraInformatie('');
    setDossierFormError('');
    if (dossierDocumentPreviewUrlRef.current) {
      URL.revokeObjectURL(dossierDocumentPreviewUrlRef.current);
    }
    dossierDocumentPreviewUrlRef.current = '';
    setDossierDocumentNaam('');
    setDossierDocumentPreviewUrl('');
    setDossierDocumentDragActive(false);
    setDossierUploadingDocument(false);
  };

  const openInkoopItem = async (item: InkoopopdrachtItem) => {
    setInkoopMode('bewerk');
    setSelectedInkoopItem(item);
    setInkoopTypeDocument(item.typeDocument || '');
    setInkoopOmschrijving(item.omschrijving || '');
    setInkoopStartdatum(item.startdatum || '');
    setInkoopEinddatum(item.einddatum || '');
    setInkoopExtraInformatie(item.extraInformatie || '');
    setInkoopFormError('');
    if (inkoopDocumentPreviewUrlRef.current) {
      URL.revokeObjectURL(inkoopDocumentPreviewUrlRef.current);
    }
    inkoopDocumentPreviewUrlRef.current = '';
    setInkoopDocumentNaam('');
    setInkoopDocumentPreviewUrl('');
    try {
      const doc = await fetchNinoxInkoopopdrachtDocument(item.id);
      if (doc) {
        const url = URL.createObjectURL(doc.blob);
        inkoopDocumentPreviewUrlRef.current = url;
        setInkoopDocumentPreviewUrl(url);
        setInkoopDocumentNaam(doc.naam);
      }
    } catch {
      // Geen bestaand document is toegestaan.
    }
  };

  const openNieuwInkoopItem = async () => {
    setInkoopMode('nieuw');
    setSelectedInkoopItem(null);
    setInkoopTypeDocument('');
    setInkoopOmschrijving('');
    setInkoopStartdatum('');
    setInkoopEinddatum('');
    setInkoopExtraInformatie('');
    setInkoopFormError('');
    if (inkoopDocumentPreviewUrlRef.current) {
      URL.revokeObjectURL(inkoopDocumentPreviewUrlRef.current);
    }
    inkoopDocumentPreviewUrlRef.current = '';
    setInkoopDocumentNaam('');
    setInkoopDocumentPreviewUrl('');
    setInkoopDocumentDragActive(false);
    setInkoopUploadingDocument(false);
  };

  const closeDossierItem = () => {
    setSelectedDossierItem(null);
    setDossierMode('grid');
    setDossierTypeDocument('');
    setDossierOmschrijving('');
    setDossierStartdatum('');
    setDossierEinddatum('');
    setDossierExtraInformatie('');
    setDossierFormError('');
    if (dossierDocumentPreviewUrlRef.current) {
      URL.revokeObjectURL(dossierDocumentPreviewUrlRef.current);
    }
    dossierDocumentPreviewUrlRef.current = '';
    setDossierDocumentNaam('');
    setDossierDocumentPreviewUrl('');
    setDossierDocumentDragActive(false);
    setDossierUploadingDocument(false);
  };

  const closeInkoopItem = () => {
    setSelectedInkoopItem(null);
    setInkoopMode('grid');
    setInkoopTypeDocument('');
    setInkoopOmschrijving('');
    setInkoopStartdatum('');
    setInkoopEinddatum('');
    setInkoopExtraInformatie('');
    setInkoopFormError('');
    if (inkoopDocumentPreviewUrlRef.current) {
      URL.revokeObjectURL(inkoopDocumentPreviewUrlRef.current);
    }
    inkoopDocumentPreviewUrlRef.current = '';
    setInkoopDocumentNaam('');
    setInkoopDocumentPreviewUrl('');
    setInkoopDocumentDragActive(false);
    setInkoopUploadingDocument(false);
  };

  const openInkoopDocumentPicker = () => {
    inkoopDocumentInputRef.current?.click();
  };

  const ensureInkoopRecordForDocumentUpload = async (): Promise<number | null> => {
    if (selectedInkoopItem) {
      return selectedInkoopItem.id;
    }
    if (inkoopMode !== 'nieuw' || !editingId) {
      return null;
    }

    const nieuwId = await createNinoxInkoopopdracht({
      afspraakContractId: editingId,
      typeDocument: inkoopTypeDocument,
      omschrijving: inkoopOmschrijving,
      extraInformatie: inkoopExtraInformatie,
      startdatum: inkoopStartdatum,
      einddatum: inkoopEinddatum,
    });
    const live = await fetchNinoxInkoopopdrachtenVoorAfspraakContract(editingId);
    setInkoopItems(live);
    const nieuwItem =
      live.find((item) => item.id === nieuwId) ||
      ({
        id: nieuwId,
        typeDocument: inkoopTypeDocument,
        omschrijving: inkoopOmschrijving,
        extraInformatie: inkoopExtraInformatie,
        startdatum: inkoopStartdatum,
        einddatum: inkoopEinddatum,
      } satisfies InkoopopdrachtItem);
    setSelectedInkoopItem(nieuwItem);
    setInkoopMode('bewerk');
    return nieuwId;
  };

  const uploadInkoopDocument = async (bestand: File) => {
    if (!bestand) {
      return;
    }
    const isPdf = bestand.type === 'application/pdf' || bestand.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setInkoopFormError('Alleen PDF-bestanden zijn toegestaan.');
      return;
    }

    setInkoopFormError('');
    let inkoopRecordId: number | null = null;
    try {
      inkoopRecordId = await ensureInkoopRecordForDocumentUpload();
    } catch (err) {
      setInkoopFormError(err instanceof Error ? err.message : 'Automatisch opslaan van inkoopopdracht mislukt.');
      return;
    }
    if (!inkoopRecordId) {
      setInkoopFormError('Automatisch opslaan van inkoopopdracht mislukt.');
      return;
    }
    setInkoopDocumentNaam(bestand.name);
    if (inkoopDocumentPreviewUrlRef.current) {
      URL.revokeObjectURL(inkoopDocumentPreviewUrlRef.current);
    }
    const previewUrl = URL.createObjectURL(bestand);
    inkoopDocumentPreviewUrlRef.current = previewUrl;
    setInkoopDocumentPreviewUrl(previewUrl);

    setInkoopUploadingDocument(true);
    try {
      await uploadNinoxInkoopopdrachtDocument(inkoopRecordId, bestand);
    } catch (err) {
      setInkoopFormError(err instanceof Error ? err.message : 'Document upload mislukt.');
    } finally {
      setInkoopUploadingDocument(false);
    }
  };

  const handleInkoopDocumentChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const bestand = Array.from(event.target.files || [])[0];
    event.target.value = '';
    await uploadInkoopDocument(bestand);
  };

  const handleInkoopDocumentDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (inkoopUploadingDocument || inkoopSaving || inkoopDeleting) {
      return;
    }
    setInkoopDocumentDragActive(true);
  };

  const handleInkoopDocumentDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setInkoopDocumentDragActive(false);
    }
  };

  const handleInkoopDocumentDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setInkoopDocumentDragActive(false);
    if (inkoopUploadingDocument || inkoopSaving || inkoopDeleting) {
      return;
    }
    const bestand = Array.from(event.dataTransfer.files || [])[0];
    await uploadInkoopDocument(bestand);
  };

  const handleInkoopDocumentOpen = async () => {
    setInkoopFormError('');
    if (inkoopDocumentPreviewUrl) {
      window.open(inkoopDocumentPreviewUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!selectedInkoopItem) {
      return;
    }
    try {
      const doc = await fetchNinoxInkoopopdrachtDocument(selectedInkoopItem.id);
      if (!doc) {
        setInkoopFormError('Geen PDF gevonden voor dit documentveld.');
        return;
      }
      const url = URL.createObjectURL(doc.blob);
      if (inkoopDocumentPreviewUrlRef.current) {
        URL.revokeObjectURL(inkoopDocumentPreviewUrlRef.current);
      }
      inkoopDocumentPreviewUrlRef.current = url;
      setInkoopDocumentPreviewUrl(url);
      setInkoopDocumentNaam(doc.naam);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setInkoopFormError(err instanceof Error ? err.message : 'PDF openen mislukt.');
    }
  };

  const handleInkoopDocumentDelete = async () => {
    setInkoopFormError('');
    if (inkoopDocumentPreviewUrlRef.current) {
      URL.revokeObjectURL(inkoopDocumentPreviewUrlRef.current);
    }
    inkoopDocumentPreviewUrlRef.current = '';
    setInkoopDocumentPreviewUrl('');
    setInkoopDocumentNaam('');
    if (!selectedInkoopItem) {
      return;
    }

    setInkoopUploadingDocument(true);
    try {
      await clearNinoxInkoopopdrachtDocument(selectedInkoopItem.id);
    } catch (err) {
      setInkoopFormError(err instanceof Error ? err.message : 'PDF verwijderen mislukt.');
    } finally {
      setInkoopUploadingDocument(false);
    }
  };

  const openDossierDocumentPicker = () => {
    dossierDocumentInputRef.current?.click();
  };

  const ensureDossierRecordForDocumentUpload = async (): Promise<number | null> => {
    if (selectedDossierItem) {
      return selectedDossierItem.id;
    }
    if (dossierMode !== 'nieuw' || !editingId) {
      return null;
    }

    const nieuwId = await createNinoxDossier({
      afspraakContractId: editingId,
      typeDocument: dossierTypeDocument,
      omschrijving: dossierOmschrijving,
      extraInformatie: dossierExtraInformatie,
      startdatum: dossierStartdatum,
      einddatum: dossierEinddatum,
    });
    const live = await fetchNinoxDossierVoorAfspraakContract(editingId);
    setDossierItems(live);
    const nieuwItem =
      live.find((item) => item.id === nieuwId) ||
      ({
        id: nieuwId,
        typeDocument: dossierTypeDocument,
        omschrijving: dossierOmschrijving,
        extraInformatie: dossierExtraInformatie,
        startdatum: dossierStartdatum,
        einddatum: dossierEinddatum,
      } satisfies DossierItem);
    setSelectedDossierItem(nieuwItem);
    setDossierMode('bewerk');
    return nieuwId;
  };

  const uploadDossierDocument = async (bestand: File) => {
    if (!bestand) {
      return;
    }
    const isPdf = bestand.type === 'application/pdf' || bestand.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setDossierFormError('Alleen PDF-bestanden zijn toegestaan.');
      return;
    }

    setDossierFormError('');
    let dossierRecordId: number | null = null;
    try {
      dossierRecordId = await ensureDossierRecordForDocumentUpload();
    } catch (err) {
      setDossierFormError(err instanceof Error ? err.message : 'Automatisch opslaan van dossierregel mislukt.');
      return;
    }
    if (!dossierRecordId) {
      setDossierFormError('Automatisch opslaan van dossierregel mislukt.');
      return;
    }
    setDossierDocumentNaam(bestand.name);
    if (dossierDocumentPreviewUrlRef.current) {
      URL.revokeObjectURL(dossierDocumentPreviewUrlRef.current);
    }
    const previewUrl = URL.createObjectURL(bestand);
    dossierDocumentPreviewUrlRef.current = previewUrl;
    setDossierDocumentPreviewUrl(previewUrl);

    setDossierUploadingDocument(true);
    try {
      await uploadNinoxDossierDocument(dossierRecordId, bestand);
    } catch (err) {
      setDossierFormError(err instanceof Error ? err.message : 'Document upload mislukt.');
    } finally {
      setDossierUploadingDocument(false);
    }
  };

  const handleDossierDocumentChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const bestand = Array.from(event.target.files || [])[0];
    event.target.value = '';
    await uploadDossierDocument(bestand);
  };

  const handleDossierDocumentDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (dossierUploadingDocument || dossierSaving || dossierDeleting) {
      return;
    }
    setDossierDocumentDragActive(true);
  };

  const handleDossierDocumentDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setDossierDocumentDragActive(false);
    }
  };

  const handleDossierDocumentDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDossierDocumentDragActive(false);
    if (dossierUploadingDocument || dossierSaving || dossierDeleting) {
      return;
    }
    const bestand = Array.from(event.dataTransfer.files || [])[0];
    await uploadDossierDocument(bestand);
  };

  const handleDossierDocumentOpen = async () => {
    setDossierFormError('');
    if (dossierDocumentPreviewUrl) {
      window.open(dossierDocumentPreviewUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!selectedDossierItem) {
      return;
    }
    try {
      const doc = await fetchNinoxDossierDocument(selectedDossierItem.id);
      if (!doc) {
        setDossierFormError('Geen PDF gevonden voor dit documentveld.');
        return;
      }
      const url = URL.createObjectURL(doc.blob);
      if (dossierDocumentPreviewUrlRef.current) {
        URL.revokeObjectURL(dossierDocumentPreviewUrlRef.current);
      }
      dossierDocumentPreviewUrlRef.current = url;
      setDossierDocumentPreviewUrl(url);
      setDossierDocumentNaam(doc.naam);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setDossierFormError(err instanceof Error ? err.message : 'PDF openen mislukt.');
    }
  };

  const handleDossierDocumentDelete = async () => {
    setDossierFormError('');
    if (dossierDocumentPreviewUrlRef.current) {
      URL.revokeObjectURL(dossierDocumentPreviewUrlRef.current);
    }
    dossierDocumentPreviewUrlRef.current = '';
    setDossierDocumentPreviewUrl('');
    setDossierDocumentNaam('');
    if (!selectedDossierItem) {
      return;
    }

    setDossierUploadingDocument(true);
    try {
      await clearNinoxDossierDocument(selectedDossierItem.id);
    } catch (err) {
      setDossierFormError(err instanceof Error ? err.message : 'PDF verwijderen mislukt.');
    } finally {
      setDossierUploadingDocument(false);
    }
  };

  const handleSaveDossier = async () => {
    if (dossierMode === 'grid') {
      return;
    }
    setDossierSaving(true);
    setDossierFormError('');
    try {
      if (dossierMode === 'nieuw') {
        if (!editingId) {
          return;
        }
        await createNinoxDossier({
          afspraakContractId: editingId,
          typeDocument: dossierTypeDocument,
          omschrijving: dossierOmschrijving,
          extraInformatie: dossierExtraInformatie,
          startdatum: dossierStartdatum,
          einddatum: dossierEinddatum,
        });
        const live = await fetchNinoxDossierVoorAfspraakContract(editingId);
        setDossierItems(live);
        closeDossierItem();
      } else if (selectedDossierItem) {
        await updateNinoxDossier(selectedDossierItem.id, {
          typeDocument: dossierTypeDocument,
          omschrijving: dossierOmschrijving,
          extraInformatie: dossierExtraInformatie,
          startdatum: dossierStartdatum,
          einddatum: dossierEinddatum,
        });
        if (editingId) {
          const live = await fetchNinoxDossierVoorAfspraakContract(editingId);
          setDossierItems(live);
        }
        closeDossierItem();
      }
      setDossierError('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Bijwerken mislukt.';
      setDossierFormError(message);
    } finally {
      setDossierSaving(false);
    }
  };

  const handleSaveInkoop = async () => {
    if (inkoopMode === 'grid') {
      return;
    }
    setInkoopSaving(true);
    setInkoopFormError('');
    try {
      if (inkoopMode === 'nieuw') {
        if (!editingId) {
          return;
        }
        await createNinoxInkoopopdracht({
          afspraakContractId: editingId,
          typeDocument: inkoopTypeDocument,
          omschrijving: inkoopOmschrijving,
          extraInformatie: inkoopExtraInformatie,
          startdatum: inkoopStartdatum,
          einddatum: inkoopEinddatum,
        });
        const live = await fetchNinoxInkoopopdrachtenVoorAfspraakContract(editingId);
        setInkoopItems(live);
        closeInkoopItem();
      } else if (selectedInkoopItem) {
        await updateNinoxInkoopopdracht(selectedInkoopItem.id, {
          typeDocument: inkoopTypeDocument,
          omschrijving: inkoopOmschrijving,
          extraInformatie: inkoopExtraInformatie,
          startdatum: inkoopStartdatum,
          einddatum: inkoopEinddatum,
        });
        if (editingId) {
          const live = await fetchNinoxInkoopopdrachtenVoorAfspraakContract(editingId);
          setInkoopItems(live);
        }
        closeInkoopItem();
      }
      setInkoopError('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Bijwerken mislukt.';
      setInkoopFormError(message);
    } finally {
      setInkoopSaving(false);
    }
  };

  const handleDeleteDossier = async () => {
    if (!selectedDossierItem || dossierMode !== 'bewerk') {
      return;
    }
    setDossierVoorVerwijderen(selectedDossierItem);
  };

  const handleDeleteInkoop = async () => {
    if (!selectedInkoopItem || inkoopMode !== 'bewerk') {
      return;
    }
    setInkoopVoorVerwijderen(selectedInkoopItem);
  };

  const bevestigDeleteDossier = async () => {
    if (!dossierVoorVerwijderen) {
      return;
    }
    setDossierDeleting(true);
    setDossierFormError('');
    try {
      await deleteNinoxDossier(dossierVoorVerwijderen.id);
      if (editingId) {
        const live = await fetchNinoxDossierVoorAfspraakContract(editingId);
        setDossierItems(live);
      }
      setDossierVoorVerwijderen(null);
      closeDossierItem();
      setDossierError('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Vervallen mislukt.';
      setDossierFormError(message);
    } finally {
      setDossierDeleting(false);
    }
  };

  const bevestigDeleteInkoop = async () => {
    if (!inkoopVoorVerwijderen) {
      return;
    }
    setInkoopDeleting(true);
    setInkoopFormError('');
    try {
      await deleteNinoxInkoopopdracht(inkoopVoorVerwijderen.id);
      if (editingId) {
        const live = await fetchNinoxInkoopopdrachtenVoorAfspraakContract(editingId);
        setInkoopItems(live);
      }
      setInkoopVoorVerwijderen(null);
      closeInkoopItem();
      setInkoopError('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Vervallen mislukt.';
      setInkoopFormError(message);
    } finally {
      setInkoopDeleting(false);
    }
  };

  const handleSavePrijs = async () => {
    if (prijsMode === 'grid') {
      return;
    }

    const selectedArtikel = artikelOpties.find((option) => option.id === prijsArtikelId);
    if (!selectedArtikel) {
      setPrijsFormError('Artikel is verplicht.');
      return;
    }

    setPrijsSaving(true);
    setPrijsFormError('');
    try {
      const payload = {
        artikelId: selectedArtikel.id,
        artikelNaam: selectedArtikel.label,
        prijs: parseDutchNumber(prijsWaarde),
        eenheid: prijsEenheid.trim(),
        startdatum: prijsStartdatum,
        einddatum: prijsEinddatum,
      };

      if (prijsMode === 'nieuw') {
        if (!editingId) {
          return;
        }
        await createNinoxPrijsafspraak({
          afspraakContractId: editingId,
          ...payload,
        });
      } else if (selectedPrijsItem) {
        await updateNinoxPrijsafspraak(selectedPrijsItem.id, payload);
      }

      if (editingId) {
        const live = await fetchNinoxPrijsafsprakenVoorAfspraakContract(editingId);
        setPrijsItems(live);
      }
      closePrijsItem();
      setPrijsError('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Bijwerken mislukt.';
      setPrijsFormError(message);
    } finally {
      setPrijsSaving(false);
    }
  };

  const handleDeletePrijs = async () => {
    if (!selectedPrijsItem || prijsMode !== 'bewerk') {
      return;
    }
    setPrijsVoorVerwijderen(selectedPrijsItem);
  };

  const bevestigDeletePrijs = async () => {
    if (!prijsVoorVerwijderen) {
      return;
    }
    setPrijsDeleting(true);
    setPrijsFormError('');
    try {
      await deleteNinoxPrijsafspraak(prijsVoorVerwijderen.id);
      if (editingId) {
        const live = await fetchNinoxPrijsafsprakenVoorAfspraakContract(editingId);
        setPrijsItems(live);
      }
      setPrijsVoorVerwijderen(null);
      closePrijsItem();
      setPrijsError('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Vervallen mislukt.';
      setPrijsFormError(message);
    } finally {
      setPrijsDeleting(false);
    }
  };

  const showFooter =
    activeTab === 'Algemeen' ||
    (activeTab === 'Dossier' && dossierMode !== 'grid') ||
    (activeTab === 'Inkoopopdrachten' && inkoopMode !== 'grid') ||
    (activeTab === 'Prijsafspraken' && prijsMode !== 'grid');
  const selectedRelatieLabel =
    relatieOpties.find((option) => option.id === relatieId)?.label || items.find((item) => item.id === editingId)?.relatie || '';
  const getInlinePdfPreviewUrl = (url: string) =>
    `${url}#toolbar=0&navpanes=0&scrollbar=0&statusbar=0&messages=0`;
  const dossierDocumentInlinePreviewUrl = dossierDocumentPreviewUrl
    ? getInlinePdfPreviewUrl(dossierDocumentPreviewUrl)
    : '';
  const inkoopDocumentInlinePreviewUrl = inkoopDocumentPreviewUrl ? getInlinePdfPreviewUrl(inkoopDocumentPreviewUrl) : '';

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <FileText size={24} className="text-dc-blue-500" />
          <h1 className="text-2xl font-semibold text-dc-gray-500">Afspraken en Contracten</h1>
        </div>
        <p className="text-sm text-dc-gray-400">Tabel AfsprakenContracten ({items.length} records)</p>
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

      <LoadingSpinner active={loading} message="Afspraken en Contracten laden uit Ninox..." />
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
                label="Relatie"
                active={sort.key === 'relatie'}
                direction={sort.direction}
                onClick={() => setSort((current) => nextSortState(current, 'relatie'))}
                className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
              />
              <SortableTh
                label="Onderdeel"
                active={sort.key === 'onderdeel'}
                direction={sort.direction}
                onClick={() => setSort((current) => nextSortState(current, 'onderdeel'))}
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
                    <span className="text-dc-gray-500">{item.relatie || '-'}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-dc-gray-500">{item.onderdeel || '-'}</td>
              </tr>
            ))}
            {filteredItems.length === 0 && !loading && (
              <tr>
                <td colSpan={2} className="px-5 py-8 text-center text-dc-gray-300 text-sm">
                  Geen afspraken of contracten gevonden
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
            style={{ width: '1024px', minWidth: '1024px' }}
          >
            <div className="px-6 py-4 border-b border-dc-blue-500">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-dc-gray-500">
                    {modalMode === 'nieuw'
                      ? 'Afspraak / contract nieuw'
                      : `Afspraak / contract bewerken${selectedRelatieLabel ? ` - ${selectedRelatieLabel}` : ''}`}
                  </h2>
                  <p className="text-sm text-dc-gray-400">Tabel AfsprakenContracten</p>
                </div>
              </div>
            </div>

            <div className="flex border-b border-dc-gray-200">
              {formTabs.map((tab) => {
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => {
                      if (
                        (tab === 'Dossier' || tab === 'Inkoopopdrachten' || tab === 'Prijsafspraken') &&
                        !editingId &&
                        modalMode === 'nieuw'
                      ) {
                        void (async () => {
                          setSaving(true);
                          setFormError('');
                          try {
                            const createdId = await ensureHoofdrecordVoorDossierTab();
                            if (createdId) {
                              setActiveTab(tab);
                            }
                          } catch (err) {
                            const message = err instanceof Error ? err.message : 'Automatisch opslaan mislukt.';
                            setFormError(message);
                          } finally {
                            setSaving(false);
                          }
                        })();
                        return;
                      }
                      setActiveTab(tab);
                    }}
                    className={
                      activeTab === tab
                        ? 'px-4 py-2 text-sm font-medium text-dc-blue-500 border-b-2 border-dc-blue-500'
                        : 'px-4 py-2 text-sm font-medium text-dc-gray-400 hover:text-dc-gray-500'
                    }
                  >
                    {tab}
                  </button>
                );
              })}
            </div>

            <div className="h-[40rem] overflow-y-auto p-6">
              <div className="min-h-full">
                {activeTab === 'Algemeen' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-[repeat(16,minmax(0,1fr))] gap-3">
                      <div className="md:col-span-8">
                        <label className="block text-xs font-medium text-dc-gray-400 mb-1">Relatie</label>
                        <ComboBox
                          value={relatieId}
                          onChange={setRelatieId}
                          options={relatieOpties.map((option) => ({
                            value: option.id,
                            label: option.label,
                            subtitle: option.subtitle,
                          }))}
                          placeholder="Relatie"
                        />
                      </div>
                      <div className="md:col-span-8">
                        <label className="block text-xs font-medium text-dc-gray-400 mb-1">Onderdeel</label>
                        <input
                          value={onderdeel}
                          onChange={(e) => setOnderdeel(e.target.value)}
                          placeholder="Onderdeel"
                          className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-[repeat(16,minmax(0,1fr))] gap-3">
                      <div className="border-t border-red-500 my-1" style={{ gridColumn: '1 / -1' }} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-[repeat(16,minmax(0,1fr))] gap-3">
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label className="block text-xs font-medium text-dc-gray-400 mb-1">Opmerkingen</label>
                        <div className="relative">
                          <textarea
                            value={opmerkingen}
                            onChange={(e) => setOpmerkingen(e.target.value)}
                            rows={opmerkingenExpanded ? 12 : 6}
                            className="dc-memo-textarea w-full rounded-lg border border-dc-gray-200 px-3 py-2 pr-10 text-sm outline-none focus:border-dc-blue-500 resize-none"
                          />
                          <button
                            type="button"
                            onClick={() => setOpmerkingenExpanded((current) => !current)}
                            className="absolute right-2 top-2 text-red-500 hover:text-red-600"
                            title={opmerkingenExpanded ? 'Compact tonen' : 'Groter tonen'}
                            aria-label={opmerkingenExpanded ? 'Compact tonen' : 'Groter tonen'}
                          >
                            <FileText size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'Dossier' && (
                  <div className="space-y-4">
                    {!editingId ? (
                      <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        Sla dit record eerst op voordat dossierregels gekoppeld kunnen worden.
                      </div>
                    ) : dossierMode !== 'grid' ? (
                      <div className="space-y-3">
                        <input
                          ref={dossierDocumentInputRef}
                          type="file"
                          accept=".pdf,application/pdf"
                          onChange={(event) => void handleDossierDocumentChange(event)}
                          className="hidden"
                        />
                        <div className="grid grid-cols-1 md:grid-cols-[repeat(16,minmax(0,1fr))] gap-3">
                          <div className="md:col-span-6">
                            <label className="block text-xs font-medium text-dc-gray-400 mb-1">Type document</label>
                            <ComboBox
                              value={dossierTypeDocument}
                              onChange={setDossierTypeDocument}
                              options={dossierTypeDocumentOpties.map((option) => ({ value: option, label: option }))}
                              placeholder="Type document"
                              searchable={false}
                            />
                          </div>
                          <div className="md:col-span-10">
                            <label className="block text-xs font-medium text-dc-gray-400 mb-1">Omschrijving</label>
                            <input
                              value={dossierOmschrijving}
                              onChange={(e) => setDossierOmschrijving(e.target.value)}
                              className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-[repeat(16,minmax(0,1fr))] gap-3">
                          <div className="md:col-span-3">
                            <label className="block text-xs font-medium text-dc-gray-400 mb-1">Startdatum</label>
                            <DateFieldInput value={dossierStartdatum} onChange={setDossierStartdatum} placeholder="dd/mm/yyyy" />
                          </div>
                          <div className="md:col-span-3">
                            <label className="block text-xs font-medium text-dc-gray-400 mb-1">Einddatum</label>
                            <DateFieldInput value={dossierEinddatum} onChange={setDossierEinddatum} placeholder="dd/mm/yyyy" />
                          </div>
                          <div className="md:col-span-10">
                            <label className="block text-xs font-medium text-dc-gray-400 mb-1">Extra informatie</label>
                            <input
                              value={dossierExtraInformatie}
                              onChange={(e) => setDossierExtraInformatie(e.target.value)}
                              className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-[repeat(16,minmax(0,1fr))] gap-3">
                          <div className="border-t border-red-500 my-1" style={{ gridColumn: '1 / -1' }} />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-[repeat(16,minmax(0,1fr))] gap-3">
                          <div
                            style={{ gridColumn: '1 / -1' }}
                            onDragOver={handleDossierDocumentDragOver}
                            onDragLeave={handleDossierDocumentDragLeave}
                            onDrop={(event) => void handleDossierDocumentDrop(event)}
                            className={`rounded-lg border p-4 transition-colors ${
                              dossierDocumentDragActive
                                ? 'border-dc-blue-500 bg-dc-blue-50/40'
                                : 'border-dc-gray-100'
                            }`}
                          >
                            <label className="block text-xs font-medium text-dc-gray-400 mb-2">Document</label>
                            <div className="flex items-center gap-2">
                              <input
                                value={dossierDocumentNaam}
                                readOnly
                                placeholder="Geen PDF gekozen"
                                className="flex-1 rounded-lg border border-dc-gray-200 px-3 py-2 text-sm text-dc-gray-500 bg-white"
                              />
                              <button
                                type="button"
                                onClick={openDossierDocumentPicker}
                                disabled={dossierUploadingDocument || dossierSaving || dossierDeleting}
                                className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                {dossierUploadingDocument ? 'Uploaden...' : 'Kies PDF'}
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDossierDocumentOpen()}
                                disabled={dossierUploadingDocument || (!dossierDocumentNaam && !dossierDocumentPreviewUrl)}
                                className="px-4 py-2 rounded-lg bg-yellow-400 text-black text-sm font-medium hover:bg-yellow-500 disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                Open PDF
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDossierDocumentDelete()}
                                disabled={dossierUploadingDocument || !dossierDocumentNaam}
                                className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                Verwijder PDF
                              </button>
                            </div>
                            <div
                              className={`mt-3 rounded-lg border border-dashed px-4 py-5 text-sm text-center transition-colors ${
                                dossierDocumentDragActive
                                  ? 'border-dc-blue-500 text-dc-blue-700 bg-[repeating-linear-gradient(180deg,rgba(250,204,21,0.22)_0px,rgba(250,204,21,0.22)_10px,rgba(59,130,246,0.18)_10px,rgba(59,130,246,0.18)_20px)]'
                                  : 'border-dc-gray-200 text-dc-gray-500 bg-[repeating-linear-gradient(180deg,rgba(250,204,21,0.12)_0px,rgba(250,204,21,0.12)_10px,rgba(59,130,246,0.10)_10px,rgba(59,130,246,0.10)_20px)]'
                              }`}
                            >
                              {selectedDossierItem
                                ? dossierUploadingDocument
                                  ? 'PDF uploaden...'
                                  : 'Sleep hier een PDF naartoe of gebruik Kies PDF'
                                : dossierUploadingDocument
                                ? 'Dossierregel opslaan en PDF uploaden...'
                                : 'Sleep hier een PDF naartoe of gebruik Kies PDF. De dossierregel wordt automatisch opgeslagen.'}
                            </div>
                            {dossierDocumentPreviewUrl && (
                              <div className="mt-2 border border-dc-gray-200 rounded-lg p-2 bg-white">
                                <object
                                  data={dossierDocumentInlinePreviewUrl}
                                  type="application/pdf"
                                  className="w-full h-[24rem] rounded border border-dc-gray-200 bg-white"
                                >
                                  <div className="text-xs text-dc-gray-400 px-2 py-1">Preview niet beschikbaar</div>
                                </object>
                              </div>
                            )}
                          </div>
                        </div>

                        {dossierFormError && (
                          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                            {dossierFormError}
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-col gap-3 md:flex-row md:items-center">
                          <button
                            type="button"
                            onClick={() => void openNieuwDossierItem()}
                            className="px-4 py-2 rounded-lg bg-yellow-400 text-dc-gray-700 text-sm font-medium hover:bg-yellow-500"
                          >
                            Nieuw
                          </button>
                          <div className="relative w-full flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dc-gray-300" />
                            <input
                              value={dossierZoek}
                              onChange={(e) => setDossierZoek(e.target.value)}
                              placeholder="Zoeken op alle kolommen, meerdere kolommen zoeken mogelijk door je zoekwoorden met een , te scheiden..."
                              className="w-full rounded-lg border border-dc-gray-200 bg-white pl-9 pr-3 py-2 text-sm text-dc-gray-500 outline-none focus:border-dc-blue-500"
                            />
                          </div>
                        </div>

                        {dossierError && (
                          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                            {dossierError}
                          </div>
                        )}

                        <div className="bg-white rounded-xl border border-dc-gray-100 overflow-hidden">
                          <table className="min-w-full text-sm">
                            <thead className="bg-dc-gray-50">
                              <tr>
                                <SortableTh
                                  label="Type document"
                                  active={dossierSort.key === 'typeDocument'}
                                  direction={dossierSort.direction}
                                  onClick={() => setDossierSort((current) => nextSortState(current, 'typeDocument'))}
                                  className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400"
                                />
                                <SortableTh
                                  label="Omschrijving"
                                  active={dossierSort.key === 'omschrijving'}
                                  direction={dossierSort.direction}
                                  onClick={() => setDossierSort((current) => nextSortState(current, 'omschrijving'))}
                                  className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400"
                                />
                                <SortableTh
                                  label="Extra informatie"
                                  active={dossierSort.key === 'extraInformatie'}
                                  direction={dossierSort.direction}
                                  onClick={() => setDossierSort((current) => nextSortState(current, 'extraInformatie'))}
                                  className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400"
                                />
                                <SortableTh
                                  label="Startdatum"
                                  active={dossierSort.key === 'startdatum'}
                                  direction={dossierSort.direction}
                                  onClick={() => setDossierSort((current) => nextSortState(current, 'startdatum'))}
                                  className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400"
                                />
                                <SortableTh
                                  label="Einddatum"
                                  active={dossierSort.key === 'einddatum'}
                                  direction={dossierSort.direction}
                                  onClick={() => setDossierSort((current) => nextSortState(current, 'einddatum'))}
                                  className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400"
                                />
                              </tr>
                            </thead>
                            <tbody>
                              {dossierLoading ? (
                                <tr>
                                  <td colSpan={5} className="px-5 py-8">
                                    <div className="flex items-center justify-center">
                                      <LoadingSpinner message="Dossier laden..." overlay={false} size="md" />
                                    </div>
                                  </td>
                                </tr>
                              ) : filteredDossierItems.map((item, index) => (
                                <tr
                                  key={item.id}
                                  onClick={() => void openDossierItem(item)}
                                  className={`${index % 2 === 0 ? 'dc-zebra-row' : 'bg-white'} dc-clickable-row cursor-pointer`}
                                >
                                  <td className="px-5 py-3 text-dc-gray-500">{item.typeDocument || '-'}</td>
                                  <td className="px-5 py-3 text-dc-gray-500">{item.omschrijving || '-'}</td>
                                  <td className="px-5 py-3 text-dc-gray-500">{item.extraInformatie || '-'}</td>
                                  <td className="px-5 py-3 text-dc-gray-500">{item.startdatum ? formatDateDdMmYyyy(item.startdatum) : '-'}</td>
                                  <td className="px-5 py-3 text-dc-gray-500">{item.einddatum ? formatDateDdMmYyyy(item.einddatum) : '-'}</td>
                                </tr>
                              ))}
                              {!dossierLoading && filteredDossierItems.length === 0 && (
                                <tr>
                                  <td colSpan={5} className="px-5 py-8 text-center text-dc-gray-300 text-sm">
                                    Geen dossierregels gevonden
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {activeTab === 'Inkoopopdrachten' && (
                  <div className="space-y-4">
                    {!editingId ? (
                      <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        Sla dit record eerst op voordat inkoopopdrachten gekoppeld kunnen worden.
                      </div>
                    ) : inkoopMode !== 'grid' ? (
                      <div className="space-y-3">
                        <input
                          ref={inkoopDocumentInputRef}
                          type="file"
                          accept=".pdf,application/pdf"
                          onChange={(event) => void handleInkoopDocumentChange(event)}
                          className="hidden"
                        />
                        <div className="grid grid-cols-1 md:grid-cols-[repeat(16,minmax(0,1fr))] gap-3">
                          <div className="md:col-span-6">
                              <label className="block text-xs font-medium text-dc-gray-400 mb-1">Omschrijving</label>
                              <input
                                value={inkoopOmschrijving}
                                onChange={(e) => setInkoopOmschrijving(e.target.value)}
                              className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-[repeat(16,minmax(0,1fr))] gap-3">
                          <div className="md:col-span-3">
                            <label className="block text-xs font-medium text-dc-gray-400 mb-1">Startdatum</label>
                            <DateFieldInput value={inkoopStartdatum} onChange={setInkoopStartdatum} placeholder="dd/mm/yyyy" />
                          </div>
                          <div className="md:col-span-3">
                            <label className="block text-xs font-medium text-dc-gray-400 mb-1">Einddatum</label>
                            <DateFieldInput value={inkoopEinddatum} onChange={setInkoopEinddatum} placeholder="dd/mm/yyyy" />
                          </div>
                          <div className="md:col-span-10">
                            <label className="block text-xs font-medium text-dc-gray-400 mb-1">Extra informatie</label>
                            <input
                              value={inkoopExtraInformatie}
                              onChange={(e) => setInkoopExtraInformatie(e.target.value)}
                              className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-[repeat(16,minmax(0,1fr))] gap-3">
                          <div className="border-t border-red-500 my-1" style={{ gridColumn: '1 / -1' }} />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-[repeat(16,minmax(0,1fr))] gap-3">
                          <div
                            style={{ gridColumn: '1 / -1' }}
                            onDragOver={handleInkoopDocumentDragOver}
                            onDragLeave={handleInkoopDocumentDragLeave}
                            onDrop={(event) => void handleInkoopDocumentDrop(event)}
                            className={`rounded-lg border p-4 transition-colors ${
                              inkoopDocumentDragActive
                                ? 'border-dc-blue-500 bg-dc-blue-50/40'
                                : 'border-dc-gray-100'
                            }`}
                          >
                            <label className="block text-xs font-medium text-dc-gray-400 mb-2">Document</label>
                            <div className="flex items-center gap-2">
                              <input
                                value={inkoopDocumentNaam}
                                readOnly
                                placeholder="Geen PDF gekozen"
                                className="flex-1 rounded-lg border border-dc-gray-200 px-3 py-2 text-sm text-dc-gray-500 bg-white"
                              />
                              <button
                                type="button"
                                onClick={openInkoopDocumentPicker}
                                disabled={inkoopUploadingDocument || inkoopSaving || inkoopDeleting}
                                className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                {inkoopUploadingDocument ? 'Uploaden...' : 'Kies PDF'}
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleInkoopDocumentOpen()}
                                disabled={inkoopUploadingDocument || (!inkoopDocumentNaam && !inkoopDocumentPreviewUrl)}
                                className="px-4 py-2 rounded-lg bg-yellow-400 text-black text-sm font-medium hover:bg-yellow-500 disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                Open PDF
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleInkoopDocumentDelete()}
                                disabled={inkoopUploadingDocument || !inkoopDocumentNaam}
                                className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                Verwijder PDF
                              </button>
                            </div>
                            <div
                              className={`mt-3 rounded-lg border border-dashed px-4 py-5 text-sm text-center transition-colors ${
                                inkoopDocumentDragActive
                                  ? 'border-dc-blue-500 text-dc-blue-700 bg-[repeating-linear-gradient(180deg,rgba(250,204,21,0.22)_0px,rgba(250,204,21,0.22)_10px,rgba(59,130,246,0.18)_10px,rgba(59,130,246,0.18)_20px)]'
                                  : 'border-dc-gray-200 text-dc-gray-500 bg-[repeating-linear-gradient(180deg,rgba(250,204,21,0.12)_0px,rgba(250,204,21,0.12)_10px,rgba(59,130,246,0.10)_10px,rgba(59,130,246,0.10)_20px)]'
                              }`}
                            >
                              {selectedInkoopItem
                                ? inkoopUploadingDocument
                                  ? 'PDF uploaden...'
                                  : 'Sleep hier een PDF naartoe of gebruik Kies PDF'
                                : inkoopUploadingDocument
                                ? 'Inkoopopdracht opslaan en PDF uploaden...'
                                : 'Sleep hier een PDF naartoe of gebruik Kies PDF. De inkoopopdracht wordt automatisch opgeslagen.'}
                            </div>
                            {inkoopDocumentPreviewUrl && (
                              <div className="mt-2 border border-dc-gray-200 rounded-lg p-2 bg-white">
                                <object
                                  data={inkoopDocumentInlinePreviewUrl}
                                  type="application/pdf"
                                  className="w-full h-40 rounded border border-dc-gray-200 bg-white"
                                >
                                  <div className="text-xs text-dc-gray-400 px-2 py-1">Preview niet beschikbaar</div>
                                </object>
                              </div>
                            )}
                          </div>
                        </div>

                        {inkoopFormError && (
                          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                            {inkoopFormError}
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-col gap-3 md:flex-row md:items-center">
                          <button
                            type="button"
                            onClick={() => void openNieuwInkoopItem()}
                            className="px-4 py-2 rounded-lg bg-yellow-400 text-dc-gray-700 text-sm font-medium hover:bg-yellow-500"
                          >
                            Nieuw
                          </button>
                          <div className="relative w-full flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dc-gray-300" />
                            <input
                              value={inkoopZoek}
                              onChange={(e) => setInkoopZoek(e.target.value)}
                              placeholder="Zoeken op alle kolommen, meerdere kolommen zoeken mogelijk door je zoekwoorden met een , te scheiden..."
                              className="w-full rounded-lg border border-dc-gray-200 bg-white pl-9 pr-3 py-2 text-sm text-dc-gray-500 outline-none focus:border-dc-blue-500"
                            />
                          </div>
                        </div>

                        {inkoopError && (
                          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                            {inkoopError}
                          </div>
                        )}

                        <div className="bg-white rounded-xl border border-dc-gray-100 overflow-hidden">
                          <table className="min-w-full text-sm">
                            <thead className="bg-dc-gray-50">
                              <tr>
                                <SortableTh
                                  label="Omschrijving"
                                  active={inkoopSort.key === 'omschrijving'}
                                  direction={inkoopSort.direction}
                                  onClick={() => setInkoopSort((current) => nextSortState(current, 'omschrijving'))}
                                  className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400"
                                />
                                <SortableTh
                                  label="Extra informatie"
                                  active={inkoopSort.key === 'extraInformatie'}
                                  direction={inkoopSort.direction}
                                  onClick={() => setInkoopSort((current) => nextSortState(current, 'extraInformatie'))}
                                  className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400"
                                />
                                <SortableTh
                                  label="Startdatum"
                                  active={inkoopSort.key === 'startdatum'}
                                  direction={inkoopSort.direction}
                                  onClick={() => setInkoopSort((current) => nextSortState(current, 'startdatum'))}
                                  className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400"
                                />
                                <SortableTh
                                  label="Einddatum"
                                  active={inkoopSort.key === 'einddatum'}
                                  direction={inkoopSort.direction}
                                  onClick={() => setInkoopSort((current) => nextSortState(current, 'einddatum'))}
                                  className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400"
                                />
                              </tr>
                            </thead>
                            <tbody>
                              {inkoopLoading ? (
                                <tr>
                                  <td colSpan={5} className="px-5 py-8">
                                    <div className="flex items-center justify-center">
                                      <LoadingSpinner message="Inkoopopdrachten laden..." overlay={false} size="md" />
                                    </div>
                                  </td>
                                </tr>
                              ) : filteredInkoopItems.map((item, index) => (
                                <tr
                                  key={item.id}
                                  onClick={() => void openInkoopItem(item)}
                                  className={`${index % 2 === 0 ? 'dc-zebra-row' : 'bg-white'} dc-clickable-row cursor-pointer`}
                                >
                                  <td className="px-5 py-3 text-dc-gray-500">{item.omschrijving || '-'}</td>
                                  <td className="px-5 py-3 text-dc-gray-500">{item.extraInformatie || '-'}</td>
                                  <td className="px-5 py-3 text-dc-gray-500">{item.startdatum ? formatDateDdMmYyyy(item.startdatum) : '-'}</td>
                                  <td className="px-5 py-3 text-dc-gray-500">{item.einddatum ? formatDateDdMmYyyy(item.einddatum) : '-'}</td>
                                </tr>
                              ))}
                              {!inkoopLoading && filteredInkoopItems.length === 0 && (
                                <tr>
                                  <td colSpan={4} className="px-5 py-8 text-center text-dc-gray-300 text-sm">
                                    Geen inkoopopdrachten gevonden
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {activeTab === 'Prijsafspraken' && (
                  <div className="space-y-4">
                    {!editingId ? (
                      <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        Sla dit record eerst op voordat prijsafspraken gekoppeld kunnen worden.
                      </div>
                    ) : prijsMode !== 'grid' ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-[repeat(16,minmax(0,1fr))] gap-3">
                          <div className="md:col-span-7">
                            <label className="block text-xs font-medium text-dc-gray-400 mb-1">Artikel</label>
                            <ComboBox
                              value={prijsArtikelId}
                              onChange={setPrijsArtikelId}
                              options={artikelOpties.map((option) => ({ value: option.id, label: option.label }))}
                              placeholder="Artikel"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-dc-gray-400 mb-1">Prijs</label>
                            <input
                              value={prijsWaarde}
                              onChange={(e) => setPrijsWaarde(formatDutchNumberInputLive(e.target.value, 2))}
                              inputMode="decimal"
                              className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm text-right outline-none focus:border-dc-blue-500"
                            />
                          </div>
                          <div className="md:col-span-4">
                            <label className="block text-xs font-medium text-dc-gray-400 mb-1">Eenheid</label>
                            <ComboBox
                              value={prijsEenheid}
                              onChange={setPrijsEenheid}
                              options={prijsEenheidOpties.map((option) => ({ value: option, label: option }))}
                              placeholder="Eenheid"
                              searchable={false}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-[repeat(16,minmax(0,1fr))] gap-3">
                          <div className="md:col-span-3">
                            <label className="block text-xs font-medium text-dc-gray-400 mb-1">Startdatum</label>
                            <DateFieldInput value={prijsStartdatum} onChange={setPrijsStartdatum} placeholder="dd/mm/yyyy" />
                          </div>
                          <div className="md:col-span-3">
                            <label className="block text-xs font-medium text-dc-gray-400 mb-1">Einddatum</label>
                            <DateFieldInput value={prijsEinddatum} onChange={setPrijsEinddatum} placeholder="dd/mm/yyyy" />
                          </div>
                        </div>

                        {prijsFormError && (
                          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                            {prijsFormError}
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-col gap-3 md:flex-row md:items-center">
                          <button
                            type="button"
                            onClick={() => void openNieuwPrijsItem()}
                            className="px-4 py-2 rounded-lg bg-yellow-400 text-dc-gray-700 text-sm font-medium hover:bg-yellow-500"
                          >
                            Nieuw
                          </button>
                          <div className="relative w-full flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dc-gray-300" />
                            <input
                              value={prijsZoek}
                              onChange={(e) => setPrijsZoek(e.target.value)}
                              placeholder="Zoeken op alle kolommen, meerdere kolommen zoeken mogelijk door je zoekwoorden met een , te scheiden..."
                              className="w-full rounded-lg border border-dc-gray-200 bg-white pl-9 pr-3 py-2 text-sm text-dc-gray-500 outline-none focus:border-dc-blue-500"
                            />
                          </div>
                        </div>

                        {prijsError && (
                          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                            {prijsError}
                          </div>
                        )}

                        <div className="bg-white rounded-xl border border-dc-gray-100 overflow-hidden">
                          <table className="min-w-full text-sm">
                            <thead className="bg-dc-gray-50">
                              <tr>
                                <SortableTh
                                  label="Artikel"
                                  active={prijsSort.key === 'omschrijving'}
                                  direction={prijsSort.direction}
                                  onClick={() => setPrijsSort((current) => nextSortState(current, 'omschrijving'))}
                                  className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400"
                                />
                                <SortableTh
                                  label="Prijs"
                                  active={prijsSort.key === 'typeDocument'}
                                  direction={prijsSort.direction}
                                  onClick={() => setPrijsSort((current) => nextSortState(current, 'typeDocument'))}
                                  className="text-right px-5 py-3 text-xs font-semibold text-dc-gray-400"
                                />
                                <SortableTh
                                  label="Eenheid"
                                  active={prijsSort.key === 'extraInformatie'}
                                  direction={prijsSort.direction}
                                  onClick={() => setPrijsSort((current) => nextSortState(current, 'extraInformatie'))}
                                  className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400"
                                />
                                <SortableTh
                                  label="Startdatum"
                                  active={prijsSort.key === 'startdatum'}
                                  direction={prijsSort.direction}
                                  onClick={() => setPrijsSort((current) => nextSortState(current, 'startdatum'))}
                                  className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400"
                                />
                                <SortableTh
                                  label="Einddatum"
                                  active={prijsSort.key === 'einddatum'}
                                  direction={prijsSort.direction}
                                  onClick={() => setPrijsSort((current) => nextSortState(current, 'einddatum'))}
                                  className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400"
                                />
                              </tr>
                            </thead>
                            <tbody>
                              {prijsLoading ? (
                                <tr>
                                  <td colSpan={5} className="px-5 py-8">
                                    <div className="flex items-center justify-center">
                                      <LoadingSpinner message="Prijsafspraken laden..." overlay={false} size="md" />
                                    </div>
                                  </td>
                                </tr>
                              ) : filteredPrijsItems.map((item, index) => (
                                <tr
                                  key={item.id}
                                  onClick={() => void openPrijsItem(item)}
                                  className={`${index % 2 === 0 ? 'dc-zebra-row' : 'bg-white'} dc-clickable-row cursor-pointer`}
                                >
                                  <td className="px-5 py-3 text-dc-gray-500">{item.artikel || '-'}</td>
                                  <td className="px-5 py-3 text-dc-gray-500 text-right">{typeof item.prijs === 'number' ? formatDutchNumber(item.prijs) : '-'}</td>
                                  <td className="px-5 py-3 text-dc-gray-500">{item.eenheid || '-'}</td>
                                  <td className="px-5 py-3 text-dc-gray-500">{item.startdatum ? formatDateDdMmYyyy(item.startdatum) : '-'}</td>
                                  <td className="px-5 py-3 text-dc-gray-500">{item.einddatum ? formatDateDdMmYyyy(item.einddatum) : '-'}</td>
                                </tr>
                              ))}
                              {!prijsLoading && filteredPrijsItems.length === 0 && (
                                <tr>
                                  <td colSpan={5} className="px-5 py-8 text-center text-dc-gray-300 text-sm">
                                    Geen prijsafspraken gevonden
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {showFooter && formError && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {formError}
                </div>
              )}
            </div>

            <div className="border-t border-dc-blue-500 px-6 py-4 min-h-[73px] flex items-center justify-between">
              {showFooter ? (
                <>
                  <div>
                    {activeTab === 'Dossier' && dossierMode === 'bewerk' && selectedDossierItem ? (
                      <button
                        type="button"
                        onClick={() => void handleDeleteDossier()}
                        disabled={dossierSaving || dossierDeleting}
                        className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {dossierDeleting && <Loader2 className="inline w-4 h-4 mr-2 animate-spin" />}
                        {dossierDeleting ? 'Bezig...' : 'Vervallen'}
                      </button>
                    ) : activeTab === 'Inkoopopdrachten' && inkoopMode === 'bewerk' && selectedInkoopItem ? (
                      <button
                        type="button"
                        onClick={() => void handleDeleteInkoop()}
                        disabled={inkoopSaving || inkoopDeleting}
                        className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {inkoopDeleting && <Loader2 className="inline w-4 h-4 mr-2 animate-spin" />}
                        {inkoopDeleting ? 'Bezig...' : 'Vervallen'}
                      </button>
                    ) : activeTab === 'Prijsafspraken' && prijsMode === 'bewerk' && selectedPrijsItem ? (
                      <button
                        type="button"
                        onClick={() => void handleDeletePrijs()}
                        disabled={prijsSaving || prijsDeleting}
                        className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {prijsDeleting && <Loader2 className="inline w-4 h-4 mr-2 animate-spin" />}
                        {prijsDeleting ? 'Bezig...' : 'Vervallen'}
                      </button>
                    ) : modalMode === 'bewerk' ? (
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={saving || deletingId === editingId}
                        className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {deletingId === editingId && <Loader2 className="inline w-4 h-4 mr-2 animate-spin" />}
                        {deletingId === editingId ? 'Bezig...' : 'Vervallen'}
                      </button>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={
                        activeTab === 'Dossier'
                          ? closeDossierItem
                          : activeTab === 'Inkoopopdrachten'
                          ? closeInkoopItem
                          : activeTab === 'Prijsafspraken'
                          ? closePrijsItem
                          : closeModal
                      }
                      disabled={
                        saving ||
                        deletingId === editingId ||
                        dossierSaving ||
                        dossierDeleting ||
                        inkoopSaving ||
                        inkoopDeleting ||
                        prijsSaving ||
                        prijsDeleting
                      }
                      className="px-4 py-2 rounded-lg border border-dc-gray-200 text-sm font-medium text-dc-gray-500 hover:bg-dc-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      Annuleren
                    </button>
                    {activeTab === 'Dossier' ? (
                      <button
                        type="button"
                        onClick={() => void handleSaveDossier()}
                        disabled={dossierSaving || dossierDeleting}
                        className="px-4 py-2 rounded-lg bg-dc-blue-500 text-white text-sm font-medium hover:bg-dc-blue-600 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {dossierSaving && <Loader2 className="inline w-4 h-4 mr-2 animate-spin" />}
                        {dossierSaving ? 'Bezig...' : dossierMode === 'nieuw' ? 'Opslaan' : 'Bijwerken'}
                      </button>
                    ) : activeTab === 'Inkoopopdrachten' ? (
                      <button
                        type="button"
                        onClick={() => void handleSaveInkoop()}
                        disabled={inkoopSaving || inkoopDeleting}
                        className="px-4 py-2 rounded-lg bg-dc-blue-500 text-white text-sm font-medium hover:bg-dc-blue-600 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {inkoopSaving && <Loader2 className="inline w-4 h-4 mr-2 animate-spin" />}
                        {inkoopSaving ? 'Bezig...' : inkoopMode === 'nieuw' ? 'Opslaan' : 'Bijwerken'}
                      </button>
                    ) : activeTab === 'Prijsafspraken' ? (
                      <button
                        type="button"
                        onClick={() => void handleSavePrijs()}
                        disabled={prijsSaving || prijsDeleting}
                        className="px-4 py-2 rounded-lg bg-dc-blue-500 text-white text-sm font-medium hover:bg-dc-blue-600 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {prijsSaving && <Loader2 className="inline w-4 h-4 mr-2 animate-spin" />}
                        {prijsSaving ? 'Bezig...' : prijsMode === 'nieuw' ? 'Opslaan' : 'Bijwerken'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleSave()}
                        disabled={saving || deletingId === editingId}
                        className="px-4 py-2 rounded-lg bg-dc-blue-500 text-white text-sm font-medium hover:bg-dc-blue-600 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {saving && <Loader2 className="inline w-4 h-4 mr-2 animate-spin" />}
                        {saving ? 'Bezig...' : modalMode === 'nieuw' ? 'Opslaan' : 'Bijwerken'}
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="w-full" />
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(itemVoorVerwijderen)}
        title="Afspraak / contract vervallen"
        message={`Weet u zeker dat ${itemVoorVerwijderen?.onderdeel || 'dit record'} vervallen mag worden?`}
        cancelLabel="Nee"
        confirmLabel="Ja"
        confirming={deletingId === itemVoorVerwijderen?.id}
        onCancel={() => {
          if (!deletingId) {
            setItemVoorVerwijderen(null);
          }
        }}
        onConfirm={() => void bevestigDelete()}
      />

      <ConfirmDialog
        open={Boolean(dossierVoorVerwijderen)}
        title="Dossierregel vervallen"
        message={`Weet u zeker dat ${dossierVoorVerwijderen?.omschrijving || 'deze dossierregel'} vervallen mag worden?`}
        cancelLabel="Nee"
        confirmLabel="Ja"
        confirming={dossierDeleting}
        onCancel={() => {
          if (!dossierDeleting) {
            setDossierVoorVerwijderen(null);
          }
        }}
        onConfirm={() => void bevestigDeleteDossier()}
      />
      <ConfirmDialog
        open={Boolean(inkoopVoorVerwijderen)}
        title="Inkoopopdracht vervallen"
        message={`Weet u zeker dat ${inkoopVoorVerwijderen?.omschrijving || 'deze inkoopopdracht'} vervallen mag worden?`}
        confirmLabel="Ja"
        cancelLabel="Nee"
        confirming={inkoopDeleting}
        onCancel={() => {
          if (!inkoopDeleting) {
            setInkoopVoorVerwijderen(null);
          }
        }}
        onConfirm={() => void bevestigDeleteInkoop()}
      />
      <ConfirmDialog
        open={Boolean(prijsVoorVerwijderen)}
        title="Prijsafspraak vervallen"
        message={`Weet u zeker dat ${prijsVoorVerwijderen?.artikel || 'deze prijsafspraak'} vervallen mag worden?`}
        confirmLabel="Ja"
        cancelLabel="Nee"
        confirming={prijsDeleting}
        onCancel={() => {
          if (!prijsDeleting) {
            setPrijsVoorVerwijderen(null);
          }
        }}
        onConfirm={() => void bevestigDeletePrijs()}
      />
    </div>
  );
}
