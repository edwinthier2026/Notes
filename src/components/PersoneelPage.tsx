import { Banknote, ChevronDown, ChevronRight, Loader2, Search, User } from 'lucide-react';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import type { MailTemplate, Personeel, VerlofUur } from '../types';
import { createNinoxVerlofuur, deleteNinoxPersoneel, deleteNinoxVerlofuur, fetchNinoxMailTemplates, fetchNinoxPersoneel, fetchNinoxVerlofuren, updateNinoxPersoneel, updateNinoxVerlofuur } from '../lib/ninox';
import { fetchApi } from '../lib/api';
import { compareStrings, nextSortState, type SortState } from '../lib/sort';
import { formatDutchNumber, parseDutchNumber } from '../lib/amount';
import { matchesAllTerms, parseSearchTerms } from '../lib/search';
import { waitForNextPaint } from '../lib/render';
import { createPdfDocumentForPages, extractPdfPageTexts, matchPdfPagesToPersoneel } from '../lib/pdf';
import LoadingSpinner from './ui/LoadingSpinner';
import SortableTh from './ui/SortableTh';
import NumericFieldInput from './ui/NumericFieldInput';
import ComboBox from './ui/ComboBox';
import DateFieldInput from './ui/DateFieldInput';
import ConfirmDialog from './ui/ConfirmDialog';
import MailFormulier, { type MailFormulierConfig } from './ui/MailFormulier';
import YesNoSlicer from './ui/YesNoSlicer';

type FilePickerWindow = Window & typeof globalThis & {
  showOpenFilePicker?: (options?: {
    multiple?: boolean;
    excludeAcceptAllOption?: boolean;
    types?: Array<{
      description?: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<FileSystemFileHandleLike[]>;
  showDirectoryPicker?: (options?: {
    id?: string;
    mode?: 'read' | 'readwrite';
    startIn?: FileSystemFileHandleLike;
  }) => Promise<FileSystemDirectoryHandleLike>;
};

interface FileSystemWritableFileStreamLike {
  write(data: BufferSource | Blob | string): Promise<void>;
  close(): Promise<void>;
}

interface FileSystemFileHandleLike {
  kind?: 'file';
  name: string;
  getFile(): Promise<File>;
}

interface FileSystemDirectoryHandleLike {
  getFileHandle(name: string, options?: { create?: boolean }): Promise<{
    createWritable: () => Promise<FileSystemWritableFileStreamLike>;
  }>;
}

interface SalarisPdfRow {
  naam: string;
  roepnaam: string;
  mailZakelijk: string;
  pdfBestandsnaam: string;
  pageNumbers: number[];
  pdfUrl: string;
  pdfBytes: Uint8Array;
}

export default function PersoneelPage() {
  const { user } = useAuth();
  type PersoneelGridSortKey = 'naam' | 'mailZakelijk' | 'telefoonZakelijk' | 'werkurenPerWeek' | 'percentageWbso';
  type FormTab = 'Algemeen' | 'WBSO';
  type PersoneelTab = 'algemeen' | 'verlofuren' | 'salarissen';

  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab');
  const activeTab: PersoneelTab = tab === 'verlofuren' || tab === 'salarissen' ? tab : 'algemeen';

  const [items, setItems] = useState<Personeel[]>([]);
  const [verlofItems, setVerlofItems] = useState<VerlofUur[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sort, setSort] = useState<SortState<PersoneelGridSortKey>>({ key: 'naam', direction: 'asc' });
  const [zoek, setZoek] = useState('');
  const [verlofZoek, setVerlofZoek] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [formTab, setFormTab] = useState<FormTab>('Algemeen');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [naam, setNaam] = useState('');
  const [mailZakelijk, setMailZakelijk] = useState('');
  const [telefoonZakelijk, setTelefoonZakelijk] = useState('');
  const [datumInDienst, setDatumInDienst] = useState('');
  const [datumUitDienst, setDatumUitDienst] = useState('');
  const [werkurenPerWeek, setWerkurenPerWeek] = useState('');
  const [verlofurenPerJaar, setVerlofurenPerJaar] = useState('');
  const [percentageWbso, setPercentageWbso] = useState('');
  const [maandag, setMaandag] = useState(true);
  const [dinsdag, setDinsdag] = useState(true);
  const [woensdag, setWoensdag] = useState(true);
  const [donderdag, setDonderdag] = useState(true);
  const [vrijdag, setVrijdag] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [verlofModalOpen, setVerlofModalOpen] = useState(false);
  const [verlofEditingId, setVerlofEditingId] = useState<number | null>(null);
  const [verlofMedewerker, setVerlofMedewerker] = useState('');
  const [verlofDatum, setVerlofDatum] = useState('');
  const [verlofOmschrijving, setVerlofOmschrijving] = useState('');
  const [verlofAantalUur, setVerlofAantalUur] = useState('');
  const [verlofSaving, setVerlofSaving] = useState(false);
  const [verlofFormError, setVerlofFormError] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [personeelVoorVervallen, setPersoneelVoorVervallen] = useState<Personeel | null>(null);
  const [verlofVoorVervallen, setVerlofVoorVervallen] = useState<VerlofUur | null>(null);
  const [openVerlofGroups, setOpenVerlofGroups] = useState<Record<string, boolean>>({});
  const [openingRowKey, setOpeningRowKey] = useState<string | null>(null);
  const [salarisRapportFileName, setSalarisRapportFileName] = useState('');
  const [salarisRapportSaving, setSalarisRapportSaving] = useState(false);
  const [salarisRapportError, setSalarisRapportError] = useState('');
  const [salarisRapportResult, setSalarisRapportResult] = useState('');
  const [salarisZoek, setSalarisZoek] = useState('');
  const [salarisRows, setSalarisRows] = useState<SalarisPdfRow[]>([]);
  const [salarisMailRow, setSalarisMailRow] = useState<SalarisPdfRow | null>(null);
  const [salarisMailError, setSalarisMailError] = useState('');
  const [salarisMailSending, setSalarisMailSending] = useState(false);
  const [salarisMailProgressCurrent, setSalarisMailProgressCurrent] = useState(0);
  const [salarisMailProgressTotal, setSalarisMailProgressTotal] = useState(0);
  const [mailTemplates, setMailTemplates] = useState<MailTemplate[]>([]);
  const salarisRapportInputRef = useRef<HTMLInputElement | null>(null);

  const handleNieuw = async () => {
    if (activeTab === 'verlofuren') {
      await ensurePersoneelLoaded();
      setVerlofEditingId(null);
      setVerlofMedewerker('');
      setVerlofDatum('');
      setVerlofOmschrijving('');
      setVerlofAantalUur('');
      setVerlofFormError('');
      setVerlofModalOpen(true);
      return;
    }
    // Volgende stap: personeel nieuw/bewerken modal.
  };

  const handleBewerk = (item: Personeel) => {
    setEditingId(item.id);
    setNaam(item.naam || '');
    setMailZakelijk(item.mailZakelijk || '');
    setTelefoonZakelijk(item.telefoonZakelijk || '');
    setDatumInDienst(item.startdatum || '');
    setDatumUitDienst(item.einddatum || '');
    setVerlofurenPerJaar(item.verlofurenPerJaar || '');
    setPercentageWbso(item.percentageWbso || '');
    setMaandag(item.maandag ?? true);
    setDinsdag(item.dinsdag ?? true);
    setWoensdag(item.woensdag ?? true);
    setDonderdag(item.donderdag ?? true);
    setVrijdag(item.vrijdag ?? true);
    setWerkurenPerWeek(item.werkurenPerWeek || '');
    setFormTab('Algemeen');
    setFormError('');
    setModalOpen(true);
  };


  const handleOpenPersoneelFromGrid = async (item: Personeel) => {
    setOpeningRowKey(`personeel-${item.id}`);
    await waitForNextPaint();
    try {
      handleBewerk(item);
    } finally {
      setOpeningRowKey(null);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setNaam('');
    setMailZakelijk('');
    setTelefoonZakelijk('');
    setDatumInDienst('');
    setDatumUitDienst('');
    setVerlofurenPerJaar('');
    setPercentageWbso('');
    setMaandag(true);
    setDinsdag(true);
    setWoensdag(true);
    setDonderdag(true);
    setVrijdag(true);
    setWerkurenPerWeek('');
    setFormError('');
  };

  const handleBewerkVerlof = async (item: VerlofUur) => {
    await ensurePersoneelLoaded();
    setVerlofEditingId(item.id);
    setVerlofMedewerker(item.medewerkerId || item.medewerker || '');
    setVerlofDatum(item.datum || '');
    setVerlofOmschrijving(item.omschrijving || '');
    setVerlofAantalUur(item.aantalUur || '');
    setVerlofModalOpen(true);
  };


  const handleOpenVerlofFromGrid = async (item: VerlofUur) => {
    setOpeningRowKey(`verlof-${item.id}`);
    await waitForNextPaint();
    try {
      await handleBewerkVerlof(item);
    } finally {
      setOpeningRowKey(null);
    }
  };

  const closeVerlofModal = () => {
    setVerlofModalOpen(false);
    setVerlofEditingId(null);
    setVerlofMedewerker('');
    setVerlofDatum('');
    setVerlofOmschrijving('');
    setVerlofAantalUur('');
    setVerlofFormError('');
  };

  const loadPersoneel = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchNinoxPersoneel();
      setItems(data);
    } catch (err) {
      setItems([]);
      setError(err instanceof Error ? err.message : 'Onbekende fout');
    } finally {
      setLoading(false);
    }
  };

  const loadVerlofuren = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchNinoxVerlofuren();
      setVerlofItems(data);
    } catch (err) {
      setVerlofItems([]);
      setError(err instanceof Error ? err.message : 'Onbekende fout');
    } finally {
      setLoading(false);
    }
  };

  const loadMailTemplates = async () => {
    try {
      const data = await fetchNinoxMailTemplates();
      setMailTemplates(data);
    } catch (err) {
      console.error('Mailtemplates laden mislukt:', err);
    }
  };

  const ensurePersoneelLoaded = async () => {
    if (items.length > 0) {
      return;
    }
    await loadPersoneel();
  };

  const handleSaveVerlof = async () => {
    const selectedPersoneel =
      personeelOpties.find((option) => option.value === verlofMedewerker) ||
      personeelOpties.find((option) => option.label === verlofMedewerker) ||
      null;

    if (!selectedPersoneel) {
      setVerlofFormError('Medewerker is verplicht.');
      return;
    }
    if (!verlofDatum.trim()) {
      setVerlofFormError('Datum is verplicht.');
      return;
    }

    setVerlofSaving(true);
    setVerlofFormError('');
    try {
      const payload = {
        medewerkerId: selectedPersoneel.value,
        medewerkerNaam: selectedPersoneel.label,
        datum: verlofDatum,
        omschrijving: verlofOmschrijving,
        aantalUur: verlofAantalUur,
      };
      if (verlofEditingId) {
        await updateNinoxVerlofuur(verlofEditingId, payload);
      } else {
        await createNinoxVerlofuur(payload);
      }
      await loadVerlofuren();
      closeVerlofModal();
    } catch (err) {
      setVerlofFormError(err instanceof Error ? err.message : 'Opslaan mislukt.');
    } finally {
      setVerlofSaving(false);
    }
  };

  const bevestigVervallenPersoneel = async () => {
    if (!personeelVoorVervallen) {
      return;
    }
    setDeletingId(personeelVoorVervallen.id);
    try {
      await deleteNinoxPersoneel(personeelVoorVervallen.id);
      setPersoneelVoorVervallen(null);
      closeModal();
      await loadPersoneel();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Vervallen mislukt.');
    } finally {
      setDeletingId(null);
    }
  };

  const bevestigVervallenVerlof = async () => {
    if (!verlofVoorVervallen) {
      return;
    }
    setDeletingId(verlofVoorVervallen.id);
    try {
      await deleteNinoxVerlofuur(verlofVoorVervallen.id);
      setVerlofVoorVervallen(null);
      closeVerlofModal();
      await loadVerlofuren();
    } catch (err) {
      setVerlofFormError(err instanceof Error ? err.message : 'Vervallen mislukt.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSave = async () => {
    if (!editingId) {
      setFormError('Interne fout: record ontbreekt.');
      return;
    }
    if (!naam.trim()) {
      setFormError('Naam is verplicht.');
      setFormTab('Algemeen');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      await updateNinoxPersoneel(editingId, {
        naam,
        mailZakelijk,
        telefoonZakelijk,
        startdatum: datumInDienst,
        einddatum: datumUitDienst,
        werkurenPerWeek,
        verlofurenPerJaar,
        percentageWbso,
        maandag,
        dinsdag,
        woensdag,
        donderdag,
        vrijdag,
      });
      await loadPersoneel();
      closeModal();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Bijwerken mislukt.');
    } finally {
      setSaving(false);
    }
  };

  const openTab = (nextTab: PersoneelTab) => {
    setSearchParams({ tab: nextTab });
  };

  const clearSalarisRows = () => {
    setSalarisRows((current) => {
      current.forEach((row) => URL.revokeObjectURL(row.pdfUrl));
      return [];
    });
  };

  const processSalarisRapportFile = async (file: File, directoryHandle: FileSystemDirectoryHandleLike | null) => {
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      setSalarisRapportError('Kies een PDF-bestand.');
      setSalarisRapportResult('');
      return;
    }

    if (items.length === 0) {
      setSalarisRapportError('Geen medewerkers gevonden in tabel Personeel.');
      setSalarisRapportResult('');
      return;
    }

    setSalarisRapportSaving(true);
    setSalarisRapportError('');
    setSalarisRapportResult('');
    setSalarisRapportFileName(file.name);
    clearSalarisRows();

    try {
      const pdfBytes = await file.arrayBuffer();
      const pageTexts = await extractPdfPageTexts(pdfBytes);
      const pageMatches = matchPdfPagesToPersoneel(
        pageTexts,
        items.map((item) => item.naam).filter(Boolean)
      );
      if (pageMatches.length === 0) {
        throw new Error('Geen pagina\'s gevonden voor medewerkers uit tabel Personeel. Herkenning zoekt ook op varianten zoals initialen plus achternaam.');
      }
      const pageNumbersByPersoneel = new Map<string, number[]>();
      for (const match of pageMatches) {
        const current = pageNumbersByPersoneel.get(match.personeelNaam) || [];
        current.push(match.pageNumber);
        pageNumbersByPersoneel.set(match.personeelNaam, current);
      }

      const nextRows: SalarisPdfRow[] = [];
      for (const [personeelNaam, pageNumbers] of pageNumbersByPersoneel.entries()) {
        const personeelRecord = items.find((item) => item.naam === personeelNaam);
        const document = await createPdfDocumentForPages(pdfBytes, file.name, pageNumbers, personeelNaam);
        if (!personeelRecord || !document) {
          continue;
        }

        if (directoryHandle) {
          const nextFileHandle = await directoryHandle.getFileHandle(document.fileName, { create: true });
          const writable = await nextFileHandle.createWritable();
          const copiedBytes = new Uint8Array(document.bytes.byteLength);
          copiedBytes.set(document.bytes);
          const pageBuffer = copiedBytes.buffer as ArrayBuffer;
          await writable.write(new Blob([pageBuffer], { type: 'application/pdf' }));
          await writable.close();
        }

        const copiedBytes = new Uint8Array(document.bytes.byteLength);
        copiedBytes.set(document.bytes);
        const pdfUrl = URL.createObjectURL(new Blob([copiedBytes.buffer as ArrayBuffer], { type: 'application/pdf' }));
        nextRows.push({
          naam: personeelRecord.naam,
          roepnaam: personeelRecord.roepnaam || personeelRecord.naam,
          mailZakelijk: personeelRecord.mailZakelijk || '',
          pdfBestandsnaam: document.fileName,
          pageNumbers: document.pageNumbers,
          pdfUrl,
          pdfBytes: copiedBytes,
        });
      }

      nextRows.sort((a, b) => a.naam.localeCompare(b.naam, 'nl', { sensitivity: 'base', numeric: true }));
      setSalarisRows(nextRows);
      setSalarisRapportResult(
        `${nextRows.length} medewerker(s) herkend en gevuld in het overzicht onder de knop.`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Rapportenset inlezen mislukt.';
      if (message.toLowerCase().includes('abort')) {
        return;
      }
      setSalarisRapportError(message || 'Rapportenset inlezen mislukt.');
      setSalarisRapportResult('');
    } finally {
      setSalarisRapportSaving(false);
    }
  };

  const handleInlezenRapportenset = async () => {
    const pickerWindow = window as FilePickerWindow;
    if (!pickerWindow.showOpenFilePicker || !pickerWindow.showDirectoryPicker) {
      salarisRapportInputRef.current?.click();
      return;
    }

    try {
      const [fileHandle] = await pickerWindow.showOpenFilePicker({
        multiple: false,
        excludeAcceptAllOption: true,
        types: [
          {
            description: 'PDF bestanden',
            accept: {
              'application/pdf': ['.pdf'],
            },
          },
        ],
      });

      if (!fileHandle) {
        return;
      }

      const file = await fileHandle.getFile();
      const directoryHandle = await pickerWindow.showDirectoryPicker({
        id: 'salarissen-rapportenset-map',
        mode: 'readwrite',
        startIn: fileHandle,
      });
      await processSalarisRapportFile(file, directoryHandle);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Rapportenset inlezen mislukt.';
      if (message.toLowerCase().includes('abort')) {
        return;
      }
      setSalarisRapportError(message || 'Rapportenset inlezen mislukt.');
      setSalarisRapportResult('');
    }
  };

  const tabButtonClass = (tabName: PersoneelTab) =>
    `w-full text-left rounded-lg border px-4 py-3 transition-colors ${
      activeTab === tabName
        ? 'border-dc-blue-500 bg-dc-blue-50'
        : 'border-dc-gray-100 hover:border-dc-blue-200 hover:bg-dc-blue-50/40'
    }`;

  useEffect(() => {
    if (activeTab === 'algemeen') {
      void loadPersoneel();
      return;
    }
    if (activeTab === 'verlofuren') {
      void loadVerlofuren();
      return;
    }
    if (activeTab === 'salarissen') {
      void ensurePersoneelLoaded();
      void loadMailTemplates();
    }
  }, [activeTab]);

  useEffect(() => {
    return () => {
      salarisRows.forEach((row) => URL.revokeObjectURL(row.pdfUrl));
    };
  }, [salarisRows]);

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      if (sort.key === 'naam') {
        return compareStrings(a.naam || '', b.naam || '', sort.direction);
      }
      if (sort.key === 'mailZakelijk') {
        return compareStrings(a.mailZakelijk || '', b.mailZakelijk || '', sort.direction);
      }
      if (sort.key === 'telefoonZakelijk') {
        return compareStrings(a.telefoonZakelijk || '', b.telefoonZakelijk || '', sort.direction);
      }
      if (sort.key === 'percentageWbso') {
        return compareStrings(a.percentageWbso || '', b.percentageWbso || '', sort.direction);
      }
      return compareStrings(a.werkurenPerWeek || '', b.werkurenPerWeek || '', sort.direction);
    });
  }, [items, sort]);

  const filteredItems = useMemo(() => {
    const terms = parseSearchTerms(zoek);
    if (terms.length === 0) {
      return sortedItems;
    }
    return sortedItems.filter((item) =>
      matchesAllTerms(
        `${item.naam || ''} ${item.mailZakelijk || ''} ${item.telefoonZakelijk || ''} ${item.werkurenPerWeek || ''} ${item.percentageWbso || ''}`,
        terms
      )
    );
  }, [sortedItems, zoek]);

  const sortedVerlofItems = useMemo(() => {
    const extractSortableDate = (datum: string): number => {
      const raw = String(datum || '').trim();
      const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (iso) {
        return Number(`${iso[1]}${iso[2]}${iso[3]}`);
      }
      const nl = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (nl) {
        return Number(`${nl[3]}${nl[2]}${nl[1]}`);
      }
      return 0;
    };

    return [...verlofItems].sort((a, b) => {
      const medewerkerCompare = compareStrings(a.medewerker || '', b.medewerker || '', 'asc');
      if (medewerkerCompare !== 0) {
        return medewerkerCompare;
      }

      const dateCompare = extractSortableDate(b.datum || '') - extractSortableDate(a.datum || '');
      if (dateCompare !== 0) {
        return dateCompare;
      }

      const omschrijvingCompare = compareStrings(a.omschrijving || '', b.omschrijving || '', 'asc');
      if (omschrijvingCompare !== 0) {
        return omschrijvingCompare;
      }

      return compareStrings(a.aantalUur || '', b.aantalUur || '', 'asc');
    });
  }, [verlofItems]);

  const filteredVerlofItems = useMemo(() => {
    const terms = parseSearchTerms(verlofZoek);
    if (terms.length === 0) {
      return sortedVerlofItems;
    }
    return sortedVerlofItems.filter((item) =>
      matchesAllTerms(`${item.medewerker || ''} ${item.datum || ''} ${item.omschrijving || ''} ${item.aantalUur || ''}`, terms)
    );
  }, [sortedVerlofItems, verlofZoek]);

  const personeelOpties = useMemo(
    () =>
      items.map((item) => ({
        value: String(item.id),
        label: item.naam || `Personeel ${item.id}`,
        subtitle: item.mailZakelijk || item.telefoonZakelijk || undefined,
        searchText: `${item.naam || ''} ${item.mailZakelijk || ''} ${item.telefoonZakelijk || ''}`,
      })),
    [items]
  );

  const groupedVerlofItems = useMemo(() => {
    const extractYear = (datum: string): string => {
      const raw = String(datum || '').trim();
      const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (iso) {
        return iso[1];
      }
      const nl = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (nl) {
        return nl[3];
      }
      return 'Onbekend';
    };

    const groups = new Map<string, { key: string; medewerker: string; jaar: string; totaal: string; items: VerlofUur[] }>();
    for (const item of filteredVerlofItems) {
      const medewerker = item.medewerker || 'Onbekend';
      const jaar = extractYear(item.datum);
      const key = `${medewerker}__${jaar}`;
      const existing = groups.get(key);
      if (existing) {
        existing.items.push(item);
        continue;
      }
      groups.set(key, {
        key,
        medewerker,
        jaar,
        totaal: '0,00',
        items: [item],
      });
    }

    return Array.from(groups.values())
      .map((group) => {
        const totaal = group.items.reduce((sum, item) => sum + (parseDutchNumber(item.aantalUur || '') || 0), 0);
        return {
          ...group,
          totaal: formatDutchNumber(totaal, 2),
        };
      })
      .sort((a, b) => {
        const medewerkerCompare = a.medewerker.localeCompare(b.medewerker, 'nl', { sensitivity: 'base', numeric: true });
        if (medewerkerCompare !== 0) {
          return medewerkerCompare;
        }
        if (a.jaar === 'Onbekend' && b.jaar !== 'Onbekend') {
          return 1;
        }
        if (a.jaar !== 'Onbekend' && b.jaar === 'Onbekend') {
          return -1;
        }
        return b.jaar.localeCompare(a.jaar, 'nl', { sensitivity: 'base', numeric: true });
      });
  }, [filteredVerlofItems]);

  const hasVerlofSearch = parseSearchTerms(verlofZoek).length > 0;
  const filteredSalarisRows = useMemo(() => {
    const terms = parseSearchTerms(salarisZoek);
    if (terms.length === 0) {
      return salarisRows;
    }
    return salarisRows.filter((row) =>
      matchesAllTerms(`${row.naam} ${row.mailZakelijk} ${row.pdfBestandsnaam} ${row.pageNumbers.join(' ')}`, terms)
    );
  }, [salarisRows, salarisZoek]);

  const handleOpenSalarisMail = async (row: SalarisPdfRow) => {
    setOpeningRowKey(`salaris-${row.naam}`);
    await waitForNextPaint();
    try {
      if (!row.mailZakelijk.trim()) {
        setSalarisRapportError(`Geen Mail zakelijk gevonden voor ${row.naam}.`);
        return;
      }
      setSalarisMailError('');
      setSalarisMailProgressCurrent(0);
      setSalarisMailProgressTotal(0);
      setSalarisMailRow(row);
    } finally {
      setOpeningRowKey(null);
    }
  };

  const closeSalarisMail = () => {
    setSalarisMailRow(null);
    setSalarisMailError('');
    setSalarisMailSending(false);
    setSalarisMailProgressCurrent(0);
    setSalarisMailProgressTotal(0);
  };

  const salarisMailConfig = useMemo<MailFormulierConfig | null>(() => {
    if (!salarisMailRow) {
      return null;
    }

    const gebruikerNaam = user?.naam?.trim() || 'Planning';
    const gebruikerFunctie = user?.functie?.trim() || '';
    const ontvanger = {
      id: salarisMailRow.naam,
      email: salarisMailRow.mailZakelijk.trim(),
      naam: salarisMailRow.naam,
      selected: true,
      mergeFields: {
        Naam: salarisMailRow.naam,
        roepnaam: salarisMailRow.roepnaam,
        Roepnaam: salarisMailRow.roepnaam,
        Gebruikersnaam: gebruikerNaam,
        gebruikersnaam: gebruikerNaam,
        Functie: gebruikerFunctie,
      },
    };

    return {
      titel: `Mailen Salaris - ${salarisMailRow.naam}`,
      actorKey: 'salarissen',
      draftKey: `salarissen-${salarisMailRow.naam}`,
      ontvangers: [ontvanger],
      showOntvangerSelectie: false,
      defaultOnderwerp: `Salarisstrook ${salarisMailRow.naam}`,
      defaultInhoud: `Beste {Naam},\n\nIn de bijlage vind je jouw salaris-PDF.\n\nMet vriendelijke groet,\n{Gebruikersnaam}`,
      editorType: 'richtext',
      templates: mailTemplates,
      mergeFieldsPreview: {
        Naam: salarisMailRow.naam,
        roepnaam: salarisMailRow.roepnaam || '{roepnaam}',
        Roepnaam: salarisMailRow.roepnaam || '{Roepnaam}',
        bedrijfsnaam: '{bedrijfsnaam}',
        'logo-mail': '{logo-mail}',
        Gebruikersnaam: gebruikerNaam,
        gebruikersnaam: gebruikerNaam,
        Functie: gebruikerFunctie || '{Functie}',
      },
      hiddenMergeFields: ['gebruikersnaam'],
      pdfConfig: {
        allowUpload: true,
        maxFiles: 2,
        label: 'PDF bijlage',
        initialAttachments: [
          {
            file: new File([new Blob([salarisMailRow.pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' })], salarisMailRow.pdfBestandsnaam, {
              type: 'application/pdf',
            }),
          },
        ],
      },
      onVerzenden: async (data) => {
        setSalarisMailSending(true);
        setSalarisMailError('');
        setSalarisRapportError('');
        setSalarisRapportResult('');
        setSalarisMailProgressTotal(data.geselecteerdeOntvangers.length);
        setSalarisMailProgressCurrent(0);

        try {
          const response = await fetchApi('/azure-mail-send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({
              subjectTemplate: data.onderwerp,
              plainBodyTemplate: data.plainInhoud,
              htmlBodyTemplate: data.htmlPart,
              attachments: data.attachments,
              userContext: {
                Naam: user?.naam?.trim() || '',
                Gebruikersnaam: gebruikerNaam,
                gebruikersnaam: gebruikerNaam,
                Functie: gebruikerFunctie,
                Email: user?.email?.trim() || '',
                'E-mail': user?.email?.trim() || '',
              },
              ontvangers: data.geselecteerdeOntvangers.map((item) => ({
                email: item.email.trim(),
                naam: item.naam,
                mergeFields: {
                  ...(item.mergeFields || {}),
                  Naam: item.naam,
                  roepnaam: item.mergeFields?.roepnaam || '',
                  Roepnaam: item.mergeFields?.Roepnaam || item.mergeFields?.roepnaam || '',
                  Gebruikersnaam: gebruikerNaam,
                  gebruikersnaam: gebruikerNaam,
                  Functie: gebruikerFunctie,
                },
              })),
            }),
          });

          const payload = await response.json().catch(() => ({}));
          if (!response.ok) {
            const message = typeof payload?.message === 'string' ? payload.message : 'Azure mail verzenden mislukt.';
            throw new Error(message);
          }

          const sentCount = typeof payload?.sentCount === 'number' ? payload.sentCount : data.geselecteerdeOntvangers.length;
          setSalarisMailProgressCurrent(sentCount);
          setSalarisRows((current) => {
            const rowToRemove = salarisMailRow;
            if (!rowToRemove) {
              return current;
            }
            const nextRows = current.filter(
              (row) => !(row.naam === rowToRemove.naam && row.pdfBestandsnaam === rowToRemove.pdfBestandsnaam)
            );
            if (nextRows.length !== current.length) {
              URL.revokeObjectURL(rowToRemove.pdfUrl);
            }
            return nextRows;
          });
          setSalarisRapportResult(`Mail met PDF verzonden naar ${salarisMailRow.naam} (${salarisMailRow.mailZakelijk}).`);
        } catch (mailError) {
          const message = mailError instanceof Error ? mailError.message : 'Azure mail verzenden mislukt.';
          setSalarisMailError(message);
          throw mailError instanceof Error ? mailError : new Error(message);
        } finally {
          setSalarisMailSending(false);
        }
      },
      onCancel: closeSalarisMail,
    };
  }, [mailTemplates, salarisMailRow, user?.email, user?.functie, user?.naam]);

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <User size={24} className="text-dc-blue-500" />
          <h1 className="text-2xl font-semibold text-dc-gray-500">Personeel</h1>
        </div>
        <p className="text-sm text-dc-gray-400">
          {activeTab === 'algemeen'
            ? `Personeelsgegevens (${items.length} records)`
            : activeTab === 'verlofuren'
              ? `Verlofuren (${verlofItems.length} records)`
              : 'Salarissen'}
        </p>
      </div>

      <MailFormulier
        open={Boolean(salarisMailConfig)}
        config={
          salarisMailConfig || {
            titel: '',
            actorKey: 'salarissen',
            ontvangers: [],
            editorType: 'richtext',
            mergeFieldsPreview: {},
            onVerzenden: async () => {},
            onCancel: () => {},
          }
        }
        sending={salarisMailSending}
        progressCurrent={salarisMailProgressCurrent}
        progressTotal={salarisMailProgressTotal}
        error={salarisMailError}
      />

      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-dc-gray-100 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button type="button" onClick={() => openTab('algemeen')} className={tabButtonClass('algemeen')}>
              <div className="flex items-center gap-2">
                <User size={18} className="text-dc-blue-500" />
                <span className="text-sm font-semibold text-dc-gray-500">Algemeen</span>
              </div>
            </button>
            <button type="button" onClick={() => openTab('verlofuren')} className={tabButtonClass('verlofuren')}>
              <div className="flex items-center gap-2">
                <User size={18} className="text-dc-blue-500" />
                <span className="text-sm font-semibold text-dc-gray-500">Verlofuren</span>
              </div>
            </button>
            <button type="button" onClick={() => openTab('salarissen')} className={tabButtonClass('salarissen')}>
              <div className="flex items-center gap-2">
                <Banknote size={18} className="text-dc-blue-500" />
                <span className="text-sm font-semibold text-dc-gray-500">Salarissen</span>
              </div>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-dc-gray-100 p-6">
          {activeTab === 'algemeen' && (
            <>
              <div className="mb-4 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => void handleNieuw()}
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

              <LoadingSpinner active={loading} message="Personeel laden uit Ninox..." />

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
                        label="Mail zakelijk"
                        active={sort.key === 'mailZakelijk'}
                        direction={sort.direction}
                        onClick={() => setSort((current) => nextSortState(current, 'mailZakelijk'))}
                        className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
                      />
                      <SortableTh
                        label="Telefoon zakelijk"
                        active={sort.key === 'telefoonZakelijk'}
                        direction={sort.direction}
                        onClick={() => setSort((current) => nextSortState(current, 'telefoonZakelijk'))}
                        className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
                      />
                      <SortableTh
                        label="Werkuren per week"
                        active={sort.key === 'werkurenPerWeek'}
                        direction={sort.direction}
                        onClick={() => setSort((current) => nextSortState(current, 'werkurenPerWeek'))}
                        className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
                      />
                      <SortableTh
                        label="Percentage WBSO"
                        active={sort.key === 'percentageWbso'}
                        direction={sort.direction}
                        onClick={() => setSort((current) => nextSortState(current, 'percentageWbso'))}
                        className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => (
                      <tr key={item.id} className="dc-zebra-row dc-clickable-row" onClick={() => void handleOpenPersoneelFromGrid(item)}>
                        <td className="px-5 py-3 text-dc-gray-500"><span className="inline-flex items-center gap-2"><span className="inline-flex w-4 h-4 items-center justify-center shrink-0">{openingRowKey === `personeel-${item.id}` && <Loader2 className="w-4 h-4 text-dc-blue-500 animate-spin" />}</span>{item.naam || '-'}</span></td>
                        <td className="px-5 py-3 text-dc-gray-500">{item.mailZakelijk || '-'}</td>
                        <td className="px-5 py-3 text-dc-gray-500">{item.telefoonZakelijk || '-'}</td>
                        <td className="px-5 py-3 text-dc-gray-500 text-right">{item.werkurenPerWeek || '-'}</td>
                        <td className="px-5 py-3 text-dc-gray-500 text-right">{item.percentageWbso || '-'}</td>
                      </tr>
                    ))}
                    {!loading && filteredItems.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-5 py-8 text-center text-dc-gray-300 text-sm">
                          Geen personeel gevonden
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {activeTab === 'verlofuren' && (
            <>
              <div className="mb-4 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => void handleNieuw()}
                  className="px-4 py-2 rounded-lg bg-dc-blue-500 text-white text-sm font-medium hover:bg-dc-blue-600"
                >
                  Nieuw
                </button>
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dc-gray-300" />
                  <input
                    type="text"
                    value={verlofZoek}
                    onChange={(e) => setVerlofZoek(e.target.value)}
                    placeholder="Zoeken op alle kolommen, meerdere kolommen zoeken mogelijk door je zoekwoorden met een , te scheiden..."
                    className="w-full pl-9 pr-4 py-2 bg-white border border-dc-gray-100 rounded-lg text-sm text-dc-gray-500 placeholder:text-dc-gray-300 focus:outline-none focus:ring-2 focus:ring-dc-blue-500/30 focus:border-dc-blue-500"
                  />
                </div>
              </div>

              <LoadingSpinner active={loading} message="Verlofuren laden uit Ninox..." />

              {error && (
                <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  Ninox laden mislukt: {error}
                </div>
              )}

              <div className="bg-white rounded-xl border border-dc-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-dc-gray-100">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase">Medewerker</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase">Jaar / datum</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase">Omschrijving</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase">Aantal uur</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedVerlofItems.map((group) => {
                      const isOpen = hasVerlofSearch || Boolean(openVerlofGroups[group.key]);
                      return (
                        <Fragment key={group.key}>
                          <tr className="border-b border-dc-gray-100 bg-dc-gray-50/70">
                            <td className="px-5 py-3 text-dc-gray-500 font-semibold">
                              <button
                                type="button"
                                onClick={() => setOpenVerlofGroups((current) => ({ ...current, [group.key]: !Boolean(current[group.key]) }))}
                                className="inline-flex items-center gap-2 text-left hover:text-dc-blue-500"
                              >
                                {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                <span>{group.medewerker}</span>
                              </button>
                            </td>
                            <td className="px-5 py-3 text-dc-gray-500 font-semibold">{group.jaar}</td>
                            <td className="px-5 py-3 text-dc-gray-400">Totaal verlofuren</td>
                            <td className="px-5 py-3 text-dc-gray-500 text-right font-semibold">{group.totaal}</td>
                          </tr>
                          {isOpen &&
                            group.items.map((item) => (
                              <tr key={item.id} className="dc-zebra-row dc-clickable-row" onClick={() => void handleOpenVerlofFromGrid(item)}>
                                <td className="px-5 py-3 text-dc-gray-400 pl-12"><span className="inline-flex items-center gap-2"><span className="inline-flex w-4 h-4 items-center justify-center shrink-0">{openingRowKey === `verlof-${item.id}` && <Loader2 className="w-4 h-4 text-dc-blue-500 animate-spin" />}</span>{item.medewerker || '-'}</span></td>
                                <td className="px-5 py-3 text-dc-gray-500">{item.datum || '-'}</td>
                                <td className="px-5 py-3 text-dc-gray-500">{item.omschrijving || '-'}</td>
                                <td className="px-5 py-3 text-dc-gray-500 text-right">{item.aantalUur || '-'}</td>
                              </tr>
                            ))}
                        </Fragment>
                      );
                    })}
                    {!loading && groupedVerlofItems.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-5 py-8 text-center text-dc-gray-300 text-sm">
                          Geen verlofuren gevonden
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {activeTab === 'salarissen' && (
            <>
              <input
                ref={salarisRapportInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  if (file) {
                    void processSalarisRapportFile(file, null);
                  }
                  event.currentTarget.value = '';
                }}
              />

              <div className="mb-4 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => void handleInlezenRapportenset()}
                  disabled={salarisRapportSaving || personeelOpties.length === 0}
                  className="px-4 py-2 rounded-lg bg-yellow-400 text-dc-gray-700 text-sm font-medium hover:bg-yellow-500 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {salarisRapportSaving && <Loader2 className="inline w-4 h-4 mr-2 animate-spin" />}
                  {salarisRapportSaving ? 'Bezig...' : 'Inlezen rapportenset'}
                </button>
              </div>

              {salarisRapportError && (
                <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {salarisRapportError}
                </div>
              )}

              <div className="bg-white rounded-xl border border-dc-gray-100 p-6">
                <div className="flex items-center gap-2 mb-2">
                  <Banknote size={18} className="text-dc-blue-500" />
                  <h2 className="text-lg font-semibold text-dc-gray-500">Salarissen</h2>
                </div>
                <p className="text-sm text-dc-gray-400">
                  Deze tab is aangemaakt en klaar voor verdere invulling van het salarisscherm.
                </p>
                <p className="mt-3 text-sm text-dc-gray-500">
                  Medewerkers uit tabel Personeel worden automatisch herkend op basis van naam en initialen + achternaam.
                </p>
                <p className="mt-3 text-sm text-dc-gray-500">
                  {salarisRapportFileName ? `Gekozen PDF: ${salarisRapportFileName}` : 'Nog geen PDF gekozen.'}
                </p>
                {salarisRapportResult && (
                  <p className="mt-2 text-sm text-dc-gray-500">{salarisRapportResult}</p>
                )}
              </div>

              <div className="mt-4">
                <div className="mb-4 flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dc-gray-300" />
                    <input
                      type="text"
                      value={salarisZoek}
                      onChange={(e) => setSalarisZoek(e.target.value)}
                      placeholder="Zoeken op alle kolommen, meerdere kolommen zoeken mogelijk door je zoekwoorden met een , te scheiden..."
                      className="w-full pl-9 pr-4 py-2 bg-white border border-dc-gray-100 rounded-lg text-sm text-dc-gray-500 placeholder:text-dc-gray-300 focus:outline-none focus:ring-2 focus:ring-dc-blue-500/30 focus:border-dc-blue-500"
                    />
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-dc-gray-100 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-dc-gray-100">
                        <th className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase">Naam</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase">Mail zakelijk</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase">PDF</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase">Pagina's</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSalarisRows.map((row) => (
                        <tr
                          key={row.pdfBestandsnaam}
                          className="dc-zebra-row dc-clickable-row"
                          onClick={() => void handleOpenSalarisMail(row)}
                        >
                          <td className="px-5 py-3 text-dc-gray-500">
                            <span className="inline-flex items-center gap-2">
                              <span className="inline-flex w-4 h-4 items-center justify-center shrink-0">
                                {openingRowKey === `salaris-${row.naam}` && <Loader2 className="w-4 h-4 text-dc-blue-500 animate-spin" />}
                              </span>
                              {row.naam || '-'}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-dc-gray-500">{row.mailZakelijk || '-'}</td>
                          <td className="px-5 py-3 text-dc-gray-500">
                            <a
                              href={row.pdfUrl}
                              download={row.pdfBestandsnaam}
                              onClick={(event) => event.stopPropagation()}
                              className="text-dc-blue-500 hover:underline"
                            >
                              {row.pdfBestandsnaam}
                            </a>
                          </td>
                          <td className="px-5 py-3 text-dc-gray-500">{row.pageNumbers.join(', ')}</td>
                        </tr>
                      ))}
                      {!salarisRapportSaving && filteredSalarisRows.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-5 py-8 text-center text-dc-gray-300 text-sm">
                            Nog geen gesplitste salaris-PDF's beschikbaar
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {verlofModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[calc(100vh-2rem)] bg-white rounded-xl border border-dc-gray-100 overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-dc-blue-500">
              <h2 className="text-lg font-semibold text-dc-gray-500">Verlof bewerken</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-6 min-h-[28rem]">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-dc-gray-400 mb-1">Medewerker</label>
                  <ComboBox
                    value={verlofMedewerker}
                    onChange={setVerlofMedewerker}
                    options={personeelOpties}
                    placeholder="Medewerker"
                    searchPlaceholder="Zoek medewerker..."
                    emptyText="Geen medewerkers gevonden"
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-xs font-medium text-dc-gray-400 mb-1">Datum</label>
                  <DateFieldInput
                    value={verlofDatum}
                    onChange={setVerlofDatum}
                    placeholder="dd/mm/yyyy"
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-xs font-medium text-dc-gray-400 mb-1">Aantal uur</label>
                  <NumericFieldInput value={verlofAantalUur} onChange={setVerlofAantalUur} fractionDigits={2} placeholder="Aantal uur" />
                </div>
                <div className="md:col-span-4">
                  <label className="block text-xs font-medium text-dc-gray-400 mb-1">Omschrijving</label>
                  <input
                    value={verlofOmschrijving}
                    onChange={(e) => setVerlofOmschrijving(e.target.value)}
                    placeholder="Omschrijving"
                    className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500"
                  />
                </div>
              </div>

              {verlofFormError && (
                <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {verlofFormError}
                </div>
              )}
            </div>

            <div className="border-t border-dc-blue-500 px-6 py-4 flex items-center justify-between gap-2">
              {verlofEditingId && (
                <button
                  type="button"
                  onClick={() => {
                    const currentItem = verlofItems.find((entry) => entry.id === verlofEditingId);
                    if (currentItem) {
                      setVerlofVoorVervallen(currentItem);
                    }
                  }}
                  disabled={Boolean(verlofVoorVervallen && deletingId === verlofVoorVervallen.id)}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors dc-grid-delete-btn disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {verlofVoorVervallen && deletingId === verlofVoorVervallen.id ? 'Bezig...' : 'Vervallen'}
                </button>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeVerlofModal}
                  className="px-4 py-2 rounded-lg border border-dc-gray-200 text-sm text-dc-gray-500 hover:bg-dc-gray-50"
                >
                  Annuleren
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveVerlof()}
                  disabled={verlofSaving}
                  className="px-4 py-2 rounded-lg bg-dc-blue-500 text-white text-sm font-medium hover:bg-dc-blue-600 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {verlofSaving && <Loader2 className="inline w-4 h-4 mr-2 animate-spin" />}
                  {verlofSaving ? (verlofEditingId ? 'Bijwerken...' : 'Opslaan...') : (verlofEditingId ? 'Bijwerken' : 'Opslaan')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-5xl max-h-[calc(100vh-2rem)] bg-white rounded-xl border border-dc-gray-100 overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-dc-blue-500">
              <h2 className="text-lg font-semibold text-dc-gray-500">Personeel bewerken</h2>
            </div>

            <div className="flex border-b border-dc-gray-200">
              <button
                type="button"
                onClick={() => setFormTab('Algemeen')}
                className={
                  formTab === 'Algemeen'
                    ? 'px-4 py-2 text-sm font-medium text-dc-blue-500 border-b-2 border-dc-blue-500'
                    : 'px-4 py-2 text-sm font-medium text-dc-gray-400 hover:text-dc-gray-500'
                }
              >
                Algemeen
              </button>
              <button
                type="button"
                onClick={() => setFormTab('WBSO')}
                className={
                  formTab === 'WBSO'
                    ? 'px-4 py-2 text-sm font-medium text-dc-blue-500 border-b-2 border-dc-blue-500'
                    : 'px-4 py-2 text-sm font-medium text-dc-gray-400 hover:text-dc-gray-500'
                }
              >
                WBSO
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {formTab === 'Algemeen' && (
                <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
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
                    <label className="block text-xs font-medium text-dc-gray-400 mb-1">Mail zakelijk</label>
                    <input
                      value={mailZakelijk}
                      onChange={(e) => setMailZakelijk(e.target.value)}
                      placeholder="Mail zakelijk"
                      className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-dc-gray-400 mb-1">Telefoon zakelijk</label>
                    <input
                      value={telefoonZakelijk}
                      onChange={(e) => setTelefoonZakelijk(e.target.value)}
                      placeholder="Telefoon zakelijk"
                      className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-dc-gray-400 mb-1">Datum in dienst</label>
                    <DateFieldInput value={datumInDienst} onChange={setDatumInDienst} placeholder="dd/mm/yyyy" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-dc-gray-400 mb-1">Datum uit dienst</label>
                    <DateFieldInput value={datumUitDienst} onChange={setDatumUitDienst} placeholder="dd/mm/yyyy" />
                  </div>
                </div>
              )}

              {formTab === 'WBSO' && (
                <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                  <div className="md:col-span-1">
                    <label className="block text-xs font-medium text-dc-gray-400 mb-1">Werkuren per week</label>
                    <NumericFieldInput value={werkurenPerWeek} onChange={setWerkurenPerWeek} fractionDigits={2} placeholder="Werkuren per week" />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-xs font-medium text-dc-gray-400 mb-1">Percentage WBSO</label>
                    <NumericFieldInput value={percentageWbso} onChange={setPercentageWbso} fractionDigits={0} placeholder="Percentage WBSO" />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-xs font-medium text-dc-gray-400 mb-1">Verlofuren per jaar</label>
                    <NumericFieldInput value={verlofurenPerJaar} onChange={setVerlofurenPerJaar} fractionDigits={2} placeholder="Verlofuren per jaar" />
                  </div>
                  <div className="col-span-1 md:col-span-6 border-t border-red-500 my-1" />
                  <div className="md:col-span-1">
                    <label className="block text-xs font-medium text-dc-gray-400 mb-1">Maandag</label>
                    <YesNoSlicer value={maandag} onChange={setMaandag} disabled={saving} />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-xs font-medium text-dc-gray-400 mb-1">Dinsdag</label>
                    <YesNoSlicer value={dinsdag} onChange={setDinsdag} disabled={saving} />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-xs font-medium text-dc-gray-400 mb-1">Woensdag</label>
                    <YesNoSlicer value={woensdag} onChange={setWoensdag} disabled={saving} />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-xs font-medium text-dc-gray-400 mb-1">Donderdag</label>
                    <YesNoSlicer value={donderdag} onChange={setDonderdag} disabled={saving} />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-xs font-medium text-dc-gray-400 mb-1">Vrijdag</label>
                    <YesNoSlicer value={vrijdag} onChange={setVrijdag} disabled={saving} />
                  </div>
                </div>
              )}

              {formError && (
                <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {formError}
                </div>
              )}
            </div>

            <div className="border-t border-dc-blue-500 px-6 py-4 flex items-center justify-between gap-2">
              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    const currentItem = items.find((entry) => entry.id === editingId);
                    if (currentItem) {
                      setPersoneelVoorVervallen(currentItem);
                    }
                  }}
                  disabled={Boolean(personeelVoorVervallen && deletingId === personeelVoorVervallen.id)}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors dc-grid-delete-btn disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {personeelVoorVervallen && deletingId === personeelVoorVervallen.id ? 'Bezig...' : 'Vervallen'}
                </button>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-lg border border-dc-gray-200 text-sm text-dc-gray-500 hover:bg-dc-gray-50"
                >
                  Annuleren
                </button>
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-dc-blue-500 text-white text-sm font-medium hover:bg-dc-blue-600 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saving && <Loader2 className="inline w-4 h-4 mr-2 animate-spin" />}
                  {saving ? 'Bijwerken...' : 'Bijwerken'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(personeelVoorVervallen)}
        title="Vervallen"
        message={personeelVoorVervallen ? 'Weet je zeker dat je personeel "' + (personeelVoorVervallen.naam || 'onbekend') + '" wilt vervallen?' : ''}
        confirmLabel="Vervallen"
        confirming={personeelVoorVervallen ? deletingId === personeelVoorVervallen.id : false}
        onCancel={() => setPersoneelVoorVervallen(null)}
        onConfirm={() => void bevestigVervallenPersoneel()}
      />

      <ConfirmDialog
        open={Boolean(verlofVoorVervallen)}
        title="Vervallen"
        message={verlofVoorVervallen ? 'Weet je zeker dat je verlofregel "' + (verlofVoorVervallen.omschrijving || verlofVoorVervallen.datum || 'onbekend') + '" wilt vervallen?' : ''}
        confirmLabel="Vervallen"
        confirming={verlofVoorVervallen ? deletingId === verlofVoorVervallen.id : false}
        onCancel={() => setVerlofVoorVervallen(null)}
        onConfirm={() => void bevestigVervallenVerlof()}
      />

    </div>
  );
}
