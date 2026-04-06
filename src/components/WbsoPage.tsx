import { Calculator, CheckCircle, Clock3, Loader2, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { jsPDF } from 'jspdf';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
import type { WbsoStatusAanvraag } from '../types';
import { clearNinoxWbsoDocument, createNinoxWbsoStatusAanvraagLeeg, fetchNinoxPersoneel, fetchNinoxStatusVasteOpties, fetchNinoxVerlofuren, fetchNinoxWbsoDocument, fetchNinoxWbsoStatusAanvragen, updateNinoxWbsoStatusAanvraag, uploadNinoxWbsoDocument, vervalNinoxWbsoStatusAanvraag } from '../lib/ninox';
import { compareStrings, nextSortState, type SortState } from '../lib/sort';
import { matchesAllTerms, parseSearchTerms } from '../lib/search';
import { waitForNextPaint } from '../lib/render';
import { formatDutchNumber, formatDutchNumberInputLive, parseDutchNumber } from '../lib/amount';
import LoadingSpinner from './ui/LoadingSpinner';
import SortableTh from './ui/SortableTh';
import ComboBox from './ui/ComboBox';
import ConfirmDialog from './ui/ConfirmDialog';
import NumericFieldInput from './ui/NumericFieldInput';

type UrenstaatRow = {
  id: string;
  datum: string;
  medewerker: string;
  project: string;
  uren: string;
  isWeekend: boolean;
  isFeestdag: boolean;
};

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function formatDateDdMmYyyy(date: Date): string {
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function getVoornaam(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.split(/\s+/)[0] || trimmed;
}

function createCrc32Table(): Uint32Array {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let crc = i;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) !== 0 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    table[i] = crc >>> 0;
  }
  return table;
}

const CRC32_TABLE = createCrc32Table();

function calculateCrc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dateToDosDateTime(date: Date): { dosTime: number; dosDate: number } {
  const year = Math.max(1980, date.getFullYear());
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosTime, dosDate };
}

function createStoredZip(files: Array<{ name: string; data: string | Uint8Array }>): Blob {
  const encoder = new TextEncoder();
  const now = new Date();
  const { dosTime, dosDate } = dateToDosDateTime(now);
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  files.forEach((file) => {
    const nameBytes = encoder.encode(file.name);
    const dataBytes = typeof file.data === 'string' ? encoder.encode(file.data) : file.data;
    const crc32 = calculateCrc32(dataBytes);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, dosTime, true);
    localView.setUint16(12, dosDate, true);
    localView.setUint32(14, crc32, true);
    localView.setUint32(18, dataBytes.length, true);
    localView.setUint32(22, dataBytes.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);
    localParts.push(localHeader, dataBytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, dosTime, true);
    centralView.setUint16(14, dosDate, true);
    centralView.setUint32(16, crc32, true);
    centralView.setUint32(20, dataBytes.length, true);
    centralView.setUint32(24, dataBytes.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);

    offset += localHeader.length + dataBytes.length;
  });

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  endView.setUint16(20, 0, true);

  const totalSize = localParts.reduce((sum, part) => sum + part.length, 0) + centralSize + endRecord.length;
  const zipBytes = new Uint8Array(totalSize);
  let cursor = 0;
  [...localParts, ...centralParts, endRecord].forEach((part) => {
    zipBytes.set(part, cursor);
    cursor += part.length;
  });

  return new Blob([zipBytes.buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

function getDutchWeekdayName(date: Date): string {
  return ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'][date.getDay()] || '';
}

function createLocalDate(year: number, monthIndex: number, day: number): Date {
  return new Date(year, monthIndex, day, 12, 0, 0, 0);
}

function getEerstePaasdag(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return createLocalDate(year, month, day);
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function getDutchHolidayKeys(year: number): Set<string> {
  const easter = getEerstePaasdag(year);
  const koningsdag = (() => {
    const base = createLocalDate(year, 3, 27);
    return base.getDay() === 0 ? createLocalDate(year, 3, 26) : base;
  })();
  const holidays = [
    createLocalDate(year, 0, 1),
    addDays(easter, -2),
    easter,
    addDays(easter, 1),
    koningsdag,
    createLocalDate(year, 4, 5),
    addDays(easter, 39),
    addDays(easter, 49),
    addDays(easter, 50),
    createLocalDate(year, 11, 25),
    createLocalDate(year, 11, 26),
  ];

  return new Set(holidays.map((date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`));
}

function formatIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseKnownDate(value: string | undefined): Date | null {
  const raw = String(value || '').trim();
  if (!raw) {
    return null;
  }

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const date = createLocalDate(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return formatIsoDate(date) === `${iso[1]}-${iso[2]}-${iso[3]}` ? date : null;
  }

  const nl = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (nl) {
    const date = createLocalDate(Number(nl[3]), Number(nl[2]) - 1, Number(nl[1]));
    return formatIsoDate(date) === `${nl[3]}-${pad2(Number(nl[2]))}-${pad2(Number(nl[1]))}` ? date : null;
  }

  return null;
}

function getEmploymentRangeForYear(year: number, startdatum?: string, einddatum?: string): { start: Date; eind: Date } | null {
  const yearStart = createLocalDate(year, 0, 1);
  const yearEnd = createLocalDate(year, 11, 31);
  const start = parseKnownDate(startdatum) || yearStart;
  const eind = parseKnownDate(einddatum) || yearEnd;
  const effectiveStart = start > yearStart ? start : yearStart;
  const effectiveEnd = eind < yearEnd ? eind : yearEnd;

  if (effectiveStart > effectiveEnd) {
    return null;
  }

  return { start: effectiveStart, eind: effectiveEnd };
}

function getDayCountInclusive(start: Date, eind: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((formatMiddayDate(eind).getTime() - formatMiddayDate(start).getTime()) / msPerDay) + 1;
}

function formatMiddayDate(date: Date): Date {
  return createLocalDate(date.getFullYear(), date.getMonth(), date.getDate());
}

function getWeeksInYear(year: number): number {
  const dec28 = createLocalDate(year, 11, 28);
  const dayNumber = dec28.getDay() === 0 ? 7 : dec28.getDay();
  const thursday = addDays(dec28, 4 - dayNumber);
  const yearStart = createLocalDate(thursday.getFullYear(), 0, 1);
  return Math.ceil((((thursday.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function calculateBrutoBeschikbareJaaruren(year: number, start: Date, eind: Date, werkurenPerWeek: number): number {
  if (werkurenPerWeek <= 0) {
    return 0;
  }

  const jaarStart = createLocalDate(year, 0, 1);
  const jaarEind = createLocalDate(year, 11, 31);
  const dagenInJaar = getDayCountInclusive(jaarStart, jaarEind);
  const dagenInDienst = getDayCountInclusive(start, eind);
  const deelVanJaar = dagenInJaar > 0 ? dagenInDienst / dagenInJaar : 0;

  return werkurenPerWeek * getWeeksInYear(year) * deelVanJaar;
}
function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    const current = copy[index];
    copy[index] = copy[randomIndex];
    copy[randomIndex] = current;
  }
  return copy;
}

function isWeekendOrHoliday(date: Date, holidayKeys: Set<string>): boolean {
  const day = date.getDay();
  return day === 0 || day === 6 || holidayKeys.has(formatIsoDate(date));
}

function roundDownToHalfHour(value: number): number {
  return Math.floor(Math.max(0, value) * 2) / 2;
}

function werktMedewerkerOpDatum(
  medewerker: { maandag?: boolean; dinsdag?: boolean; woensdag?: boolean; donderdag?: boolean; vrijdag?: boolean },
  date: Date
): boolean {
  switch (date.getDay()) {
    case 1:
      return medewerker.maandag ?? true;
    case 2:
      return medewerker.dinsdag ?? true;
    case 3:
      return medewerker.woensdag ?? true;
    case 4:
      return medewerker.donderdag ?? true;
    case 5:
      return medewerker.vrijdag ?? true;
    default:
      return false;
  }
}
function normalizePersonMatchValue(value: string | undefined): string {
  return String(value || '').trim().toLocaleLowerCase('nl');
}

function isSamePersoneel(verlofMedewerkerId: string | undefined, verlofMedewerkerNaam: string | undefined, personeelId: number, personeelNaam: string): boolean {
  const normalizedVerlofId = String(verlofMedewerkerId || '').trim();
  if (normalizedVerlofId && normalizedVerlofId === String(personeelId)) {
    return true;
  }

  const normalizedVerlofNaam = normalizePersonMatchValue(verlofMedewerkerNaam);
  const normalizedPersoneelNaam = normalizePersonMatchValue(personeelNaam);
  return Boolean(normalizedVerlofNaam) && normalizedVerlofNaam === normalizedPersoneelNaam;
}

function buildUrenstaatRows(year: number): UrenstaatRow[] {
  const rows: UrenstaatRow[] = [];
  const holidayKeys = getDutchHolidayKeys(year);
  let current = createLocalDate(year, 0, 1);

  while (current.getFullYear() === year) {
    const dateKey = `${current.getFullYear()}-${pad2(current.getMonth() + 1)}-${pad2(current.getDate())}`;
    const dayOfWeek = current.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = holidayKeys.has(dateKey);
    rows.push({
      id: dateKey,
      datum: `${formatDateDdMmYyyy(current)} ${getDutchWeekdayName(current)}`,
      medewerker: '',
      project: '',
      uren: '',
      isWeekend,
      isFeestdag: isHoliday,
    });
    current = addDays(current, 1);
  }

  return rows;
}

export default function WbsoPage() {
  type GridSortKey = 'jaar' | 'status' | 'referentie' | 'omschrijving' | 'urenToegekend' | 'percentageDekking' | 'urenGewerkt';
  type FormTab = 'Algemeen' | 'Documenten';
  type WbsoDocumentField = 'Aanvraag' | 'Beschikking';
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab');
  const activeTab = tab === 'urenstaat' || tab === 'status-aanvragen' ? tab : 'status-aanvragen';
  const [items, setItems] = useState<WbsoStatusAanvraag[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sort, setSort] = useState<SortState<GridSortKey>>({ key: 'jaar', direction: 'asc' });
  const [zoek, setZoek] = useState('');
  const [urenstaatJaar, setUrenstaatJaar] = useState(String(new Date().getFullYear()));
  const [urenstaatRows, setUrenstaatRows] = useState<UrenstaatRow[]>([]);
  const [generatingUrenstaat, setGeneratingUrenstaat] = useState(false);
  const [urenstaatBerekeningFout, setUrenstaatBerekeningFout] = useState('');
  const [nettoTotaleCapaciteitUren, setNettoTotaleCapaciteitUren] = useState('0,00');
  const [openingRowId, setOpeningRowId] = useState<number | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [generatingExcel, setGeneratingExcel] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [formTab, setFormTab] = useState<FormTab>('Algemeen');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [jaar, setJaar] = useState('');
  const [status, setStatus] = useState('');
  const [periodeVan, setPeriodeVan] = useState('');
  const [periodeTm, setPeriodeTm] = useState('');
  const [referentie, setReferentie] = useState('');
  const [percentageDekking, setPercentageDekking] = useState('');
  const [omschrijving, setOmschrijving] = useState('');
  const [urenToegekend, setUrenToegekend] = useState('');
  const [urenGewerkt, setUrenGewerkt] = useState('');
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState<WbsoDocumentField | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [itemVoorVervallen, setItemVoorVervallen] = useState<WbsoStatusAanvraag | null>(null);
  const [formError, setFormError] = useState('');
  const [aanvraagDocumentNaam, setAanvraagDocumentNaam] = useState('');
  const [aanvraagDocumentPreviewUrl, setAanvraagDocumentPreviewUrl] = useState('');
  const [beschikkingDocumentNaam, setBeschikkingDocumentNaam] = useState('');
  const huidigeJaar = new Date().getFullYear();
  const urenstaatJaarOpties = useMemo(() => [String(huidigeJaar - 1), String(huidigeJaar), String(huidigeJaar + 1)], [huidigeJaar]);
  const [beschikkingDocumentPreviewUrl, setBeschikkingDocumentPreviewUrl] = useState('');
  const [jaarOpties, setJaarOpties] = useState<string[]>([]);
  const [statusOpties, setStatusOpties] = useState<string[]>([]);
  const [periodeVanOpties, setPeriodeVanOpties] = useState<string[]>([]);
  const [periodeTmOpties, setPeriodeTmOpties] = useState<string[]>([]);
  const [optiesLoaded, setOptiesLoaded] = useState(false);
  const aanvraagDocumentInputRef = useRef<HTMLInputElement | null>(null);
  const beschikkingDocumentInputRef = useRef<HTMLInputElement | null>(null);
  const aanvraagDocumentPreviewUrlRef = useRef('');
  const beschikkingDocumentPreviewUrlRef = useRef('');
  const documentLoadTokenRef = useRef<Record<WbsoDocumentField, number>>({ Aanvraag: 0, Beschikking: 0 });

  const openTab = (nextTab: 'status-aanvragen' | 'urenstaat') => {
    setSearchParams({ tab: nextTab });
  };

  const tabButtonClass = (tabName: 'status-aanvragen' | 'urenstaat') =>
    `w-full text-left rounded-lg border px-4 py-3 transition-colors ${
      activeTab === tabName
        ? 'border-dc-blue-500 bg-dc-blue-50'
        : 'border-dc-gray-100 hover:border-dc-blue-200 hover:bg-dc-blue-50/40'
    }`;

  const loadWbso = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchNinoxWbsoStatusAanvragen();
      setItems(data);
    } catch (err) {
      setItems([]);
      setError(err instanceof Error ? err.message : 'Onbekende fout');
    } finally {
      setLoading(false);
    }
  };

  const ensureWbsoOptiesLoaded = async () => {
    if (optiesLoaded) {
      return;
    }
    const opties = await fetchNinoxStatusVasteOpties();
    setJaarOpties(opties.jaar);
    setStatusOpties(opties.status);
    setPeriodeVanOpties(opties.periodeVan);
    setPeriodeTmOpties(opties.periodeTm);
    setOptiesLoaded(true);
  };

  useEffect(() => {
    void loadWbso();
  }, [activeTab]);

  const setDocumentNaam = (field: WbsoDocumentField, value: string) => {
    if (field === 'Aanvraag') {
      setAanvraagDocumentNaam(value);
      return;
    }
    setBeschikkingDocumentNaam(value);
  };

  const setDocumentPreviewUrl = (field: WbsoDocumentField, value: string) => {
    if (field === 'Aanvraag') {
      setAanvraagDocumentPreviewUrl(value);
      return;
    }
    setBeschikkingDocumentPreviewUrl(value);
  };

  const getDocumentPreviewUrl = (field: WbsoDocumentField) =>
    field === 'Aanvraag' ? aanvraagDocumentPreviewUrl : beschikkingDocumentPreviewUrl;
  const getInlineDocumentPreviewUrl = (field: WbsoDocumentField) => {
    const url = getDocumentPreviewUrl(field);
    return url ? `${url}#toolbar=0&navpanes=0&scrollbar=0&statusbar=0&messages=0` : '';
  };


  const getDocumentInputRef = (field: WbsoDocumentField) =>
    field === 'Aanvraag' ? aanvraagDocumentInputRef : beschikkingDocumentInputRef;

  const getDocumentPreviewUrlRef = (field: WbsoDocumentField) =>
    field === 'Aanvraag' ? aanvraagDocumentPreviewUrlRef : beschikkingDocumentPreviewUrlRef;

  const resetDocumentState = (field: WbsoDocumentField) => {
    documentLoadTokenRef.current[field] = Date.now();
    setDocumentNaam(field, '');
    const inputRef = getDocumentInputRef(field);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    const previewRef = getDocumentPreviewUrlRef(field);
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
    }
    previewRef.current = '';
    setDocumentPreviewUrl(field, '');
  };

  const resetAlleDocumenten = () => {
    resetDocumentState('Aanvraag');
    resetDocumentState('Beschikking');
  };

  const laadBestaandDocument = async (recordId: number, field: WbsoDocumentField) => {
    const token = Date.now();
    documentLoadTokenRef.current[field] = token;
    try {
      const doc = await fetchNinoxWbsoDocument(recordId, field);
      if (documentLoadTokenRef.current[field] !== token || !doc) {
        return;
      }
      const url = URL.createObjectURL(doc.blob);
      const previewRef = getDocumentPreviewUrlRef(field);
      if (previewRef.current) {
        URL.revokeObjectURL(previewRef.current);
      }
      previewRef.current = url;
      setDocumentPreviewUrl(field, url);
      setDocumentNaam(field, doc.naam);
    } catch {
      // Stil: geen bestaand document is toegestaan.
    }
  };

  const laadBestaandeDocumenten = async (recordId: number) => {
    await Promise.all([
      laadBestaandDocument(recordId, 'Aanvraag'),
      laadBestaandDocument(recordId, 'Beschikking'),
    ]);
  };

  const openDocumentPicker = (field: WbsoDocumentField) => {
    getDocumentInputRef(field).current?.click();
  };

  const handleDocumentChange = async (field: WbsoDocumentField, event: ChangeEvent<HTMLInputElement>) => {
    const bestand = Array.from(event.target.files || [])[0];
    event.target.value = '';
    if (!bestand) {
      return;
    }
    const isPdf = bestand.type === 'application/pdf' || bestand.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setFormError('Alleen PDF-bestanden zijn toegestaan.');
      return;
    }
    if (!editingId) {
      setFormError('Interne fout: record ontbreekt.');
      return;
    }

    setFormError('');
    setDocumentNaam(field, bestand.name);
    const previewRef = getDocumentPreviewUrlRef(field);
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
    }
    const previewUrl = URL.createObjectURL(bestand);
    previewRef.current = previewUrl;
    setDocumentPreviewUrl(field, previewUrl);

    setUploadingDocument(field);
    try {
      await uploadNinoxWbsoDocument(editingId, bestand, field);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Document upload mislukt.');
    } finally {
      setUploadingDocument(null);
    }
  };

  const handleDocumentDelete = async (field: WbsoDocumentField) => {
    setFormError('');
    const previewRef = getDocumentPreviewUrlRef(field);
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
    }
    previewRef.current = '';
    setDocumentPreviewUrl(field, '');
    setDocumentNaam(field, '');
    if (!editingId) {
      return;
    }

    setUploadingDocument(field);
    try {
      await clearNinoxWbsoDocument(editingId, field);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'PDF verwijderen mislukt.');
    } finally {
      setUploadingDocument(null);
    }
  };

  const handleDocumentOpen = async (field: WbsoDocumentField) => {
    setFormError('');
    const currentPreview = getDocumentPreviewUrl(field);
    if (currentPreview) {
      window.open(currentPreview, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!editingId) {
      return;
    }

    try {
      const doc = await fetchNinoxWbsoDocument(editingId, field);
      if (!doc) {
        setFormError('Geen PDF gevonden voor dit documentveld.');
        return;
      }
      const url = URL.createObjectURL(doc.blob);
      const previewRef = getDocumentPreviewUrlRef(field);
      if (previewRef.current) {
        URL.revokeObjectURL(previewRef.current);
      }
      previewRef.current = url;
      setDocumentPreviewUrl(field, url);
      setDocumentNaam(field, doc.naam);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'PDF openen mislukt.');
    }
  };


  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      if (sort.key === 'jaar') {
        return compareStrings(a.jaar || '', b.jaar || '', sort.direction);
      }
      if (sort.key === 'status') {
        return compareStrings(a.status || '', b.status || '', sort.direction);
      }
      if (sort.key === 'referentie') {
        return compareStrings(a.referentie || '', b.referentie || '', sort.direction);
      }
      if (sort.key === 'omschrijving') {
        return compareStrings(a.omschrijving || '', b.omschrijving || '', sort.direction);
      }
      if (sort.key === 'urenToegekend') {
        return compareStrings(a.urenToegekend || '', b.urenToegekend || '', sort.direction);
      }
      return compareStrings(a.urenGewerkt || '', b.urenGewerkt || '', sort.direction);
    });
  }, [items, sort]);

  const filteredItems = useMemo(() => {
    const terms = parseSearchTerms(zoek);
    if (terms.length === 0) {
      return sortedItems;
    }
    return sortedItems.filter((item) =>
      matchesAllTerms(
        `${item.jaar || ''} ${item.status || ''} ${item.periodeVan || ''} ${item.periodeTm || ''} ${item.referentie || ''} ${item.omschrijving || ''} ${item.urenToegekend || ''} ${item.percentageDekking || ''} ${item.urenGewerkt || ''}`,
        terms
      )
    );
  }, [sortedItems, zoek]);

  const totaalBegroteUren = useMemo(() => {
    const totaal = items
      .filter((item) => String(item.jaar || '').trim() === String(urenstaatJaar).trim())
      .reduce((sum, item) => {
        const uren = parseDutchNumber(item.urenToegekend || '') || 0;
        const percentage = parseDutchNumber(item.percentageDekking || '') ?? 100;
        return sum + uren * (percentage / 100);
      }, 0);
    return formatDutchNumber(totaal, 2);
  }, [items, urenstaatJaar]);

  const urenstaatProjectVerdeling = useMemo(() => {
    const grouped = new Map<string, { begroting: number; nettoDoel: number }>();
    for (const item of items) {
      if (String(item.jaar || '').trim() !== String(urenstaatJaar).trim()) {
        continue;
      }
      const project = item.referentie || item.omschrijving || 'WBSO';
      const urenToegekend = parseDutchNumber(item.urenToegekend || '') || 0;
      const percentageDekking = parseDutchNumber(item.percentageDekking || '') ?? 100;
      const nettoDoel = urenToegekend * (percentageDekking / 100);
      const current = grouped.get(project) || { begroting: 0, nettoDoel: 0 };
      grouped.set(project, {
        begroting: current.begroting + urenToegekend,
        nettoDoel: current.nettoDoel + nettoDoel,
      });
    }
    return Array.from(grouped.entries())
      .map(([project, values]) => ({ project, begroting: values.begroting, nettoDoel: values.nettoDoel }))
      .sort((a, b) => a.project.localeCompare(b.project, 'nl', { sensitivity: 'base', numeric: true }));
  }, [items, urenstaatJaar]);

  const urenstaatProjectOpties = useMemo(() => {
    return urenstaatProjectVerdeling.map((item) => item.project);
  }, [urenstaatProjectVerdeling]);

  const urenstaatProjectTotalen = useMemo(() => {
    const totalen = new Map<string, number>();
    for (const project of urenstaatProjectOpties) {
      totalen.set(project, 0);
    }
    for (const row of urenstaatRows) {
      const project = String(row.project || '').trim();
      if (!project) {
        continue;
      }
      totalen.set(project, (totalen.get(project) || 0) + (parseDutchNumber(row.uren || '') || 0));
    }
    return Array.from(totalen.entries()).map(([project, totaal]) => ({
      project,
      totaal,
      totaalFormatted: formatDutchNumber(totaal, 1),
    }));
  }, [urenstaatProjectOpties, urenstaatRows]);

  const urenstaatGeneraalTotaal = useMemo(() => {
    const totaal = urenstaatProjectTotalen.reduce((sum, item) => sum + item.totaal, 0);
    return formatDutchNumber(totaal, 1);
  }, [urenstaatProjectTotalen]);

  const berekenUrenstaat = async (showSpinner = false) => {
    const selectedYear = Number.parseInt(urenstaatJaar, 10);
    const targetYear = Number.isFinite(selectedYear) ? selectedYear : huidigeJaar;

    if (showSpinner) {
      setGeneratingUrenstaat(true);
    }
    setUrenstaatBerekeningFout('');

    try {
      const [personeel, verlofItems] = await Promise.all([fetchNinoxPersoneel(), fetchNinoxVerlofuren()]);
      const nettoTotaleCapaciteit = personeel.reduce((sum, medewerker) => {
        const werkurenPerWeek = parseDutchNumber(medewerker.werkurenPerWeek || '') || 0;
        const percentageWbso = parseDutchNumber(medewerker.percentageWbso || '') || 0;

        if (werkurenPerWeek <= 0 || percentageWbso <= 0) {
          return sum;
        }

        const employmentRange = getEmploymentRangeForYear(targetYear, medewerker.startdatum, medewerker.einddatum);
        if (!employmentRange) {
          return sum;
        }

        const brutoBeschikbaarInJaar = calculateBrutoBeschikbareJaaruren(
          targetYear,
          employmentRange.start,
          employmentRange.eind,
          werkurenPerWeek
        );
        const brutoBeschikbaarVoorWbso = brutoBeschikbaarInJaar * (percentageWbso / 100);

        const verlofurenInJaar = verlofItems.reduce((verlofSom, verlofItem) => {
          if (!isSamePersoneel(verlofItem.medewerkerId, verlofItem.medewerker, medewerker.id, medewerker.naam)) {
            return verlofSom;
          }

          const verlofDatum = parseKnownDate(verlofItem.datum);
          if (!verlofDatum || verlofDatum.getFullYear() !== targetYear) {
            return verlofSom;
          }
          if (verlofDatum < employmentRange.start || verlofDatum > employmentRange.eind) {
            return verlofSom;
          }

          return verlofSom + (parseDutchNumber(verlofItem.aantalUur || '') || 0);
        }, 0);

        const nettoBeschikbaarVoorWbso = Math.max(0, brutoBeschikbaarVoorWbso - verlofurenInJaar);
        return sum + nettoBeschikbaarVoorWbso;
      }, 0);

      const doelUren = parseDutchNumber(totaalBegroteUren) || 0;
      const holidayKeys = getDutchHolidayKeys(targetYear);
      const projectOpties = urenstaatProjectOpties;
      const totaalTeVerdelenUren = Math.min(doelUren, nettoTotaleCapaciteit);
      const projectRemaining = new Map<string, number>(
        urenstaatProjectVerdeling.map((item) => [item.project, item.nettoDoel])
      );

      const slots = personeel.flatMap((medewerker) => {
        const werkurenPerWeek = parseDutchNumber(medewerker.werkurenPerWeek || '') || 0;
        const percentageWbso = parseDutchNumber(medewerker.percentageWbso || '') || 0;
        const employmentRange = getEmploymentRangeForYear(targetYear, medewerker.startdatum, medewerker.einddatum);

        if (werkurenPerWeek <= 0 || percentageWbso <= 0 || !employmentRange) {
          return [];
        }

        const maxPerDag = (werkurenPerWeek * (percentageWbso / 100)) / 5;
        if (maxPerDag <= 0) {
          return [];
        }

        const leaveByDate = verlofItems.reduce((map, verlofItem) => {
          if (!isSamePersoneel(verlofItem.medewerkerId, verlofItem.medewerker, medewerker.id, medewerker.naam)) {
            return map;
          }
          const verlofDatum = parseKnownDate(verlofItem.datum);
          if (!verlofDatum || verlofDatum.getFullYear() !== targetYear) {
            return map;
          }
          const dateKey = formatIsoDate(verlofDatum);
          map.set(dateKey, (map.get(dateKey) || 0) + (parseDutchNumber(verlofItem.aantalUur || '') || 0));
          return map;
        }, new Map<string, number>());

        const medewerkerSlots: Array<{ date: Date; dateKey: string; medewerker: string; maxHours: number }> = [];
        let current = new Date(employmentRange.start);
        while (current <= employmentRange.eind) {
          const dateKey = formatIsoDate(current);
          if (!isWeekendOrHoliday(current, holidayKeys) && werktMedewerkerOpDatum(medewerker, current)) {
            const beschikbaar = roundDownToHalfHour(Math.max(0, maxPerDag - (leaveByDate.get(dateKey) || 0)));
            if (beschikbaar >= 0.5) {
              medewerkerSlots.push({
                date: new Date(current),
                dateKey,
                medewerker: medewerker.naam || `Medewerker ${medewerker.id}`,
                maxHours: beschikbaar,
              });
            }
          }
          current = addDays(current, 1);
        }
        return medewerkerSlots;
      });

      let resterendeUren = totaalTeVerdelenUren;
      const assignments = new Map<string, UrenstaatRow[]>();
      for (const slot of shuffleArray(slots)) {
        if (resterendeUren <= 0) {
          break;
        }
        const uren = roundDownToHalfHour(Math.min(slot.maxHours, resterendeUren));
        if (uren < 0.5) {
          continue;
        }
        const row: UrenstaatRow = {
          id: `${slot.dateKey}-${slot.medewerker}-${Math.random().toString(36).slice(2, 8)}`,
          datum: `${formatDateDdMmYyyy(slot.date)} ${getDutchWeekdayName(slot.date)}`,
          medewerker: slot.medewerker,
          project: (() => {
            if (projectOpties.length === 0) {
              return 'WBSO';
            }
            const gekozenProject = [...projectRemaining.entries()]
              .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'nl', { sensitivity: 'base', numeric: true }))[0]?.[0] || projectOpties[0];
            projectRemaining.set(gekozenProject, (projectRemaining.get(gekozenProject) || 0) - uren);
            return gekozenProject;
          })(),
          uren: formatDutchNumber(uren, 1),
          isWeekend: false,
          isFeestdag: holidayKeys.has(slot.dateKey),
        };
        const currentRows = assignments.get(slot.dateKey) || [];
        currentRows.push(row);
        assignments.set(slot.dateKey, currentRows);
        resterendeUren -= uren;
      }

      const generatedRows: UrenstaatRow[] = [];
      let currentDate = createLocalDate(targetYear, 0, 1);
      while (currentDate.getFullYear() === targetYear) {
        const dateKey = formatIsoDate(currentDate);
        const dayRows = assignments.get(dateKey) || [];
        if (dayRows.length > 0) {
          generatedRows.push(...dayRows);
        } else {
          const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
          const isFeestdag = holidayKeys.has(dateKey);
          generatedRows.push({
            id: dateKey,
            datum: `${formatDateDdMmYyyy(currentDate)} ${getDutchWeekdayName(currentDate)}`,
            medewerker: '',
            project: '',
            uren: '',
            isWeekend,
            isFeestdag,
          });
        }
        currentDate = addDays(currentDate, 1);
      }

      setNettoTotaleCapaciteitUren(formatDutchNumber(nettoTotaleCapaciteit, 2));
      setUrenstaatRows(generatedRows);
    } catch (err) {
      setUrenstaatBerekeningFout(err instanceof Error ? err.message : 'Berekening van netto totale capaciteit mislukt.');
      setNettoTotaleCapaciteitUren('0,00');
      setUrenstaatRows(buildUrenstaatRows(targetYear));
    } finally {
      if (showSpinner) {
        setGeneratingUrenstaat(false);
      }
    }
  };

  const handleGenereerUrenstaat = async () => {
    await berekenUrenstaat(true);
  };

  useEffect(() => {
    if (activeTab !== 'urenstaat') {
      return;
    }
    void berekenUrenstaat(false);
  }, [activeTab, urenstaatJaar]);

  const handleGenereerPdf = async () => {
    setGeneratingPdf(true);
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 14;
      let y = margin;

      const ensureSpace = (neededHeight: number) => {
        if (y + neededHeight <= pageHeight - margin) {
          return;
        }
        doc.addPage();
        y = margin;
      };

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(`WBSO Urenstaat ${urenstaatJaar}`, margin, y);
      y += 8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`Netto te plannen WBSO uren: ${totaalBegroteUren}`, margin, y);
      y += 5;
      doc.text(`Netto totale WBSO capaciteit uren: ${nettoTotaleCapaciteitUren}`, margin, y);
      y += 8;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Projecttotalen', margin, y);
      y += 6;

      doc.setFontSize(10);
      urenstaatProjectTotalen.forEach((item) => {
        ensureSpace(6);
        doc.setFont('helvetica', 'normal');
        doc.text(item.project, margin, y);
        doc.text(item.totaalFormatted, pageWidth - margin, y, { align: 'right' });
        y += 5;
      });
      ensureSpace(7);
      doc.setFont('helvetica', 'bold');
      doc.text('Generaal totaal', margin, y);
      doc.text(urenstaatGeneraalTotaal, pageWidth - margin, y, { align: 'right' });
      y += 10;

      ensureSpace(8);
      doc.text('Datum', margin, y);
      doc.text('Medewerker', 58, y);
      doc.text('Project', 118, y);
      doc.text('Uren', pageWidth - margin, y, { align: 'right' });
      y += 4;
      doc.line(margin, y, pageWidth - margin, y);
      y += 5;

      doc.setFont('helvetica', 'normal');
      urenstaatRows.forEach((row) => {
        ensureSpace(6);
        doc.text(row.datum || '-', margin, y);
        doc.text(getVoornaam(row.medewerker || '-').slice(0, 28), 58, y);
        doc.text((row.project || '-').slice(0, 22), 118, y);
        doc.text(row.uren || '-', pageWidth - margin, y, { align: 'right' });
        y += 5;
      });

      doc.save(`wbso-urenstaat-${urenstaatJaar}.pdf`);
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleGenereerExcel = async () => {
    setGeneratingExcel(true);
    try {
      const projectRowsXml = urenstaatProjectTotalen
        .map((item, index) => {
          const totaalNumber = parseDutchNumber(item.totaalFormatted);
          const rowNumber = index + 4;
          return `
      <row r="${rowNumber}">
        <c r="A${rowNumber}" s="3" t="inlineStr"><is><t>${escapeXml(item.project)}</t></is></c>
        <c r="B${rowNumber}" s="4"><v>${typeof totaalNumber === 'number' && Number.isFinite(totaalNumber) ? totaalNumber.toFixed(2) : '0.00'}</v></c>
      </row>`;
        })
        .join('');

      const detailStartRow = urenstaatProjectTotalen.length + 8;
      const detailRowsXml = urenstaatRows
        .map((row, index) => {
          const urenNumber = parseDutchNumber(row.uren || '0');
          const rowNumber = detailStartRow + index;
          return `
      <row r="${rowNumber}">
        <c r="A${rowNumber}" s="3" t="inlineStr"><is><t>${escapeXml(row.datum || '-')}</t></is></c>
        <c r="B${rowNumber}" s="3" t="inlineStr"><is><t>${escapeXml(getVoornaam(row.medewerker || '-'))}</t></is></c>
        <c r="C${rowNumber}" s="3" t="inlineStr"><is><t>${escapeXml(row.project || '-')}</t></is></c>
        <c r="D${rowNumber}" s="4"><v>${typeof urenNumber === 'number' && Number.isFinite(urenNumber) ? urenNumber.toFixed(2) : '0.00'}</v></c>
      </row>`;
        })
        .join('');

      const generaalTotaalNumber = parseDutchNumber(urenstaatGeneraalTotaal);
      const totalRowNumber = urenstaatProjectTotalen.length + 4;
      const headerRowNumber = detailStartRow - 1;
      const lastDetailRow = Math.max(headerRowNumber, detailStartRow + urenstaatRows.length - 1);
      const dimensionRef = `A1:D${lastDetailRow}`;
      const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="${dimensionRef}"/>
  <sheetViews>
    <sheetView workbookViewId="0">
      <pane ySplit="${headerRowNumber}" topLeftCell="A${detailStartRow}" activePane="bottomLeft" state="frozen"/>
      <selection pane="bottomLeft" activeCell="A${detailStartRow}" sqref="A${detailStartRow}"/>
    </sheetView>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>
    <col min="1" max="1" width="14" customWidth="1"/>
    <col min="2" max="2" width="18" customWidth="1"/>
    <col min="3" max="3" width="34" customWidth="1"/>
    <col min="4" max="4" width="12" customWidth="1"/>
  </cols>
  <sheetData>
    <row r="1">
      <c r="A1" s="1" t="inlineStr"><is><t>WBSO Urenstaat ${escapeXml(urenstaatJaar)}</t></is></c>
    </row>
    <row r="3">
      <c r="A3" s="2" t="inlineStr"><is><t>Projecttotalen</t></is></c>
      <c r="B3" s="2" t="inlineStr"><is><t>Uren</t></is></c>
    </row>${projectRowsXml}
    <row r="${totalRowNumber}">
      <c r="A${totalRowNumber}" s="5" t="inlineStr"><is><t>Generaal totaal</t></is></c>
      <c r="B${totalRowNumber}" s="6"><v>${typeof generaalTotaalNumber === 'number' && Number.isFinite(generaalTotaalNumber) ? generaalTotaalNumber.toFixed(2) : '0.00'}</v></c>
    </row>
    <row r="${detailStartRow - 2}">
      <c r="A${detailStartRow - 2}" s="2" t="inlineStr"><is><t>Urenstaatregels</t></is></c>
    </row>
    <row r="${headerRowNumber}">
      <c r="A${headerRowNumber}" s="2" t="inlineStr"><is><t>Datum</t></is></c>
      <c r="B${headerRowNumber}" s="2" t="inlineStr"><is><t>Medewerker</t></is></c>
      <c r="C${headerRowNumber}" s="2" t="inlineStr"><is><t>Project</t></is></c>
      <c r="D${headerRowNumber}" s="2" t="inlineStr"><is><t>Uren</t></is></c>
    </row>${detailRowsXml}
  </sheetData>
  <mergeCells count="2">
    <mergeCell ref="A1:D1"/>
    <mergeCell ref="A${detailStartRow - 2}:D${detailStartRow - 2}"/>
  </mergeCells>
</worksheet>`;

      const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="4">
    <font><sz val="10"/><name val="Verdana"/><color rgb="FF1F2937"/></font>
    <font><b/><sz val="14"/><name val="Verdana"/><color rgb="FF1F2937"/></font>
    <font><b/><sz val="10"/><name val="Verdana"/><color rgb="FF1F2937"/></font>
    <font><b/><sz val="10"/><name val="Verdana"/><color rgb="FF1F2937"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEEF2FF"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFD1D5DB"/></left>
      <right style="thin"><color rgb="FFD1D5DB"/></right>
      <top style="thin"><color rgb="FFD1D5DB"/></top>
      <bottom style="thin"><color rgb="FFD1D5DB"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="7">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
    <xf numFmtId="2" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>
    <xf numFmtId="2" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyNumberFormat="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
</styleSheet>`;

      const files = [
        {
          name: '[Content_Types].xml',
          data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`,
        },
        {
          name: '_rels/.rels',
          data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`,
        },
        {
          name: 'docProps/app.xml',
          data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Microsoft Excel</Application>
  <DocSecurity>0</DocSecurity>
  <ScaleCrop>false</ScaleCrop>
  <HeadingPairs>
    <vt:vector size="2" baseType="variant">
      <vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant>
      <vt:variant><vt:i4>1</vt:i4></vt:variant>
    </vt:vector>
  </HeadingPairs>
  <TitlesOfParts>
    <vt:vector size="1" baseType="lpstr">
      <vt:lpstr>Urenstaat</vt:lpstr>
    </vt:vector>
  </TitlesOfParts>
  <Company></Company>
  <LinksUpToDate>false</LinksUpToDate>
  <SharedDoc>false</SharedDoc>
  <HyperlinksChanged>false</HyperlinksChanged>
  <AppVersion>16.0300</AppVersion>
</Properties>`,
        },
        {
          name: 'docProps/core.xml',
          data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>WBSO Urenstaat ${escapeXml(urenstaatJaar)}</dc:title>
  <dc:creator>NinoxPlanning</dc:creator>
  <cp:lastModifiedBy>NinoxPlanning</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:modified>
</cp:coreProperties>`,
        },
        {
          name: 'xl/workbook.xml',
          data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Urenstaat" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`,
        },
        {
          name: 'xl/_rels/workbook.xml.rels',
          data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
        },
        { name: 'xl/styles.xml', data: stylesXml },
        { name: 'xl/worksheets/sheet1.xml', data: sheetXml },
      ];

      const blob = createStoredZip(files);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `wbso-urenstaat-${urenstaatJaar}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setGeneratingExcel(false);
    }
  };

  const handleNieuw = async () => {
    setCreating(true);
    setError('');
    setFormError('');
    try {
      await ensureWbsoOptiesLoaded();
      const nieuwId = await createNinoxWbsoStatusAanvraagLeeg();
      await loadWbso();
      setEditingId(nieuwId);
      setJaar('');
      setStatus('');
      setPeriodeVan('');
      setPeriodeTm('');
      setReferentie('');
      setPercentageDekking('');
      setOmschrijving('');
      setUrenToegekend('');
      setUrenGewerkt('');
      setFormTab('Algemeen');
      resetAlleDocumenten();
      setModalOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nieuw record aanmaken mislukt.');
    } finally {
      setCreating(false);
    }
  };

  const handleBewerk = async (item: WbsoStatusAanvraag) => {
    await ensureWbsoOptiesLoaded();
    setEditingId(item.id);
    setJaar(item.jaar || '');
    setStatus(item.status || '');
    setPeriodeVan(item.periodeVan || '');
    setPeriodeTm(item.periodeTm || '');
    setReferentie(item.referentie || '');
    setPercentageDekking(item.percentageDekking || '');
    setOmschrijving(item.omschrijving || '');
    setUrenToegekend(item.urenToegekend || '');
    setUrenGewerkt(item.urenGewerkt || '');
    setFormTab('Algemeen');
    setFormError('');
    resetAlleDocumenten();
    await laadBestaandeDocumenten(item.id);
    setModalOpen(true);
  };

  const handleOpenBewerkFromGrid = async (item: WbsoStatusAanvraag) => {
    setOpeningRowId(item.id);
    await waitForNextPaint();
    try {
      await handleBewerk(item);
    } finally {
      setOpeningRowId(null);
    }
  };

  const bevestigVervallen = async () => {
    if (!itemVoorVervallen) {
      return;
    }

    try {
      setDeletingId(itemVoorVervallen.id);
      setError('');
      await vervalNinoxWbsoStatusAanvraag(itemVoorVervallen.id);
      setItemVoorVervallen(null);
      closeModal();
      await loadWbso();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vervallen mislukt.');
    } finally {
      setDeletingId(null);
    }
  };
  const closeModal = () => {
    if (saving) {
      return;
    }
    setModalOpen(false);
    setEditingId(null);
    setJaar('');
    setStatus('');
    setPeriodeVan('');
    setPeriodeTm('');
    setReferentie('');
    setPercentageDekking('');
    setOmschrijving('');
    setUrenToegekend('');
    setUrenGewerkt('');
    setFormTab('Algemeen');
    resetAlleDocumenten();
    setFormError('');
  };

  const handleSave = async () => {
    if (!editingId) {
      setFormError('Interne fout: record ontbreekt.');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      await updateNinoxWbsoStatusAanvraag(editingId, {
        jaar,
        status,
        periodeVan,
        periodeTm,
        referentie,
        percentageDekking,
        omschrijving,
        urenToegekend,
        urenGewerkt,
      });
      await loadWbso();
      setSaving(false);
      closeModal();
      return;
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Bijwerken mislukt.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Calculator size={24} className="text-dc-blue-500" />
          <h1 className="text-2xl font-semibold text-dc-gray-500">WBSO</h1>
        </div>
        <p className="text-sm text-dc-gray-400">Status aanvragen ({items.length} records)</p>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-dc-gray-100 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button type="button" onClick={() => openTab('status-aanvragen')} className={tabButtonClass('status-aanvragen')}>
              <div className="flex items-center gap-2">
                <CheckCircle size={18} className="text-dc-blue-500" />
                <span className="text-sm font-semibold text-dc-gray-500">Status aanvragen</span>
              </div>
            </button>
            <button type="button" onClick={() => openTab('urenstaat')} className={tabButtonClass('urenstaat')}>
              <div className="flex items-center gap-2">
                <Clock3 size={18} className="text-dc-blue-500" />
                <span className="text-sm font-semibold text-dc-gray-500">Urenstaat</span>
              </div>
            </button>
          </div>
        </div>

        {activeTab === 'urenstaat' && (
          <div className="bg-white rounded-xl border border-dc-gray-100 p-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="w-full max-w-[120px]">
                <ComboBox
                  value={urenstaatJaar}
                  onChange={setUrenstaatJaar}
                  options={urenstaatJaarOpties.map((option) => ({ value: option, label: option }))}
                  placeholder="Jaar"
                  searchable={false}
                />
              </div>
              <button
                type="button"
                onClick={() => void handleGenereerUrenstaat()}
                disabled={generatingUrenstaat}
                className="h-[38px] px-4 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {generatingUrenstaat && <Loader2 className="inline w-4 h-4 mr-2 animate-spin" />}
                {generatingUrenstaat ? 'Bezig...' : 'Genereren urenstaat'}
              </button>
              <div className="w-full max-w-[220px]">
                <label className="block text-xs font-medium text-dc-gray-400 mb-1">Netto te plannen WBSO uren</label>
                <input
                  type="text"
                  value={totaalBegroteUren}
                  readOnly
                  className="h-[38px] w-full rounded-lg border border-dc-gray-200 bg-dc-gray-50 px-3 text-right text-sm text-dc-gray-500"
                />
              </div>
              <div className="w-full max-w-[220px]">
                <label className="block text-xs font-medium text-dc-gray-400 mb-1">Netto totale WBSO capaciteit uren</label>
                <input
                  type="text"
                  value={nettoTotaleCapaciteitUren}
                  readOnly
                  disabled
                  className="h-[38px] w-full rounded-lg border border-dc-gray-200 bg-dc-gray-50 px-3 text-right text-sm text-dc-gray-500 disabled:opacity-100"
                />
              </div>
              <div className="w-full sm:w-auto self-end">
                <button
                  type="button"
                  onClick={() => void handleGenereerPdf()}
                  disabled={generatingPdf}
                  className="h-[38px] px-4 rounded-lg bg-yellow-400 text-dc-gray-700 text-sm font-medium hover:bg-yellow-500 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {generatingPdf && <Loader2 className="inline w-4 h-4 mr-2 animate-spin" />}
                  {generatingPdf ? 'Bezig...' : 'PDF genereren'}
                </button>
              </div>
              <div className="w-full sm:w-auto self-end">
                <button
                  type="button"
                  onClick={() => void handleGenereerExcel()}
                  disabled={generatingExcel}
                  className="h-[38px] px-4 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {generatingExcel && <Loader2 className="inline w-4 h-4 mr-2 animate-spin" />}
                  {generatingExcel ? 'Bezig...' : 'Excel genereren'}
                </button>
              </div>
            </div>

            {urenstaatBerekeningFout && (
              <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                Berekening netto totale capaciteit mislukt: {urenstaatBerekeningFout}
              </div>
            )}
          </div>
        )}

        <div className="bg-white rounded-xl border border-dc-gray-100 p-6">
          {activeTab === 'status-aanvragen' && (
            <>
              <div className="mb-4 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => void handleNieuw()}
                  disabled={creating}
                  className="px-4 py-2 rounded-lg bg-dc-blue-500 text-white text-sm font-medium hover:bg-dc-blue-600 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {creating && <Loader2 className="inline w-4 h-4 mr-2 animate-spin" />}
                  {creating ? 'Bezig...' : 'Nieuw'}
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

              <LoadingSpinner active={loading} message="WBSO laden uit Ninox..." />

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
                      label="Jaar"
                      active={sort.key === 'jaar'}
                      direction={sort.direction}
                      onClick={() => setSort((current) => nextSortState(current, 'jaar'))}
                      className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
                    />
                    <SortableTh
                      label="Status"
                      active={sort.key === 'status'}
                      direction={sort.direction}
                      onClick={() => setSort((current) => nextSortState(current, 'status'))}
                      className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
                    />
                    <SortableTh
                      label="Referentie"
                      active={sort.key === 'referentie'}
                      direction={sort.direction}
                      onClick={() => setSort((current) => nextSortState(current, 'referentie'))}
                      className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
                    />
                    <SortableTh
                      label="Omschrijving"
                      active={sort.key === 'omschrijving'}
                      direction={sort.direction}
                      onClick={() => setSort((current) => nextSortState(current, 'omschrijving'))}
                      className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
                    />
                    <SortableTh
                      label="Uren toegekend"
                      active={sort.key === 'urenToegekend'}
                      direction={sort.direction}
                      onClick={() => setSort((current) => nextSortState(current, 'urenToegekend'))}
                      className="text-right px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
                    />
                    <SortableTh
                      label="Percentage dekking"
                      active={sort.key === 'percentageDekking'}
                      direction={sort.direction}
                      onClick={() => setSort((current) => nextSortState(current, 'percentageDekking'))}
                      className="text-right px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
                    />
                    <SortableTh
                      label="Uren gewerkt"
                      active={sort.key === 'urenGewerkt'}
                      direction={sort.direction}
                      onClick={() => setSort((current) => nextSortState(current, 'urenGewerkt'))}
                      className="text-right px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
                    />
                                      </tr>
                </thead>
                <tbody>
                    {filteredItems.map((item) => (
                      <tr key={item.id} className="dc-zebra-row dc-clickable-row" onClick={() => void handleOpenBewerkFromGrid(item)}>
                        <td className="px-5 py-3 text-dc-gray-500"><span className="inline-flex items-center gap-2"><span className="inline-flex w-4 h-4 items-center justify-center shrink-0">{openingRowId === item.id && <Loader2 className="w-4 h-4 text-dc-blue-500 animate-spin" />}</span>{item.jaar || '-'}</span></td>
                        <td className="px-5 py-3 text-dc-gray-500">{item.status || '-'}</td>
                        <td className="px-5 py-3 text-dc-gray-500">{item.referentie || '-'}</td>
                        <td className="px-5 py-3 text-dc-gray-500">{item.omschrijving || '-'}</td>
                        <td className="px-5 py-3 text-dc-gray-500 text-right">{item.urenToegekend || '-'}</td>
                        <td className="px-5 py-3 text-dc-gray-500 text-right">{item.percentageDekking || '-'}</td>
                        <td className="px-5 py-3 text-dc-gray-500 text-right">{item.urenGewerkt || '-'}</td>
                      </tr>
                    ))}
                    {!loading && filteredItems.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-5 py-8 text-center text-dc-gray-300 text-sm">
                          Geen WBSO records gevonden
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {activeTab === 'urenstaat' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-3 mb-4">
                {urenstaatProjectTotalen.map((item) => (
                  <div key={item.project} className="bg-white rounded-xl border border-dc-gray-100 px-4 py-3">
                    <div className="text-xs font-semibold uppercase text-dc-gray-400">Project</div>
                    <div className="mt-1 text-sm font-semibold text-dc-gray-500">{item.project}</div>
                    <div className="mt-2 text-right text-lg font-semibold text-dc-blue-500">{item.totaalFormatted}</div>
                  </div>
                ))}
                <div className="bg-dc-blue-50 rounded-xl border border-dc-blue-100 px-4 py-3">
                  <div className="text-xs font-semibold uppercase text-dc-blue-400">Generaal totaal</div>
                  <div className="mt-1 text-sm font-semibold text-dc-blue-400">Totaal alle projecten</div>
                  <div className="mt-2 text-right text-xl font-semibold text-dc-blue-600">{urenstaatGeneraalTotaal}</div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-dc-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-dc-gray-100">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400">Datum</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400">Medewerker</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400">Project</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-dc-gray-400">Uren</th>
                    </tr>
                  </thead>
                  <tbody>
                    {urenstaatRows.map((row) => {
                      const rowBackgroundClass = row.isFeestdag
                        ? 'bg-orange-100'
                        : row.isWeekend
                          ? 'bg-green-100'
                          : 'dc-zebra-row';
                      const cellClassName = row.isFeestdag
                        ? 'px-5 py-3 text-dc-gray-500 bg-orange-100'
                        : row.isWeekend
                          ? 'px-5 py-3 text-dc-gray-500 bg-green-100'
                          : 'px-5 py-3 text-dc-gray-500';
                      return (
                        <tr key={row.id} className={rowBackgroundClass}>
                          <td className={cellClassName}>{row.datum}</td>
                          <td className={cellClassName}>{row.medewerker || '-'}</td>
                          <td className={cellClassName}>{row.project || '-'}</td>
                          <td className={cellClassName + ' text-right'}>{row.uren || '-'}</td>
                        </tr>
                      );
                    })}
                    {urenstaatRows.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-5 py-8 text-center text-dc-gray-300 text-sm">
                          Nog geen urenstaatregels geladen
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-5xl max-h-[calc(100vh-2rem)] bg-white rounded-xl border border-dc-gray-100 overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-dc-blue-500">
              <h2 className="text-lg font-semibold text-dc-gray-500">WBSO status bewerken</h2>
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
                onClick={() => setFormTab('Documenten')}
                className={
                  formTab === 'Documenten'
                    ? 'px-4 py-2 text-sm font-medium text-dc-blue-500 border-b-2 border-dc-blue-500'
                    : 'px-4 py-2 text-sm font-medium text-dc-gray-400 hover:text-dc-gray-500'
                }
              >
                Documenten
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 min-h-[28rem]">
              {formError && (
                <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {formError}
                </div>
              )}

              {formTab === 'Algemeen' && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="md:col-span-1">
                    <label className="block text-xs font-medium text-dc-gray-400 mb-1">Jaar</label>
                    <ComboBox
                      value={jaar}
                      onChange={setJaar}
                      options={jaarOpties.map((option) => ({ value: option, label: option }))}
                      placeholder="Jaar"
                      searchable={false}
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-xs font-medium text-dc-gray-400 mb-1">Status</label>
                    <ComboBox
                      value={status}
                      onChange={setStatus}
                      options={statusOpties.map((option) => ({ value: option, label: option }))}
                      placeholder="Status"
                      searchable={false}
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-xs font-medium text-dc-gray-400 mb-1">Referentie</label>
                    <input
                      value={referentie}
                      onChange={(e) => setReferentie(e.target.value)}
                      placeholder="Referentie"
                      className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-xs font-medium text-dc-gray-400 mb-1">Percentage dekking</label>
                    <input
                      value={percentageDekking}
                      onChange={(e) => setPercentageDekking(formatDutchNumberInputLive(e.target.value, 0))}
                      inputMode="numeric"
                      placeholder="Percentage dekking"
                      className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm text-right outline-none focus:border-dc-blue-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-dc-gray-400 mb-1">Periode van</label>
                    <ComboBox
                      value={periodeVan}
                      onChange={setPeriodeVan}
                      options={periodeVanOpties.map((option) => ({ value: option, label: option }))}
                      placeholder="Periode van"
                      searchable={false}
                      sortOptions={false}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-dc-gray-400 mb-1">Periode t/m</label>
                    <ComboBox
                      value={periodeTm}
                      onChange={setPeriodeTm}
                      options={periodeTmOpties.map((option) => ({ value: option, label: option }))}
                      placeholder="Periode t/m"
                      searchable={false}
                      sortOptions={false}
                    />
                  </div>
                  <div className="md:col-span-4">
                    <label className="block text-xs font-medium text-dc-gray-400 mb-1">Omschrijving</label>
                    <input
                      value={omschrijving}
                      onChange={(e) => setOmschrijving(e.target.value)}
                      placeholder="Omschrijving"
                      className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-dc-gray-400 mb-1">Uren toegekend</label>
                    <NumericFieldInput
                      value={urenToegekend}
                      onChange={setUrenToegekend}
                      placeholder="Uren toegekend"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-dc-gray-400 mb-1">Uren gewerkt</label>
                    <NumericFieldInput
                      value={urenGewerkt}
                      onChange={setUrenGewerkt}
                      placeholder="Uren gewerkt"
                      readOnly
                    />
                  </div>
                </div>
              )}

              {formTab === 'Documenten' && (
                <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                  <input
                    ref={aanvraagDocumentInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={(event) => void handleDocumentChange('Aanvraag', event)}
                    className="hidden"
                  />
                  <input
                    ref={beschikkingDocumentInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={(event) => void handleDocumentChange('Beschikking', event)}
                    className="hidden"
                  />

                  <div className="md:col-span-6 rounded-lg border border-dc-gray-100 bg-dc-gray-50 p-4">
                    <label className="block text-xs font-medium text-dc-gray-400 mb-2">Aanvraag</label>
                    <div className="flex items-center gap-2">
                      <input
                        value={aanvraagDocumentNaam}
                        readOnly
                        placeholder="Geen PDF gekozen"
                        className="flex-1 rounded-lg border border-dc-gray-200 px-3 py-2 text-sm text-dc-gray-500 bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => openDocumentPicker('Aanvraag')}
                        disabled={uploadingDocument !== null || saving}
                        className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {uploadingDocument === 'Aanvraag' ? 'Uploaden...' : 'Kies PDF'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDocumentOpen('Aanvraag')}
                        disabled={uploadingDocument !== null || (!aanvraagDocumentNaam && !aanvraagDocumentPreviewUrl)}
                        className="px-4 py-2 rounded-lg bg-yellow-400 text-black text-sm font-medium hover:bg-yellow-500 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        Open PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDocumentDelete('Aanvraag')}
                        disabled={uploadingDocument !== null || !aanvraagDocumentNaam}
                        className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        Verwijder PDF
                      </button>
                    </div>
                    {aanvraagDocumentPreviewUrl && (
                      <div className="mt-2 border border-dc-gray-200 rounded-lg p-2 bg-white">
                        <object
                          data={getInlineDocumentPreviewUrl('Aanvraag')}
                          type="application/pdf"
                          className="w-full h-40 rounded border border-dc-gray-200 bg-white"
                        >
                          <div className="text-xs text-dc-gray-400 px-2 py-1">Preview niet beschikbaar</div>
                        </object>
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-6 rounded-lg border border-dc-gray-100 bg-dc-gray-50 p-4">
                    <label className="block text-xs font-medium text-dc-gray-400 mb-2">Beschikking</label>
                    <div className="flex items-center gap-2">
                      <input
                        value={beschikkingDocumentNaam}
                        readOnly
                        placeholder="Geen PDF gekozen"
                        className="flex-1 rounded-lg border border-dc-gray-200 px-3 py-2 text-sm text-dc-gray-500 bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => openDocumentPicker('Beschikking')}
                        disabled={uploadingDocument !== null || saving}
                        className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {uploadingDocument === 'Beschikking' ? 'Uploaden...' : 'Kies PDF'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDocumentOpen('Beschikking')}
                        disabled={uploadingDocument !== null || (!beschikkingDocumentNaam && !beschikkingDocumentPreviewUrl)}
                        className="px-4 py-2 rounded-lg bg-yellow-400 text-black text-sm font-medium hover:bg-yellow-500 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        Open PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDocumentDelete('Beschikking')}
                        disabled={uploadingDocument !== null || !beschikkingDocumentNaam}
                        className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        Verwijder PDF
                      </button>
                    </div>
                    {beschikkingDocumentPreviewUrl && (
                      <div className="mt-2 border border-dc-gray-200 rounded-lg p-2 bg-white">
                        <object
                          data={getInlineDocumentPreviewUrl('Beschikking')}
                          type="application/pdf"
                          className="w-full h-40 rounded border border-dc-gray-200 bg-white"
                        >
                          <div className="text-xs text-dc-gray-400 px-2 py-1">Preview niet beschikbaar</div>
                        </object>
                      </div>
                    )}
                  </div>
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
                      setItemVoorVervallen(currentItem);
                    }
                  }}
                  disabled={Boolean(itemVoorVervallen && deletingId === itemVoorVervallen.id)}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors dc-grid-delete-btn disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {itemVoorVervallen && deletingId === itemVoorVervallen.id ? 'Bezig...' : 'Vervallen'}
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
        open={Boolean(itemVoorVervallen)}
        title="Vervallen"
        message={
          itemVoorVervallen
            ? `Weet je zeker dat je WBSO record "${itemVoorVervallen.referentie || itemVoorVervallen.omschrijving || itemVoorVervallen.jaar || 'onbekend'}" wilt vervallen?`
            : ''
        }
        confirmLabel="Vervallen"
        confirming={itemVoorVervallen ? deletingId === itemVoorVervallen.id : false}
        onCancel={() => setItemVoorVervallen(null)}
        onConfirm={() => void bevestigVervallen()}
      />
    </div>
  );
}
