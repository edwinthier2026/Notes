import { AlertTriangle, ChevronDown, ChevronRight, Download, FileText, Link2, Loader2, Search } from 'lucide-react';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import NinoxStatusPage from './NinoxStatusPage';
import type { VerkoopfactuurAbonnementItem } from '../lib/ninox';
import {
  deleteNinoxVerkoopfactuurAbonnementArtikelRegels,
  fetchNinoxVerkoopfactuurAbonnementen,
  type VerkoopfactuurAbonnementFactuurRecordInput,
  updateNinoxVerkoopfactuurAbonnementFactuurStatus,
} from '../lib/ninox';
import { matchesAllTerms, parseSearchTerms } from '../lib/search';
import { compareStrings, nextSortState, type SortState } from '../lib/sort';
import ComboBox from './ui/ComboBox';
import ConfirmDialog from './ui/ConfirmDialog';
import LoadingSpinner from './ui/LoadingSpinner';
import SortableTh from './ui/SortableTh';
import YesNoSlicer from './ui/YesNoSlicer';

type VerkoopfacturenTab = 'uitlezen-abonnementen' | 'exporteren-exact' | 'status-abonnementen';
type KoppelingenOnderdeel = 'verkopen-naar-exact' | 'ninox-api';
type AbonnementenGridSortKey =
  | 'relatie'
  | 'onderdeel'
  | 'abonnement'
  | 'bedrag'
  | 'startAbonnement'
  | 'stopAbonnement'
  | 'poActie'
  | 'poNummer'
  | 'poGeldigTm'
  | 'factuurPeriode'
  | 'laatsteFactuurdatum'
  | 'laatsteFactuurperiode'
  | 'redenStatus'
  | 'status';

const MAANDEN = [
  'Januari',
  'Februari',
  'Maart',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Augustus',
  'September',
  'Oktober',
  'November',
  'December',
] as const;

const PRINT_STATUS_FILTER_OPTIONS = [
  { value: 'Alles', label: 'Alles' },
  { value: 'Factureren', label: 'Factureren' },
  { value: 'Niet factureren', label: 'Niet factureren' },
  { value: 'Niet actief', label: 'Niet actief' },
  { value: 'Geen telling', label: 'Geen telling' },
  { value: 'Proforma', label: 'Proforma' },
] as const;

const MAANDEN_KLEIN = MAANDEN.map((maand) => maand.toLowerCase());
const MAANDEN_KORT = ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'] as const;

const MAAND_INDEX_BY_LABEL: Record<string, number> = {
  januari: 0,
  jan: 0,
  februari: 1,
  feb: 1,
  maart: 2,
  mrt: 2,
  april: 3,
  apr: 3,
  mei: 4,
  juni: 5,
  jun: 5,
  juli: 6,
  jul: 6,
  augustus: 7,
  aug: 7,
  september: 8,
  sep: 8,
  oktober: 9,
  okt: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
};

function normalizeMonthLabel(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\./g, '');
}

function getMonthIndex(value: string): number | null {
  const normalized = normalizeMonthLabel(value);
  if (!normalized) {
    return null;
  }
  return Object.prototype.hasOwnProperty.call(MAAND_INDEX_BY_LABEL, normalized) ? MAAND_INDEX_BY_LABEL[normalized] : null;
}

function parseDutchDateParts(value: string): { day: number; month: number; year: number } | null {
  const match = String(value || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) {
    return null;
  }
  return {
    day: Number(match[1]),
    month: Number(match[2]) - 1,
    year: Number(match[3]),
  };
}

function normalizePoActie(value: string): string {
  return String(value || '')
    .split('(')[0]
    .trim()
    .toLowerCase();
}

function formatIsoDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseIsoDate(value: string): Date | null {
  const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);

  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
    return null;
  }

  return date;
}

function formatIsoDateToDutch(value: string): string {
  const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return '';
  }
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function formatExactDecimal(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : '0.00';
}

function formatDutchNumber(value: number): string {
  return Number.isFinite(value)
    ? value.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0,00';
}

function escapeCsvValue(value: string): string {
  const text = String(value ?? '');
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function formatTodayDutchDate(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatCurrentDutchDateTime(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

function getPeriodeAfkorting(selectedPeriode: string): string {
  const maandIndex = getMonthIndex(selectedPeriode);
  return maandIndex !== null ? MAANDEN_KORT[maandIndex] : selectedPeriode;
}

function parseFacturenInDeMaandIndexes(value: string): number[] {
  const text = String(value || '').trim();
  if (!text) {
    return [];
  }

  const parts = text
    .split(/[,\n;/|]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const sourceParts = parts.length > 0 ? parts : [text];
  const indexes = sourceParts
    .map((part) => getMonthIndex(part))
    .filter((index): index is number => index !== null);

  return [...new Set(indexes)].sort((a, b) => a - b);
}

function getFacturatieAchterstandStatus(
  item: VerkoopfactuurAbonnementItem,
  selectedJaar: string,
  selectedPeriode: string
): { waarschuwing: boolean; titel: string } {
  const now = new Date();
  const selectedMonthIndex = getMonthIndex(selectedPeriode);
  const selectedYearNumber = Number.parseInt(selectedJaar, 10);
  const currentMonth = selectedMonthIndex ?? now.getMonth();
  const currentYear = Number.isFinite(selectedYearNumber) ? selectedYearNumber : now.getFullYear();
  const startAbonnementParts = parseDutchDateParts(item.startAbonnement);
  const stopAbonnementParts = parseDutchDateParts(item.stopAbonnement);
  const laatsteFactuurperiodeIndex = getMonthIndex(item.laatsteFactuurperiode);
  const laatsteFactuurdatumParts = parseDutchDateParts(item.laatsteFactuurdatum);
  const factuurPeriodeNorm = normalizeMonthLabel(item.factuurPeriode);

  const getDateKey = (parts: { day: number; month: number; year: number } | null): number | null =>
    parts ? parts.year * 10000 + (parts.month + 1) * 100 + parts.day : null;

  const startAbonnementKey = getDateKey(startAbonnementParts);
  const stopAbonnementKey = getDateKey(stopAbonnementParts);

  const isGeldigInGekozenMaand = (): boolean => {
    if (selectedMonthIndex === null || !Number.isFinite(selectedYearNumber)) {
      return false;
    }
    const periodeStartKey = selectedYearNumber * 10000 + (selectedMonthIndex + 1) * 100 + 1;
    const periodeEindDate = new Date(selectedYearNumber, selectedMonthIndex + 1, 0);
    const periodeEindKey =
      periodeEindDate.getFullYear() * 10000 + (periodeEindDate.getMonth() + 1) * 100 + periodeEindDate.getDate();

    return (startAbonnementKey === null || startAbonnementKey <= periodeEindKey) && (stopAbonnementKey === null || stopAbonnementKey >= periodeStartKey);
  };

  const isGeldigInGekozenJaar = (): boolean => {
    if (!Number.isFinite(selectedYearNumber)) {
      return false;
    }
    const jaarStartKey = selectedYearNumber * 10000 + 101;
    const jaarEindKey = selectedYearNumber * 10000 + 1231;
    return (startAbonnementKey === null || startAbonnementKey <= jaarEindKey) && (stopAbonnementKey === null || stopAbonnementKey >= jaarStartKey);
  };

  const isAchterstandVoorPeriodeMaand = (expectedMonthIndex: number, label: string): { waarschuwing: boolean; titel: string } => {
    if (!Number.isFinite(selectedYearNumber) || !isGeldigInGekozenMaand()) {
      return { waarschuwing: false, titel: '' };
    }
    if (selectedMonthIndex !== expectedMonthIndex) {
      return { waarschuwing: false, titel: '' };
    }
    if (laatsteFactuurperiodeIndex !== expectedMonthIndex) {
      return {
        waarschuwing: true,
        titel: `${label} is geldig in ${selectedPeriode} ${selectedYearNumber}, maar Laatste factuurperiode is ${item.laatsteFactuurperiode || '-'}.`,
      };
    }
    return { waarschuwing: false, titel: '' };
  };

  if (factuurPeriodeNorm === 'maand' && selectedMonthIndex !== null) {
    return isAchterstandVoorPeriodeMaand(selectedMonthIndex, 'Maandabonnement');
  }

  if (factuurPeriodeNorm === 'kwartaal (vooraf)' && selectedMonthIndex !== null) {
    const kwartaalStartMaanden = new Set([0, 3, 6, 9]);
    if (!kwartaalStartMaanden.has(selectedMonthIndex)) {
      return { waarschuwing: false, titel: '' };
    }
    return isAchterstandVoorPeriodeMaand(selectedMonthIndex, 'Kwartaalabonnement (vooraf)');
  }

  if (factuurPeriodeNorm === 'kwartaal (achteraf)' && selectedMonthIndex !== null) {
    const kwartaalEindMaanden = new Set([2, 5, 8, 11]);
    if (!kwartaalEindMaanden.has(selectedMonthIndex)) {
      return { waarschuwing: false, titel: '' };
    }
    return isAchterstandVoorPeriodeMaand(selectedMonthIndex, 'Kwartaalabonnement (achteraf)');
  }

  if ((factuurPeriodeNorm === 'half jaar (vooraf)' || factuurPeriodeNorm === 'halfjaar (vooraf)') && selectedMonthIndex !== null) {
    const halfJaarStartMaanden = new Set([0, 6]);
    if (!halfJaarStartMaanden.has(selectedMonthIndex)) {
      return { waarschuwing: false, titel: '' };
    }
    return isAchterstandVoorPeriodeMaand(selectedMonthIndex, 'Halfjaarabonnement (vooraf)');
  }

  if (factuurPeriodeNorm === 'jaar' && Number.isFinite(selectedYearNumber)) {
    if (!isGeldigInGekozenJaar()) {
      return { waarschuwing: false, titel: '' };
    }

    const toekomstigeFactuurperiodeNogNietAanDeBeurt =
      selectedMonthIndex !== null &&
      laatsteFactuurperiodeIndex !== null &&
      laatsteFactuurperiodeIndex > selectedMonthIndex;
    const toekomstigeFactuurmaandNogNietAanDeBeurt =
      selectedMonthIndex !== null &&
      Boolean(laatsteFactuurdatumParts) &&
      laatsteFactuurdatumParts!.year === selectedYearNumber - 1 &&
      laatsteFactuurdatumParts!.month > selectedMonthIndex;

    if (toekomstigeFactuurperiodeNogNietAanDeBeurt || toekomstigeFactuurmaandNogNietAanDeBeurt) {
      return { waarschuwing: false, titel: '' };
    }

    if (laatsteFactuurdatumParts?.year !== selectedYearNumber) {
      return {
        waarschuwing: true,
        titel: `Jaarabonnement is geldig in ${selectedYearNumber}, maar Factuurdatum valt in ${laatsteFactuurdatumParts?.year || '-'}.`,
      };
    }

    return { waarschuwing: false, titel: '' };
  }

  const geplandeMaanden = parseFacturenInDeMaandIndexes(item.facturenInDeMaand);
  if (geplandeMaanden.length === 0) {
    return { waarschuwing: false, titel: '' };
  }

  const maandenTotNu = geplandeMaanden.filter((month) => month <= currentMonth);
  const expectedMonth = maandenTotNu.length > 0 ? maandenTotNu[maandenTotNu.length - 1] : geplandeMaanden[geplandeMaanden.length - 1];
  const expectedYear = maandenTotNu.length > 0 ? currentYear : currentYear - 1;
  const expectedSerial = expectedYear * 12 + expectedMonth;

  if (startAbonnementParts) {
    const startSerial = startAbonnementParts.year * 12 + startAbonnementParts.month;
    if (startSerial > expectedSerial) {
      return { waarschuwing: false, titel: '' };
    }
  }

  if (laatsteFactuurperiodeIndex === null || !laatsteFactuurdatumParts) {
    return {
      waarschuwing: true,
      titel: `Lijkt achter te lopen: verwacht facturatie t/m ${MAANDEN[expectedMonth]} ${expectedYear}, maar laatste factuurgegevens zijn onvolledig.`,
    };
  }

  const actualSerial = laatsteFactuurdatumParts.year * 12 + laatsteFactuurperiodeIndex;
  if (actualSerial < expectedSerial) {
    return {
      waarschuwing: true,
      titel: `Lijkt achter te lopen: verwacht t/m ${MAANDEN[expectedMonth]} ${expectedYear}, laatste factuur is ${item.laatsteFactuurperiode || '-'} ${laatsteFactuurdatumParts.year}.`,
    };
  }

  return { waarschuwing: false, titel: '' };
}

function isAparteFactuurUit(value: string): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '' || normalized === 'nee' || normalized === 'false' || normalized === '0';
}

function isEenmaligFacturerenAan(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value === 1;
  }
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'ja' || normalized === 'yes' || normalized === '1' || normalized === 'true';
}

function usesResourceTelling(value: string): boolean {
  const normalized = normalizeMonthLabel(value);
  return normalized.includes('resource');
}

function isPeilstokAbonnement(value: string): boolean {
  const normalized = normalizeMonthLabel(value);
  return (
    normalized === 'peilstok zonder po' ||
    normalized === 'peilstok met po' ||
    normalized === 'peilstok met proforma po'
  );
}

function isHandmatigSelecteerbareAbonnement(_item: VerkoopfactuurAbonnementItem): boolean {
  return true;
}

function getResolvedArtikelregelAantal(
  item: VerkoopfactuurAbonnementItem,
  artikelregel: VerkoopfactuurAbonnementItem['artikelregels'][number],
  selectedPeriode: string
): number {
  if (!usesResourceTelling(artikelregel.telling)) {
    return artikelregel.aantal;
  }

  const maandIndex = getMonthIndex(selectedPeriode);
  if (maandIndex === null) {
    return 0;
  }

  const periodeCode = MAANDEN_KORT[maandIndex].toLowerCase();
  if (Object.prototype.hasOwnProperty.call(item.tellingPerCode, periodeCode)) {
    return item.tellingPerCode[periodeCode] ?? 0;
  }

  return item.tellingPerMaand[maandIndex] ?? 0;
}

function isKwartaalFactuurPeriode(value: string): boolean {
  const normalized = normalizeMonthLabel(value);
  return normalized === 'kwartaal (vooraf)' || normalized === 'kwartaal (achteraf)';
}

function isJaarFactuurPeriode(value: string): boolean {
  return normalizeMonthLabel(value) === 'jaar';
}

function isHalfJaarFactuurPeriode(value: string): boolean {
  const normalized = normalizeMonthLabel(value);
  return normalized === 'half jaar (vooraf)' || normalized === 'halfjaar (vooraf)';
}

function getFactureerbaarArtikelregelAantal(
  item: VerkoopfactuurAbonnementItem,
  artikelregel: VerkoopfactuurAbonnementItem['artikelregels'][number],
  selectedPeriode: string,
  actieveMaanden: number | null = null
): number {
  const basisAantal = getResolvedArtikelregelAantal(item, artikelregel, selectedPeriode);
  if (isKwartaalFactuurPeriode(item.factuurPeriode)) {
    const factor = actieveMaanden && actieveMaanden > 0 ? actieveMaanden : 3;
    return basisAantal * factor;
  }
  if (isHalfJaarFactuurPeriode(item.factuurPeriode)) {
    return basisAantal * 6;
  }
  if (isJaarFactuurPeriode(item.factuurPeriode)) {
    return basisAantal * 12;
  }
  return basisAantal;
}

function buildArtikelOmschrijving(omschrijving: string, onderdeel: string): string {
  const basis = String(omschrijving || '').trim();
  const suffix = String(onderdeel || '').trim();
  if (!suffix) {
    return basis;
  }
  return `${basis} (${suffix})`.trim();
}

function truncateExactOmschrijving(value: string): string {
  return String(value || '').slice(0, 60);
}

function getExportPeriodeRange(factuurPeriode: string, selectedPeriode: string, selectedJaar: string): { start: string; end: string } {
  const periodeNorm = normalizeMonthLabel(factuurPeriode);
  const maandIndex = getMonthIndex(selectedPeriode);
  const jaar = Number.parseInt(selectedJaar, 10);
  if (maandIndex === null || !Number.isFinite(jaar)) {
    return { start: '', end: '' };
  }

  if (periodeNorm === 'maand') {
    const start = new Date(jaar, maandIndex, 1);
    const end = new Date(jaar, maandIndex + 1, 0);
    return { start: formatIsoDate(start), end: formatIsoDate(end) };
  }

  if (periodeNorm === 'kwartaal (achteraf)') {
    const start = new Date(jaar, maandIndex - 2, 1);
    const end = new Date(jaar, maandIndex + 1, 0);
    return { start: formatIsoDate(start), end: formatIsoDate(end) };
  }

  if (periodeNorm === 'kwartaal (vooraf)') {
    const start = new Date(jaar, maandIndex, 1);
    const end = new Date(jaar, maandIndex + 3, 0);
    return { start: formatIsoDate(start), end: formatIsoDate(end) };
  }

  if (periodeNorm === 'jaar') {
    return {
      start: formatIsoDate(new Date(jaar, 0, 1)),
      end: formatIsoDate(new Date(jaar, 12, 0)),
    };
  }

  return { start: '', end: '' };
}

function getKwartaalMaandStarts(factuurPeriode: string, selectedPeriode: string, selectedJaar: string): string[] {
  const periodeNorm = normalizeMonthLabel(factuurPeriode);
  const maandIndex = getMonthIndex(selectedPeriode);
  const jaar = Number.parseInt(selectedJaar, 10);
  if (maandIndex === null || !Number.isFinite(jaar)) {
    return [];
  }

  if (periodeNorm === 'kwartaal (achteraf)') {
    return [
      formatIsoDate(new Date(jaar, maandIndex - 2, 1)),
      formatIsoDate(new Date(jaar, maandIndex - 1, 1)),
      formatIsoDate(new Date(jaar, maandIndex, 1)),
    ];
  }

  if (periodeNorm === 'kwartaal (vooraf)') {
    return [
      formatIsoDate(new Date(jaar, maandIndex, 1)),
      formatIsoDate(new Date(jaar, maandIndex + 1, 1)),
      formatIsoDate(new Date(jaar, maandIndex + 2, 1)),
    ];
  }

  return [];
}

function getArtikelregelPeriodeOverlap(
  factuurPeriode: string,
  selectedPeriode: string,
  selectedJaar: string,
  startActief: string,
  stopActief: string,
  periodeStart: string,
  periodeEind: string
): { actief: boolean; start: string; end: string; actieveMaanden: number } {
  const start = String(startActief || '').trim();
  const stop = String(stopActief || '').trim();
  const startPeriode = String(periodeStart || '').trim();
  const eindPeriode = String(periodeEind || '').trim();

  if (!startPeriode || !eindPeriode) {
    return {
      actief: true,
      start,
      end: stop,
      actieveMaanden: 0,
    };
  }

  const kwartaalMaanden = getKwartaalMaandStarts(factuurPeriode, selectedPeriode, selectedJaar);
  if (kwartaalMaanden.length > 0 && (start || stop)) {
    const actieveMaandenLijst = kwartaalMaanden.filter((maandStart) => {
      const maandStartDate = parseIsoDate(maandStart);
      if (!maandStartDate) {
        return false;
      }
      const maandEind = formatIsoDate(new Date(maandStartDate.getFullYear(), maandStartDate.getMonth() + 1, 0));
      const voldoetAanStart = !start || start <= maandEind;
      const voldoetAanStop = !stop || stop >= maandStart;
      return voldoetAanStart && voldoetAanStop;
    });

    if (actieveMaandenLijst.length === 0) {
      return {
        actief: false,
        start: '',
        end: '',
        actieveMaanden: 0,
      };
    }

    const eersteMaand = actieveMaandenLijst[0];
    const laatsteMaand = actieveMaandenLijst[actieveMaandenLijst.length - 1];
    const laatsteMaandDate = parseIsoDate(laatsteMaand);
    const laatsteDagLaatsteMaand = laatsteMaandDate
      ? formatIsoDate(new Date(laatsteMaandDate.getFullYear(), laatsteMaandDate.getMonth() + 1, 0))
      : laatsteMaand;
    const effectieveStart = start && start > eersteMaand ? start : eersteMaand;
    const effectieveEind = stop && stop < laatsteDagLaatsteMaand ? stop : laatsteDagLaatsteMaand;

    return {
      actief: true,
      start: effectieveStart,
      end: effectieveEind,
      actieveMaanden: actieveMaandenLijst.length,
    };
  }

  const effectieveStart = start && start > startPeriode ? start : startPeriode;
  const effectieveEind = stop && stop < eindPeriode ? stop : eindPeriode;

  if (effectieveStart > effectieveEind) {
    return {
      actief: false,
      start: '',
      end: '',
      actieveMaanden: 0,
    };
  }

  return {
    actief: true,
    start: effectieveStart,
    end: effectieveEind,
    actieveMaanden: 0,
  };
}

function getExportTitel(factuurPeriode: string, selectedPeriode: string, selectedJaar: string): string {
  const periodeNorm = normalizeMonthLabel(factuurPeriode);
  const maandIndex = getMonthIndex(selectedPeriode);
  const jaar = String(selectedJaar || '').trim();

  if (periodeNorm === 'maand' && maandIndex !== null) {
    return `Uw abonnement voor de maand ${MAANDEN_KLEIN[maandIndex]} ${jaar}`;
  }

  if (periodeNorm === 'jaar') {
    if (maandIndex !== null) {
      const startJaar = Number.parseInt(selectedJaar, 10);
      if (Number.isFinite(startJaar)) {
        const eindDatum = new Date(startJaar, maandIndex + 13, 1);
        return `Uw abonnement over de periode ${MAANDEN[maandIndex]} ${startJaar} t/m ${MAANDEN[eindDatum.getMonth()]} ${eindDatum.getFullYear()}`;
      }
    }
    return `Uw abonnement voor het jaar ${jaar}`;
  }

  const kwartaalPreview = getKwartaalPreviewTitles(selectedPeriode, selectedJaar);

  if (periodeNorm === 'kwartaal (achteraf)') {
    return kwartaalPreview.achteraf;
  }

  if (periodeNorm === 'kwartaal (vooraf)') {
    return kwartaalPreview.vooraf;
  }

  return `Uw abonnement ${selectedPeriode ? `voor ${selectedPeriode.toLowerCase()} ` : ''}${jaar}`.trim();
}

function getKwartaalPreviewTitles(selectedPeriode: string, selectedJaar: string): {
  vooraf: string;
  achteraf: string;
} {
  const maandIndex = getMonthIndex(selectedPeriode);
  const jaar = String(selectedJaar || '').trim();
  if (maandIndex === null) {
    return {
      vooraf: 'Niet van toepassing bij gekozen periode',
      achteraf: 'Niet van toepassing bij gekozen periode',
    };
  }

  if ([2, 5, 8, 11].includes(maandIndex)) {
    const kwartaalStartIndex = maandIndex - 2;
    const achterafTekst = `${MAANDEN_KORT[kwartaalStartIndex]}-${MAANDEN_KORT[kwartaalStartIndex + 1]}-${MAANDEN_KORT[maandIndex]}${jaar ? ` ${jaar}` : ''}`;
    return {
      vooraf: 'Niet van toepassing bij gekozen periode',
      achteraf: `Uw abonnement voor de periode ${achterafTekst}`,
    };
  }

  if ([0, 3, 6, 9].includes(maandIndex)) {
    const voorafTekst = `${MAANDEN_KORT[maandIndex]}-${MAANDEN_KORT[maandIndex + 1]}-${MAANDEN_KORT[maandIndex + 2]}${jaar ? ` ${jaar}` : ''}`;
    return {
      vooraf: `Uw abonnement voor de periode ${voorafTekst}`,
      achteraf: 'Niet van toepassing bij gekozen periode',
    };
  }

  return {
    vooraf: 'Niet van toepassing bij gekozen periode',
    achteraf: 'Niet van toepassing bij gekozen periode',
  };
}

type AbonnementMetStatus = VerkoopfactuurAbonnementItem & {
  redenStatus: string;
  bedrag: number;
};

type ExactFactuurGroep = {
  factuurPeriode: string;
  debiteurennummerExact: string;
  poNummer: string;
  items: AbonnementMetStatus[];
};

type ExactExportRegel = {
  item: AbonnementMetStatus;
  artikelregel: VerkoopfactuurAbonnementItem['artikelregels'][number];
  range: { start: string; end: string };
  actieveMaanden: number;
};

type ExactExportGroep = ExactFactuurGroep & {
  titel: string;
  range: { start: string; end: string };
  actieveRegels: ExactExportRegel[];
  totaalBedragExclusiefBtw: number;
  csvRegels: string[];
};

type ExactTreeAbonnement = {
  item: AbonnementMetStatus;
  range: { start: string; end: string };
  periodeCode: string;
  regels: Array<
    VerkoopfactuurAbonnementItem['artikelregels'][number] & {
      bronAantal: number;
      basisAantal: number;
      tellingWaarde: number;
      exportStart: string;
      exportEnd: string;
      actieveMaanden: number;
      bedrag: number;
    }
  >;
};

export default function VerkoopfacturenPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab');
  const onderdeel = searchParams.get('onderdeel');
  const activeOnderdeel: KoppelingenOnderdeel =
    onderdeel === 'ninox-api' || onderdeel === 'verkopen-naar-exact' ? onderdeel : 'verkopen-naar-exact';
  const activeTab: VerkoopfacturenTab =
    tab === 'exporteren-exact' || tab === 'status-abonnementen' ? tab : 'uitlezen-abonnementen';
  const huidigeJaar = new Date().getFullYear();
  const jaarOpties = useMemo(
    () => [String(huidigeJaar - 1), String(huidigeJaar), String(huidigeJaar + 1)],
    [huidigeJaar]
  );

  const [selectedJaar, setSelectedJaar] = useState(String(huidigeJaar));
  const [selectedPeriode, setSelectedPeriode] = useState('');
  const [readingAbonnementen, setReadingAbonnementen] = useState(false);
  const [printingOverview, setPrintingOverview] = useState(false);
  const [printStatusFilter, setPrintStatusFilter] = useState<(typeof PRINT_STATUS_FILTER_OPTIONS)[number]['value']>('Alles');
  const [buildingExactPreview, setBuildingExactPreview] = useState(false);
  const [generatingExactCsv, setGeneratingExactCsv] = useState(false);
  const [exactExportProgress, setExactExportProgress] = useState({ current: 0, total: 0, label: '' });
  const [abonnementen, setAbonnementen] = useState<VerkoopfactuurAbonnementItem[]>([]);
  const [abonnementenFout, setAbonnementenFout] = useState('');
  const [abonnementenLoaded, setAbonnementenLoaded] = useState(false);
  const [exactFout, setExactFout] = useState('');
  const [exactPreview, setExactPreview] = useState('');
  const [confirmExportOpen, setConfirmExportOpen] = useState(false);
  const [exactZoek, setExactZoek] = useState('');
  const [zoek, setZoek] = useState('');
  const [statusAbonnementenZoek, setStatusAbonnementenZoek] = useState('');
  const [alleenErrorsTonen, setAlleenErrorsTonen] = useState(false);
  const [sort, setSort] = useState<SortState<AbonnementenGridSortKey>>({ key: 'relatie', direction: 'asc' });
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [openExactAbonnementen, setOpenExactAbonnementen] = useState<Record<number, boolean>>({});
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  const openTab = (nextTab: VerkoopfacturenTab) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('onderdeel', activeOnderdeel);
    nextParams.set('tab', nextTab);
    setSearchParams(nextParams);
  };

  const openOnderdeel = (nextOnderdeel: KoppelingenOnderdeel) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('onderdeel', nextOnderdeel);
    if (nextOnderdeel === 'verkopen-naar-exact' && !nextParams.get('tab')) {
      nextParams.set('tab', 'uitlezen-abonnementen');
    }
    if (nextOnderdeel === 'ninox-api') {
      nextParams.delete('tab');
    }
    setSearchParams(nextParams);
  };

  const onderdeelButtonClass = (onderdeelNaam: KoppelingenOnderdeel) =>
    `w-full text-left rounded-lg border px-4 py-3 transition-colors ${
      activeOnderdeel === onderdeelNaam
        ? 'border-dc-blue-500 bg-dc-blue-50'
        : 'border-dc-gray-100 hover:border-dc-blue-200 hover:bg-dc-blue-50/40'
    }`;

  const tabButtonClass = (tabName: VerkoopfacturenTab) =>
    `w-full text-left rounded-lg border px-4 py-3 transition-colors ${
      activeTab === tabName
        ? 'border-dc-blue-500 bg-dc-blue-50'
        : 'border-dc-gray-100 hover:border-dc-blue-200 hover:bg-dc-blue-50/40'
    }`;

  const handleLeesAbonnementen = async () => {
    setReadingAbonnementen(true);
    setAbonnementenFout('');
    try {
      const data = await fetchNinoxVerkoopfactuurAbonnementen();
      setAbonnementen(data);
      setAbonnementenLoaded(true);
      setSelectedIds([]);
    } catch (error) {
      setAbonnementen([]);
      setAbonnementenLoaded(true);
      setSelectedIds([]);
      setAbonnementenFout(error instanceof Error ? error.message : 'Inlezen abonnementen mislukt.');
    } finally {
      setReadingAbonnementen(false);
    }
  };

  const abonnementenMetStatus = useMemo<AbonnementMetStatus[]>(() => {
    const selectedYearNumber = Number.parseInt(selectedJaar, 10);
    const selectedMonthIndex = getMonthIndex(selectedPeriode);

    return abonnementen.map((item) => {
      let status: VerkoopfactuurAbonnementItem['status'] = 'Niet factureren';
      let redenStatus = '';
      const factuurPeriodeNormalized = normalizeMonthLabel(item.factuurPeriode);
      const startAbonnementParts = parseDutchDateParts(item.startAbonnement);
      const stopAbonnementParts = parseDutchDateParts(item.stopAbonnement);
      const poGeldigTmParts = parseDutchDateParts(item.poGeldigTm);
      const poActieNormalized = normalizePoActie(item.poActie);
      const relatieIsKlant = normalizeMonthLabel(item.relatieType) === 'klant';
      const abonnementIsActief = normalizeMonthLabel(item.statusAbonnement) === 'actief';
      const peilstokAbonnement = isPeilstokAbonnement(item.abonnement);
      const maandPeriodeCode =
        selectedMonthIndex !== null && selectedMonthIndex >= 0 && selectedMonthIndex < MAANDEN_KORT.length
          ? MAANDEN_KORT[selectedMonthIndex].toLowerCase()
          : '';
      const geselecteerdeTelling =
        maandPeriodeCode && Object.prototype.hasOwnProperty.call(item.tellingPerCode, maandPeriodeCode)
          ? item.tellingPerCode[maandPeriodeCode] ?? 0
          : selectedMonthIndex !== null
            ? item.tellingPerMaand[selectedMonthIndex] ?? 0
            : 0;
      const today = new Date();
      const todayKey = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
      const poIsVerlopen = poGeldigTmParts
        ? poGeldigTmParts.year * 10000 + (poGeldigTmParts.month + 1) * 100 + poGeldigTmParts.day < todayKey
        : false;
      const startAbonnementKey = startAbonnementParts
        ? startAbonnementParts.year * 10000 + (startAbonnementParts.month + 1) * 100 + startAbonnementParts.day
        : null;
      const stopAbonnementKey = stopAbonnementParts
        ? stopAbonnementParts.year * 10000 + (stopAbonnementParts.month + 1) * 100 + stopAbonnementParts.day
        : null;
      const periodeStartKey =
        selectedMonthIndex !== null && Number.isFinite(selectedYearNumber) ? selectedYearNumber * 10000 + (selectedMonthIndex + 1) * 100 + 1 : null;
      const periodeEindDate =
        selectedMonthIndex !== null && Number.isFinite(selectedYearNumber)
          ? new Date(selectedYearNumber, selectedMonthIndex + 1, 0)
          : null;
      const periodeEindKey = periodeEindDate
        ? periodeEindDate.getFullYear() * 10000 + (periodeEindDate.getMonth() + 1) * 100 + periodeEindDate.getDate()
        : null;
      const startLigtBuitenPeriode = periodeEindKey !== null && startAbonnementKey !== null ? startAbonnementKey > periodeEindKey : true;
      const stopLigtBuitenPeriode = periodeStartKey !== null && stopAbonnementKey !== null ? stopAbonnementKey < periodeStartKey : false;
      const range = getExportPeriodeRange(item.factuurPeriode, selectedPeriode, selectedJaar);
      const bedrag = item.artikelregels
        .map((artikelregel) => ({
          artikelregel,
          overlap: getArtikelregelPeriodeOverlap(
            item.factuurPeriode,
            selectedPeriode,
            selectedJaar,
            artikelregel.startActief,
            artikelregel.stopActief,
            range.start,
            range.end
          ),
        }))
        .filter(({ overlap }) => overlap.actief)
        .reduce((sum, { artikelregel, overlap }) => {
          const aantal = getFactureerbaarArtikelregelAantal(item, artikelregel, selectedPeriode, overlap.actieveMaanden);
          return sum + aantal * artikelregel.prijsPerEenheid;
        }, 0);
      const buildAbonnementMetStatus = (
        nextStatus: VerkoopfactuurAbonnementItem['status'],
        nextRedenStatus: string
      ): AbonnementMetStatus => ({
        ...item,
        status: nextStatus,
        redenStatus: nextRedenStatus,
        bedrag,
      });

      if (!relatieIsKlant || !abonnementIsActief || startLigtBuitenPeriode || stopLigtBuitenPeriode) {
        if (!relatieIsKlant) {
          redenStatus = 'Relatie is geen klant';
        } else if (!abonnementIsActief) {
          redenStatus = 'Status abonnement is niet Actief';
        } else if (startLigtBuitenPeriode) {
          redenStatus = 'Start abonnement ligt buiten gekozen periode';
        } else if (stopLigtBuitenPeriode) {
          redenStatus = 'Stop abonnement ligt buiten gekozen periode';
        }
        return buildAbonnementMetStatus('Niet actief', redenStatus);
      }

      if (selectedMonthIndex !== null && peilstokAbonnement && geselecteerdeTelling === 0) {
        return buildAbonnementMetStatus('Geen telling', `Geen telling in Telling ${MAANDEN_KORT[selectedMonthIndex].toLowerCase()}`);
      }

      if (poIsVerlopen) {
        redenStatus = 'PO geldig t/m is verlopen';
        return buildAbonnementMetStatus(status, redenStatus);
      }

      if (poActieNormalized === 'per jaar ntt via proforma') {
        const isMaart = selectedMonthIndex === 2;
        const poLooptTotInGekozenPeriode =
          poGeldigTmParts &&
          selectedMonthIndex !== null &&
          Number.isFinite(selectedYearNumber) &&
          (poGeldigTmParts.year > selectedYearNumber ||
            (poGeldigTmParts.year === selectedYearNumber && poGeldigTmParts.month >= selectedMonthIndex));

        if (isMaart && poLooptTotInGekozenPeriode) {
          return buildAbonnementMetStatus('Proforma', 'NTT via proforma in maart met geldige PO');
        }

        return buildAbonnementMetStatus(status, 'NTT via proforma alleen factureerbaar in maart met geldige PO');
      }

      const ondersteundeStatusRoute =
        factuurPeriodeNormalized === 'maand' ||
        factuurPeriodeNormalized === 'kwartaal (vooraf)' ||
        factuurPeriodeNormalized === 'kwartaal (achteraf)' ||
        factuurPeriodeNormalized === 'half jaar (vooraf)' ||
        factuurPeriodeNormalized === 'halfjaar (vooraf)' ||
        factuurPeriodeNormalized === 'jaar';

      if (ondersteundeStatusRoute) {
        const facturatieStatus = getFacturatieAchterstandStatus(item, selectedJaar, selectedPeriode);
        if (facturatieStatus.waarschuwing) {
          status = 'Factureren';
          redenStatus = facturatieStatus.titel || 'Factureren volgens statuscontrole';
        } else {
          redenStatus = `Nog niet aan ${item.factuurPeriode || 'factuurvoorwaarden'} voldaan`;
        }
      }

      if (status === 'Factureren') {
        const eindVanGekozenJaar = Number.isFinite(selectedYearNumber)
          ? selectedYearNumber * 10000 + 1231
          : null;
        const poGeldigTotEindeJaar =
          eindVanGekozenJaar !== null && poGeldigTmParts
            ? poGeldigTmParts.year * 10000 + (poGeldigTmParts.month + 1) * 100 + poGeldigTmParts.day >= eindVanGekozenJaar
            : false;

        if (poActieNormalized === 'voor elke factuur opnieuw aanvragen') {
          status = 'Aanvragen';
          redenStatus = 'PO actie vereist nieuwe aanvraag per factuur';
        } else if (
          poActieNormalized === 'voor elke factuur opnieuw aanvragen via proforma' ||
          poActieNormalized === 'per jaar ntt via proforma'
        ) {
          status = 'Proforma';
          redenStatus = 'PO actie vereist proforma';
        } else if (poActieNormalized === 'nog niet bekend') {
          status = 'Onbekend';
          redenStatus = 'PO actie staat op Nog niet bekend';
        } else if (
          poActieNormalized === 'per kalenderjaar' ||
          poActieNormalized === 'per kalenderjaar met telling juni en december' ||
          poActieNormalized === 'per kalenderjaar met telling in december'
        ) {
          if (!poGeldigTotEindeJaar) {
            status = 'Niet factureren';
            redenStatus = 'PO geldig t/m loopt niet tot einde gekozen jaar';
          } else {
            redenStatus = 'PO geldig t/m loopt tot einde gekozen jaar';
          }
        } else if (poActieNormalized === 'geen') {
          redenStatus = 'Geen extra PO-actie nodig';
        } else if (poActieNormalized.includes('doorlopend')) {
          redenStatus = 'Doorlopende PO zonder extra actie';
        }
      }

      return buildAbonnementMetStatus(status, redenStatus);
    });
  }, [abonnementen, selectedJaar, selectedPeriode]);

  const sortedAbonnementen = useMemo(() => {
    return [...abonnementenMetStatus].sort((a, b) => {
      if (sort.key === 'relatie') {
        return compareStrings(a.relatie || '', b.relatie || '', sort.direction);
      }
      if (sort.key === 'onderdeel') {
        return compareStrings(a.onderdeel || '', b.onderdeel || '', sort.direction);
      }
      if (sort.key === 'abonnement') {
        return compareStrings(a.abonnement || '', b.abonnement || '', sort.direction);
      }
      if (sort.key === 'bedrag') {
        const difference = a.bedrag - b.bedrag;
        return sort.direction === 'asc' ? difference : -difference;
      }
      if (sort.key === 'startAbonnement') {
        return compareStrings(a.startAbonnement || '', b.startAbonnement || '', sort.direction);
      }
      if (sort.key === 'stopAbonnement') {
        return compareStrings(a.stopAbonnement || '', b.stopAbonnement || '', sort.direction);
      }
      if (sort.key === 'poActie') {
        return compareStrings(a.poActie || '', b.poActie || '', sort.direction);
      }
      if (sort.key === 'poNummer') {
        return compareStrings(a.poNummer || '', b.poNummer || '', sort.direction);
      }
      if (sort.key === 'poGeldigTm') {
        return compareStrings(a.poGeldigTm || '', b.poGeldigTm || '', sort.direction);
      }
      if (sort.key === 'factuurPeriode') {
        return compareStrings(a.factuurPeriode || '', b.factuurPeriode || '', sort.direction);
      }
      if (sort.key === 'laatsteFactuurdatum') {
        return compareStrings(a.laatsteFactuurdatum || '', b.laatsteFactuurdatum || '', sort.direction);
      }
      if (sort.key === 'laatsteFactuurperiode') {
        return compareStrings(a.laatsteFactuurperiode || '', b.laatsteFactuurperiode || '', sort.direction);
      }
      if (sort.key === 'redenStatus') {
        return compareStrings(a.redenStatus || '', b.redenStatus || '', sort.direction);
      }
      return compareStrings(a.status || '', b.status || '', sort.direction);
    });
  }, [abonnementenMetStatus, sort]);

  const filteredAbonnementen = useMemo(() => {
    const terms = parseSearchTerms(zoek);
    if (terms.length === 0) {
      return sortedAbonnementen;
    }
    return sortedAbonnementen.filter((item) =>
      matchesAllTerms(
        [
          item.relatie,
          item.onderdeel,
          item.abonnement,
          formatDutchNumber(item.bedrag),
          item.startAbonnement,
          item.stopAbonnement,
          item.poActie,
          item.poNummer,
          item.poGeldigTm,
          item.factuurPeriode,
          item.laatsteFactuurdatum,
          item.laatsteFactuurperiode,
          item.redenStatus,
          item.status,
        ].join(' '),
        terms
      )
    );
  }, [sortedAbonnementen, zoek]);

  const filteredStatusAbonnementen = useMemo(() => {
    const terms = parseSearchTerms(statusAbonnementenZoek);

    return abonnementen
      .filter((item) => normalizeMonthLabel(item.statusAbonnement) === 'actief')
      .filter((item) => !alleenErrorsTonen || getFacturatieAchterstandStatus(item, selectedJaar, selectedPeriode).waarschuwing)
      .filter((item) =>
        matchesAllTerms(
          [
            item.relatie,
            item.onderdeel,
            item.statusInfo,
            item.abonnement,
            item.laatsteFactuurdatum,
            item.laatsteFactuurperiode,
            item.facturenInDeMaand,
            item.factuurPeriode,
            item.statusAbonnement,
          ].join(' '),
          terms
        )
      )
      .sort((a, b) => {
        const relatieCompare = compareStrings(a.relatie || '', b.relatie || '', 'asc');
        if (relatieCompare !== 0) {
          return relatieCompare;
        }

        const onderdeelCompare = compareStrings(a.onderdeel || '', b.onderdeel || '', 'asc');
        if (onderdeelCompare !== 0) {
          return onderdeelCompare;
        }

        const abonnementCompare = compareStrings(a.abonnement || '', b.abonnement || '', 'asc');
        if (abonnementCompare !== 0) {
          return abonnementCompare;
        }

        return compareStrings(a.laatsteFactuurdatum || '', b.laatsteFactuurdatum || '', 'asc');
      });
  }, [abonnementen, alleenErrorsTonen, selectedJaar, selectedPeriode, statusAbonnementenZoek]);

  const selectableFilteredIds = useMemo(
    () => filteredAbonnementen.filter((item) => item.status === 'Factureren').map((item) => item.id),
    [filteredAbonnementen]
  );
  const printFilteredAbonnementen = useMemo(
    () =>
      printStatusFilter === 'Alles'
        ? filteredAbonnementen
        : filteredAbonnementen.filter((item) => item.status === printStatusFilter),
    [filteredAbonnementen, printStatusFilter]
  );
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const geselecteerdeAbonnementen = useMemo(
    () => abonnementenMetStatus.filter((item) => selectedIdSet.has(item.id)),
    [abonnementenMetStatus, selectedIdSet]
  );
  const exportTitelPreview = useMemo(() => {
    const eerste = geselecteerdeAbonnementen[0];
    if (!eerste) {
      return '';
    }
    return getExportTitel(eerste.factuurPeriode, selectedPeriode, selectedJaar);
  }, [geselecteerdeAbonnementen, selectedPeriode, selectedJaar]);
  const exactFactuurGroepen = useMemo<ExactFactuurGroep[]>(() => {
    const groups = new Map<string, ExactFactuurGroep>();

    geselecteerdeAbonnementen.forEach((item) => {
      const magSamen =
        isAparteFactuurUit(item.aparteFactuur) &&
        Boolean(item.debiteurennummerExact.trim()) &&
        Boolean(item.poNummer.trim()) &&
        Boolean(item.factuurPeriode.trim());
      const groupKey = magSamen
        ? `${item.debiteurennummerExact}__${item.poNummer}__${item.factuurPeriode}`
        : `single__${item.id}`;

      const existing = groups.get(groupKey);
      if (existing) {
        existing.items.push(item);
        return;
      }

      groups.set(groupKey, {
        factuurPeriode: item.factuurPeriode,
        debiteurennummerExact: item.debiteurennummerExact,
        poNummer: item.poNummer,
        items: [item],
      });
    });

    return Array.from(groups.values());
  }, [geselecteerdeAbonnementen]);
  const exactExportGroepen = useMemo<ExactExportGroep[]>(() => {
    return exactFactuurGroepen
      .map((groep) => {
        const titel = getExportTitel(groep.factuurPeriode, selectedPeriode, selectedJaar);
        const range = getExportPeriodeRange(groep.factuurPeriode, selectedPeriode, selectedJaar);
        const actieveRegels = groep.items.flatMap((item) =>
          item.artikelregels
            .map((artikelregel) => ({
              item,
              artikelregel,
              overlap: getArtikelregelPeriodeOverlap(
                item.factuurPeriode,
                selectedPeriode,
                selectedJaar,
                artikelregel.startActief,
                artikelregel.stopActief,
                range.start,
                range.end
              ),
            }))
            .filter(({ overlap }) => overlap.actief)
            .map(({ item: currentItem, artikelregel, overlap }) => ({
              item: currentItem,
              artikelregel,
              range: { start: overlap.start, end: overlap.end },
              actieveMaanden: overlap.actieveMaanden,
            }))
        );

        const csvRegels: string[] = [];
        const totaalBedragExclusiefBtw = actieveRegels.reduce((sum, { item, artikelregel, actieveMaanden }) => {
          const aantal = getFactureerbaarArtikelregelAantal(item, artikelregel, selectedPeriode, actieveMaanden);
          return sum + aantal * artikelregel.prijsPerEenheid;
        }, 0);
        if (actieveRegels.length > 0) {
          csvRegels.push(
            [
              '[F]',
              escapeCsvValue(groep.debiteurennummerExact || ''),
              escapeCsvValue(groep.poNummer || ''),
              escapeCsvValue(titel),
            ].join(',')
          );

          let csvRegelIndex = 0;
          groep.items.forEach((item) => {
            const itemRegels = actieveRegels.filter((regel) => regel.item.id === item.id);
            if (itemRegels.length === 0) {
              return;
            }

            if (item.artikelenVerdichtenTot1Factuurregel) {
              const totaalBedragItem = itemRegels.reduce((sum, { item: currentItem, artikelregel, actieveMaanden }) => {
                const aantal = getFactureerbaarArtikelregelAantal(currentItem, artikelregel, selectedPeriode, actieveMaanden);
                return sum + aantal * artikelregel.prijsPerEenheid;
              }, 0);
              const itemStart = itemRegels
                .map(({ range: regelRange }) => regelRange.start)
                .filter((value) => Boolean(value))
                .sort()[0] || range.start;
              const itemEnd = itemRegels
                .map(({ range: regelRange }) => regelRange.end)
                .filter((value) => Boolean(value))
                .sort();
              const laatsteItemEnd = itemEnd.length > 0 ? itemEnd[itemEnd.length - 1] : range.end;

              csvRegelIndex += 1;
              csvRegels.push(
                [
                  `[R${csvRegelIndex}]`,
                  escapeCsvValue(item.artikelnummerVerdichtExact || ''),
                  escapeCsvValue(truncateExactOmschrijving(item.factuurtekst || buildArtikelOmschrijving(item.abonnement, item.onderdeel))),
                  escapeCsvValue(formatIsoDateToDutch(itemStart)),
                  escapeCsvValue(formatIsoDateToDutch(laatsteItemEnd)),
                  escapeCsvValue(formatExactDecimal(1)),
                  escapeCsvValue(formatExactDecimal(totaalBedragItem)),
                ].join(',')
              );
              return;
            }

            itemRegels.forEach(({ item: currentItem, artikelregel, range: regelRange, actieveMaanden }) => {
              const aantal = getFactureerbaarArtikelregelAantal(currentItem, artikelregel, selectedPeriode, actieveMaanden);
              csvRegelIndex += 1;
              csvRegels.push(
                [
                  `[R${csvRegelIndex}]`,
                  escapeCsvValue(artikelregel.artikelnummerExact || ''),
                  escapeCsvValue(
                    truncateExactOmschrijving(buildArtikelOmschrijving(artikelregel.omschrijving, currentItem.onderdeel))
                  ),
                  escapeCsvValue(formatIsoDateToDutch(regelRange.start)),
                  escapeCsvValue(formatIsoDateToDutch(regelRange.end)),
                  escapeCsvValue(formatExactDecimal(aantal)),
                  escapeCsvValue(formatExactDecimal(artikelregel.prijsPerEenheid)),
                ].join(',')
              );
            });
          });
        }

        return {
          ...groep,
          titel,
          range,
          actieveRegels,
          totaalBedragExclusiefBtw,
          csvRegels,
        };
      })
      .filter((groep) => groep.actieveRegels.length > 0);
  }, [exactFactuurGroepen, selectedPeriode, selectedJaar]);
  const exactCsvLines = useMemo(
    () => exactExportGroepen.flatMap((groep) => groep.csvRegels),
    [exactExportGroepen]
  );
  const exportedAbonnementIds = useMemo(
    () => Array.from(new Set(exactExportGroepen.flatMap((groep) => groep.items.map((item) => item.id)))),
    [exactExportGroepen]
  );
  const exportedFactuurRecords = useMemo<VerkoopfactuurAbonnementFactuurRecordInput[]>(
    () =>
      exactExportGroepen.flatMap((groep) =>
        groep.items.map((item) => ({
          abonnementId: item.id,
          factuurdatum: formatTodayDutchDate(),
          factuurperiode: getPeriodeAfkorting(selectedPeriode),
          bedragExclusiefBtw: groep.totaalBedragExclusiefBtw,
          titel: groep.titel,
        }))
      ),
    [exactExportGroepen, selectedPeriode]
  );
  const exportedEenmaligeRegelIds = useMemo(
    () =>
      Array.from(
        new Set(
          exactExportGroepen.flatMap((groep) =>
            groep.actieveRegels
              .filter(({ artikelregel }) => isEenmaligFacturerenAan(artikelregel.eenmaligFactureren))
              .map(({ artikelregel }) => artikelregel.id)
          )
        )
      ),
    [exactExportGroepen]
  );
  const skippedSelectedCount = geselecteerdeAbonnementen.length - exportedAbonnementIds.length;
  const exactExportProgressPercent =
    exactExportProgress.total > 0
      ? Math.min(100, Math.round((exactExportProgress.current / exactExportProgress.total) * 100))
      : 0;
  const exactTreeAbonnementen = useMemo<ExactTreeAbonnement[]>(() => {
    return geselecteerdeAbonnementen.map((item) => {
      const range = getExportPeriodeRange(item.factuurPeriode, selectedPeriode, selectedJaar);
      const maandIndex = getMonthIndex(selectedPeriode);
      const periodeCode = maandIndex !== null ? MAANDEN_KORT[maandIndex].toLowerCase() : '';
      const regels = item.artikelregels
        .map((artikelregel) => ({
          artikelregel,
          overlap: getArtikelregelPeriodeOverlap(
            item.factuurPeriode,
            selectedPeriode,
            selectedJaar,
            artikelregel.startActief,
            artikelregel.stopActief,
            range.start,
            range.end
          ),
        }))
        .filter(({ overlap }) => overlap.actief)
        .map(({ artikelregel, overlap }) => {
          const tellingWaarde = getResolvedArtikelregelAantal(item, artikelregel, selectedPeriode);
          const aantal = getFactureerbaarArtikelregelAantal(item, artikelregel, selectedPeriode, overlap.actieveMaanden);
          return {
            ...artikelregel,
            bronAantal: artikelregel.aantal,
            basisAantal: tellingWaarde,
            tellingWaarde,
            exportStart: formatIsoDateToDutch(overlap.start),
            exportEnd: formatIsoDateToDutch(overlap.end),
            actieveMaanden: overlap.actieveMaanden,
            aantal,
            bedrag: aantal * artikelregel.prijsPerEenheid,
          };
        });

      return {
        item,
        range,
        periodeCode,
        regels,
      };
    });
  }, [geselecteerdeAbonnementen, selectedPeriode, selectedJaar]);
  const exactTreeHeeftDeelperiodes = useMemo(
    () =>
      exactTreeAbonnementen.some((abonnement) =>
        abonnement.regels.some(
          (regel) =>
            (regel.exportStart && regel.exportStart !== formatIsoDateToDutch(abonnement.range.start)) ||
            (regel.exportEnd && regel.exportEnd !== formatIsoDateToDutch(abonnement.range.end))
        )
      ),
    [exactTreeAbonnementen]
  );
  const filteredExactTreeAbonnementen = useMemo<ExactTreeAbonnement[]>(() => {
    const terms = parseSearchTerms(exactZoek);
    if (terms.length === 0) {
      return exactTreeAbonnementen;
    }

    return exactTreeAbonnementen
      .map((abonnement) => {
        const parentText = [
          abonnement.item.debiteurennummerExact,
          abonnement.item.relatie,
          abonnement.item.abonnement,
          abonnement.item.onderdeel,
          abonnement.range.start,
          abonnement.range.end,
          abonnement.item.status,
          abonnement.item.redenStatus,
        ].join(' ');
        const parentMatches = matchesAllTerms(parentText, terms);
        const regels = parentMatches
          ? abonnement.regels
          : abonnement.regels.filter((regel) =>
              matchesAllTerms(
                [
                  regel.artikelnummerExact,
                  buildArtikelOmschrijving(regel.omschrijving, abonnement.item.onderdeel),
                  formatDutchNumber(regel.aantal),
                  formatDutchNumber(regel.prijsPerEenheid),
                  formatDutchNumber(regel.bedrag),
                  regel.eenmaligFactureren,
                  regel.startActief,
                  regel.stopActief,
                ].join(' '),
                terms
              )
            );

        return {
          ...abonnement,
          regels,
        };
      })
      .filter((abonnement) => abonnement.regels.length > 0 || matchesAllTerms(
        [
          abonnement.item.debiteurennummerExact,
          abonnement.item.relatie,
          abonnement.item.abonnement,
          abonnement.item.onderdeel,
          abonnement.range.start,
          abonnement.range.end,
          abonnement.item.status,
          abonnement.item.redenStatus,
        ].join(' '),
        terms
      ));
  }, [exactTreeAbonnementen, exactZoek]);
  const exportTitelVarianten = useMemo(
    () => {
      const kwartaalPreview = getKwartaalPreviewTitles(selectedPeriode, selectedJaar);
      return [
        { label: 'Maand', value: getExportTitel('Maand', selectedPeriode, selectedJaar) },
        { label: 'Kwartaal (vooraf)', value: kwartaalPreview.vooraf },
        { label: 'Kwartaal (achteraf)', value: kwartaalPreview.achteraf },
        { label: 'Jaar', value: getExportTitel('Jaar', selectedPeriode, selectedJaar) },
      ];
    },
    [selectedPeriode, selectedJaar]
  );
  const allVisibleSelected =
    selectableFilteredIds.length > 0 && selectableFilteredIds.every((id) => selectedIdSet.has(id));
  const someVisibleSelected = selectableFilteredIds.some((id) => selectedIdSet.has(id));

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someVisibleSelected && !allVisibleSelected;
    }
  }, [allVisibleSelected, someVisibleSelected]);

  useEffect(() => {
    const selectableIdSet = new Set(
      abonnementenMetStatus
        .filter((item) => isHandmatigSelecteerbareAbonnement(item))
        .map((item) => item.id)
    );

    setSelectedIds((current) => {
      const next = current.filter((id) => selectableIdSet.has(id));
      return next.length === current.length ? current : next;
    });
  }, [abonnementenMetStatus]);

  useEffect(() => {
    const visibleIds = new Set(filteredExactTreeAbonnementen.map(({ item }) => item.id));
    setOpenExactAbonnementen((current) => {
      const next = Object.fromEntries(
        Object.entries(current).filter(([key]) => visibleIds.has(Number(key)))
      ) as Record<number, boolean>;
      const currentKeys = Object.keys(current).sort();
      const nextKeys = Object.keys(next).sort();
      const isEqual =
        currentKeys.length === nextKeys.length &&
        currentKeys.every((key, index) => key === nextKeys[index] && current[Number(key)] === next[Number(key)]);
      return isEqual ? current : next;
    });
  }, [filteredExactTreeAbonnementen]);

  const toggleRowSelection = (id: number, checked: boolean) => {
    const item = abonnementenMetStatus.find((abonnement) => abonnement.id === id);
    if (!item || !isHandmatigSelecteerbareAbonnement(item)) {
      return;
    }

    setSelectedIds((current) => {
      if (checked) {
        return current.includes(id) ? current : [...current, id];
      }
      return current.filter((itemId) => itemId !== id);
    });
  };

  const toggleAllVisibleSelection = (checked: boolean) => {
    setSelectedIds((current) => {
      if (checked) {
        return Array.from(new Set([...current, ...selectableFilteredIds]));
      }
      const visibleIdSet = new Set(selectableFilteredIds);
      return current.filter((id) => !visibleIdSet.has(id));
    });
  };

  const toggleExactAbonnement = (id: number) => {
    setOpenExactAbonnementen((current) => ({
      ...current,
      [id]: !Boolean(current[id]),
    }));
  };

  const handlePrintOverview = () => {
    if (printFilteredAbonnementen.length === 0) {
      return;
    }

    setPrintingOverview(true);
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 5;
      const bottomMargin = 5;
      const headerY = 8;
      const tableStartY = 18;
      const lineHeight = 3.6;
      const rowPaddingY = 1.8;
      const baseColWidths = [22, 18, 18, 16, 14, 14, 16, 16, 16, 14, 14, 14, 30, 14];
      const availableTableWidth = pageWidth - margin * 2;
      const baseTableWidth = baseColWidths.reduce((sum, width) => sum + width, 0);
      const widthScale = availableTableWidth / baseTableWidth;
      const colWidths = baseColWidths.map((width) => width * widthScale);
      const headers = [
        'Relatie',
        'Onderdeel',
        'Abonnement',
        'Bedrag',
        'Start',
        'Stop',
        'PO actie',
        'PO nummer',
        'PO geldig t/m',
        'Periode',
        'Laatste datum',
        'Laatste periode',
        'Reden status',
        'Status',
      ];
      const totalTableWidth = colWidths.reduce((sum, width) => sum + width, 0);
      const totaalBedrag = printFilteredAbonnementen.reduce((sum, item) => sum + item.bedrag, 0);
      const rapportDatumTijd = formatCurrentDutchDateTime();
      const rows = printFilteredAbonnementen.map((item) => ({
        item,
        values: [
          item.relatie || '-',
          item.onderdeel || '-',
          item.abonnement || '-',
          formatDutchNumber(item.bedrag),
          item.startAbonnement || '-',
          item.stopAbonnement || '-',
          (item.poActie || '').split('(')[0].trim() || '-',
          item.poNummer || '-',
          item.poGeldigTm || '-',
          item.factuurPeriode || '-',
          item.laatsteFactuurdatum || '-',
          item.laatsteFactuurperiode || '-',
          item.redenStatus || '-',
          item.status || '-',
        ],
      }));

      const getStatusColors = (status: string) => {
        if (status === 'Factureren') {
          return { fill: [240, 253, 244] as const, text: [21, 128, 61] as const, border: [187, 247, 208] as const };
        }
        if (status === 'Niet actief') {
          return { fill: [239, 246, 255] as const, text: [29, 78, 216] as const, border: [191, 219, 254] as const };
        }
        if (status === 'Aanvragen') {
          return { fill: [254, 252, 232] as const, text: [161, 98, 7] as const, border: [253, 224, 71] as const };
        }
        if (status === 'Proforma') {
          return { fill: [250, 245, 255] as const, text: [126, 34, 206] as const, border: [216, 180, 254] as const };
        }
        return { fill: [254, 242, 242] as const, text: [185, 28, 28] as const, border: [254, 202, 202] as const };
      };

      const drawHeader = (pageNumber: number) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text(`Verkoopfacturen overzicht ${selectedJaar || '-'} ${selectedPeriode || '-'}`, margin, headerY);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text(rapportDatumTijd, pageWidth - margin, headerY, { align: 'right' });
        doc.setFontSize(8);
        doc.text(
          `Jaar: ${selectedJaar || '-'}  Periode: ${selectedPeriode || '-'}  Filter: ${printStatusFilter}  Regels: ${printFilteredAbonnementen.length}`,
          margin,
          17
        );
        doc.text(`Pagina ${pageNumber}`, pageWidth - margin, 17, { align: 'right' });

        let x = margin;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        const headerLinesByColumn = headers.map((header, index) => doc.splitTextToSize(header, colWidths[index] - 2));
        const headerHeight =
          headerLinesByColumn.reduce((max, lines) => Math.max(max, lines.length), 1) * lineHeight + rowPaddingY * 2;
        for (let index = 0; index < headers.length; index += 1) {
          doc.setFillColor(245, 247, 250);
          doc.rect(x, tableStartY - 4, colWidths[index], headerHeight, 'F');
          if (index === 3) {
            doc.text(headerLinesByColumn[index], x + colWidths[index] - 1, tableStartY - 1.2 + rowPaddingY, {
              maxWidth: colWidths[index] - 2,
              align: 'right',
            });
          } else {
            doc.text(headerLinesByColumn[index], x + 1, tableStartY - 1.2 + rowPaddingY, {
              maxWidth: colWidths[index] - 2,
            });
          }
          x += colWidths[index];
        }
        return headerHeight;
      };

      let currentPage = 1;
      let headerHeight = drawHeader(currentPage);
      let y = tableStartY - 4 + headerHeight + 3;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);

      rows.forEach(({ item, values: row }, rowIndex) => {
        const wrappedRow = row.map((cell, cellIndex) => doc.splitTextToSize(String(cell), colWidths[cellIndex] - 2));
        const relatieExtraLines = item.factuurContactpersoonExtra
          ? doc.splitTextToSize(String(item.factuurContactpersoonExtra), colWidths[0] - 2)
          : [];
        if (relatieExtraLines.length > 0) {
          wrappedRow[0] = [...wrappedRow[0], ...relatieExtraLines];
        }
        const rowLineCount = wrappedRow.reduce((max, lines) => Math.max(max, lines.length), 1);
        const rowHeight = rowLineCount * lineHeight + rowPaddingY * 2;

        if (y + rowHeight > pageHeight - bottomMargin) {
          doc.addPage();
          currentPage += 1;
          headerHeight = drawHeader(currentPage);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          y = tableStartY - 4 + headerHeight + 3;
        }

        let x = margin;
        if (rowIndex % 2 === 0) {
          doc.setFillColor(250, 251, 252);
          doc.rect(margin, y - rowPaddingY, totalTableWidth, rowHeight, 'F');
        }

        row.forEach((cell, cellIndex) => {
          if (cellIndex === row.length - 1) {
            const statusText = String(cell);
            const colors = getStatusColors(statusText);
            doc.setFillColor(colors.fill[0], colors.fill[1], colors.fill[2]);
            doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
            doc.roundedRect(x + 0.5, y - rowPaddingY + 0.5, colWidths[cellIndex] - 1, rowHeight - 1, 1.5, 1.5, 'FD');
            doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
            doc.setFontSize(6);
            doc.text(statusText, x + 1.5, y + lineHeight / 2);
            doc.setFontSize(7);
            doc.setTextColor(31, 41, 55);
          } else if (cellIndex === 0 && relatieExtraLines.length > 0) {
            const hoofdregel = doc.splitTextToSize(String(cell), colWidths[cellIndex] - 2);
            doc.setTextColor(31, 41, 55);
            doc.text(hoofdregel, x + 1, y + lineHeight / 2);
            doc.setTextColor(156, 163, 175);
            doc.text(relatieExtraLines, x + 1, y + lineHeight / 2 + hoofdregel.length * lineHeight);
            doc.setTextColor(31, 41, 55);
          } else if (cellIndex === 3) {
            doc.text(wrappedRow[cellIndex], x + colWidths[cellIndex] - 1, y + lineHeight / 2, {
              align: 'right',
            });
          } else {
            doc.text(wrappedRow[cellIndex], x + 1, y + lineHeight / 2);
          }
          x += colWidths[cellIndex];
        });

        y += rowHeight;
      });

      const totalRowHeight = lineHeight + rowPaddingY * 2;
      if (y + totalRowHeight > pageHeight - bottomMargin) {
        doc.addPage();
        currentPage += 1;
        headerHeight = drawHeader(currentPage);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        y = tableStartY - 4 + headerHeight + 3;
      }

      doc.setDrawColor(209, 213, 219);
      doc.setLineWidth(0.35);
      doc.line(margin, y, margin + totalTableWidth, y);

      let totalX = margin;
      headers.forEach((_, index) => {
        if (index === 2) {
          doc.setFont('helvetica', 'bold');
          doc.text('Totaal', totalX + 1, y + rowPaddingY + lineHeight / 2);
          doc.setFont('helvetica', 'normal');
        } else if (index === 3) {
          doc.setFont('helvetica', 'bold');
          doc.text(formatDutchNumber(totaalBedrag), totalX + colWidths[index] - 1, y + rowPaddingY + lineHeight / 2, {
            align: 'right',
          });
          doc.setFont('helvetica', 'normal');
        }
        totalX += colWidths[index];
      });

      const filenameFilter = printStatusFilter.toLowerCase().replace(/\s+/g, '-');
      doc.save(
        `verkoopfacturen-overzicht-${selectedJaar || 'onbekend'}-${selectedPeriode || 'periode'}-${filenameFilter}.pdf`
      );
    } finally {
      setPrintingOverview(false);
    }
  };

  const handlePrintStatusAbonnementenOverview = () => {
    if (filteredStatusAbonnementen.length === 0) {
      return;
    }

    setPrintingOverview(true);
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 5;
      const bottomMargin = 5;
      const headerY = 8;
      const tableStartY = 18;
      const lineHeight = 3.6;
      const rowPaddingY = 1.8;
      const baseColWidths = [24, 18, 28, 24, 16, 18, 22, 18, 14];
      const availableTableWidth = pageWidth - margin * 2;
      const baseTableWidth = baseColWidths.reduce((sum, width) => sum + width, 0);
      const widthScale = availableTableWidth / baseTableWidth;
      const colWidths = baseColWidths.map((width) => width * widthScale);
      const headers = [
        'Relatie',
        'Onderdeel',
        'Status info',
        'Abonnement',
        'Factuurdatum',
        'Laatste factuurperiode',
        'Facturen in de maand',
        'Factuur periode',
        'Status',
      ];
      const totalTableWidth = colWidths.reduce((sum, width) => sum + width, 0);
      const rapportDatumTijd = formatCurrentDutchDateTime();
      const totaalRegels = filteredStatusAbonnementen.length;
      const rows = filteredStatusAbonnementen.map((item) => {
        const facturatieStatus = getFacturatieAchterstandStatus(item, selectedJaar, selectedPeriode);
        return {
          values: [
            item.relatie || '-',
            item.onderdeel || '-',
            item.statusInfo || '-',
            item.abonnement || '-',
            item.laatsteFactuurdatum || '-',
            item.laatsteFactuurperiode || '-',
            item.facturenInDeMaand || '-',
            item.factuurPeriode || '-',
            facturatieStatus.waarschuwing ? 'Achterstand' : '-',
          ],
        };
      });

      const getStatusColors = (status: string) => {
        if (status === 'Achterstand') {
          return { fill: [254, 242, 242] as const, text: [185, 28, 28] as const, border: [254, 202, 202] as const };
        }
        return { fill: [240, 253, 244] as const, text: [21, 128, 61] as const, border: [187, 247, 208] as const };
      };

      const drawHeader = (pageNumber: number) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('Status abonnementen overzicht', margin, headerY);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text(rapportDatumTijd, pageWidth - margin, headerY, { align: 'right' });
        doc.setFontSize(8);
        doc.text(
          `Jaar: ${selectedJaar || '-'}  Periode: ${selectedPeriode || '-'}  Regels: ${filteredStatusAbonnementen.length}`,
          margin,
          17
        );
        doc.text(`Pagina ${pageNumber}`, pageWidth - margin, 17, { align: 'right' });

        let x = margin;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        const headerLinesByColumn = headers.map((header, index) => doc.splitTextToSize(header, colWidths[index] - 2));
        const headerHeight =
          headerLinesByColumn.reduce((max, lines) => Math.max(max, lines.length), 1) * lineHeight + rowPaddingY * 2;

        for (let index = 0; index < headers.length; index += 1) {
          doc.setFillColor(245, 247, 250);
          doc.rect(x, tableStartY - 4, colWidths[index], headerHeight, 'F');
          doc.text(headerLinesByColumn[index], x + 1, tableStartY - 1.2 + rowPaddingY, {
            maxWidth: colWidths[index] - 2,
          });
          x += colWidths[index];
        }
        return headerHeight;
      };

      let currentPage = 1;
      let headerHeight = drawHeader(currentPage);
      let y = tableStartY - 4 + headerHeight + 3;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);

      rows.forEach(({ values: row }, rowIndex) => {
        const wrappedRow = row.map((cell, cellIndex) => doc.splitTextToSize(String(cell), colWidths[cellIndex] - 2));
        const rowLineCount = wrappedRow.reduce((max, lines) => Math.max(max, lines.length), 1);
        const rowHeight = rowLineCount * lineHeight + rowPaddingY * 2;

        if (y + rowHeight > pageHeight - bottomMargin) {
          doc.addPage();
          currentPage += 1;
          headerHeight = drawHeader(currentPage);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          y = tableStartY - 4 + headerHeight + 3;
        }

        let x = margin;
        if (rowIndex % 2 === 0) {
          doc.setFillColor(250, 251, 252);
          doc.rect(margin, y - rowPaddingY, totalTableWidth, rowHeight, 'F');
        }

        row.forEach((cell, cellIndex) => {
          if (cellIndex === row.length - 1) {
            const statusText = String(cell);
            const colors = getStatusColors(statusText);
            doc.setFillColor(colors.fill[0], colors.fill[1], colors.fill[2]);
            doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
            doc.roundedRect(x + 0.5, y - rowPaddingY + 0.5, colWidths[cellIndex] - 1, rowHeight - 1, 1.5, 1.5, 'FD');
            doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
            doc.setFontSize(6);
            doc.text(statusText, x + 1.5, y + lineHeight / 2);
            doc.setFontSize(7);
            doc.setTextColor(31, 41, 55);
          } else {
            doc.text(wrappedRow[cellIndex], x + 1, y + lineHeight / 2);
          }
          x += colWidths[cellIndex];
        });

        y += rowHeight;
      });

      const totalRowHeight = lineHeight + rowPaddingY * 2;
      if (y + totalRowHeight > pageHeight - bottomMargin) {
        doc.addPage();
        currentPage += 1;
        headerHeight = drawHeader(currentPage);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        y = tableStartY - 4 + headerHeight + 3;
      }

      doc.setDrawColor(209, 213, 219);
      doc.setLineWidth(0.35);
      doc.line(margin, y, margin + totalTableWidth, y);

      let totalX = margin;
      headers.forEach((_, index) => {
        if (index === 2) {
          doc.setFont('helvetica', 'bold');
          doc.text('Totaal regels', totalX + 1, y + rowPaddingY + lineHeight / 2);
          doc.setFont('helvetica', 'normal');
        } else if (index === headers.length - 1) {
          doc.setFont('helvetica', 'bold');
          doc.text(String(totaalRegels), totalX + colWidths[index] - 1, y + rowPaddingY + lineHeight / 2, {
            align: 'right',
          });
          doc.setFont('helvetica', 'normal');
        }
        totalX += colWidths[index];
      });

      doc.save('status-abonnementen-overzicht.pdf');
    } finally {
      setPrintingOverview(false);
    }
  };

  const handleBuildExactPreview = () => {
    setExactFout('');
    setBuildingExactPreview(true);
    try {
      setExactPreview(exactCsvLines.join('\n'));
    } finally {
      setBuildingExactPreview(false);
    }
  };

  const handleGenerateExactCsv = async () => {
    setGeneratingExactCsv(true);
    setExactFout('');
    setExactExportProgress({ current: 0, total: 0, label: 'Voorbereiden...' });
    try {
      const csvContent = exactCsvLines.join('\n');
      if (!csvContent.trim()) {
        throw new Error('Geen exporteerbare Exact-regels gevonden voor de huidige selectie.');
      }
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'facturen.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const updateTotal = exportedAbonnementIds.length + exportedFactuurRecords.length;
      const deleteTotal = exportedEenmaligeRegelIds.length;
      const totalSteps = updateTotal + deleteTotal;
      setExactExportProgress({
        current: 0,
        total: totalSteps,
        label: totalSteps > 0 ? 'Ninox bijwerken...' : 'Afronden...',
      });

      await updateNinoxVerkoopfactuurAbonnementFactuurStatus(
        exportedAbonnementIds,
        formatTodayDutchDate(),
        getPeriodeAfkorting(selectedPeriode),
        exportedFactuurRecords,
        (current, total) => {
          setExactExportProgress({
            current,
            total: total + deleteTotal,
            label: 'Ninox bijwerken...',
          });
        }
      );
      if (exportedEenmaligeRegelIds.length > 0) {
        await deleteNinoxVerkoopfactuurAbonnementArtikelRegels(exportedEenmaligeRegelIds, (current, total) => {
          setExactExportProgress({
            current: updateTotal + current,
            total: updateTotal + total,
            label: 'Eenmalige regels verwijderen...',
          });
        });
      }
      setExactExportProgress({
        current: totalSteps,
        total: totalSteps,
        label: 'Abonnementen verversen...',
      });
      await handleLeesAbonnementen();
      setConfirmExportOpen(false);
    } catch (error) {
      setExactFout(error instanceof Error ? error.message : 'Facturen.csv genereren mislukt.');
    } finally {
      setGeneratingExactCsv(false);
      setExactExportProgress({ current: 0, total: 0, label: '' });
    }
  };

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Link2 size={24} className="text-dc-blue-500" />
          <h1 className="text-2xl font-semibold text-dc-gray-500">Koppelingen</h1>
        </div>
        <p className="text-sm text-dc-gray-400">
          Kies een koppeling om te openen.
        </p>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-dc-gray-100 p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => openOnderdeel('verkopen-naar-exact')}
              className={onderdeelButtonClass('verkopen-naar-exact')}
            >
              <div className="flex items-center gap-2">
                <Link2 size={18} className="text-dc-blue-500" />
                <span className="text-sm font-semibold text-dc-gray-500">Verkopen naar Exact</span>
              </div>
            </button>

            <button type="button" onClick={() => openOnderdeel('ninox-api')} className={onderdeelButtonClass('ninox-api')}>
              <div className="flex items-center gap-2">
                <Link2 size={18} className="text-dc-blue-500" />
                <span className="text-sm font-semibold text-dc-gray-500">Ninox API</span>
              </div>
            </button>
          </div>
        </div>

        {activeOnderdeel === 'verkopen-naar-exact' && (
          <>
        <div className="bg-white rounded-xl border border-dc-gray-100 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => openTab('uitlezen-abonnementen')}
              className={tabButtonClass('uitlezen-abonnementen')}
            >
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-dc-blue-500" />
                <span className="text-sm font-semibold text-dc-gray-500">Abonnementen</span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => openTab('exporteren-exact')}
              className={tabButtonClass('exporteren-exact')}
            >
              <div className="flex items-center gap-2">
                <Download size={18} className="text-dc-blue-500" />
                <span className="text-sm font-semibold text-dc-gray-500">Exporteren Exact</span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => openTab('status-abonnementen')}
              className={tabButtonClass('status-abonnementen')}
            >
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-dc-blue-500" />
                <span className="text-sm font-semibold text-dc-gray-500">Status abonnementen</span>
              </div>
            </button>
          </div>
        </div>

        {activeTab === 'uitlezen-abonnementen' && (
          <div className="bg-white rounded-xl border border-dc-gray-100 p-6">
            <div className="flex flex-col lg:flex-row gap-3 lg:items-end mb-6">
              <div className="w-full max-w-[120px]">
                <label className="block text-xs font-medium text-dc-gray-400 mb-1">Jaar</label>
                <ComboBox
                  value={selectedJaar}
                  onChange={setSelectedJaar}
                  options={jaarOpties.map((option) => ({ value: option, label: option }))}
                  placeholder="Jaar"
                  searchable={false}
                />
              </div>
              <div className="w-full max-w-[220px]">
                <label className="block text-xs font-medium text-dc-gray-400 mb-1">Periode</label>
                <ComboBox
                  value={selectedPeriode}
                  onChange={setSelectedPeriode}
                  options={MAANDEN.map((maand) => ({ value: maand, label: maand }))}
                  placeholder="Periode"
                  searchable={false}
                  sortOptions={false}
                />
              </div>
              <button
                type="button"
                disabled={readingAbonnementen}
                onClick={() => void handleLeesAbonnementen()}
                className="h-[38px] px-4 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {readingAbonnementen && <Loader2 className="inline w-4 h-4 mr-2 animate-spin" />}
                {readingAbonnementen ? 'Bezig...' : 'Inlezen abonnementen'}
              </button>
              <div className="w-full max-w-[220px]">
                <label className="block text-xs font-medium text-dc-gray-400 mb-1">Print filter</label>
                <ComboBox
                  value={printStatusFilter}
                  onChange={(value) => setPrintStatusFilter(value as (typeof PRINT_STATUS_FILTER_OPTIONS)[number]['value'])}
                  options={PRINT_STATUS_FILTER_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                  placeholder="Print filter"
                  searchable={false}
                  sortOptions={false}
                />
              </div>
              <button
                type="button"
                onClick={handlePrintOverview}
                disabled={printingOverview || printFilteredAbonnementen.length === 0}
                className="h-[38px] px-4 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {printingOverview && <Loader2 className="inline w-4 h-4 mr-2 animate-spin" />}
                {printingOverview ? 'Bezig...' : 'Printen overzicht'}
              </button>
            </div>

            <LoadingSpinner active={readingAbonnementen} message="Abonnementen laden uit Ninox..." />

            {abonnementenFout && (
              <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                Ninox laden mislukt: {abonnementenFout}
              </div>
            )}

            <div className="mb-4 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dc-gray-300" />
              <input
                type="text"
                value={zoek}
                onChange={(e) => setZoek(e.target.value)}
                placeholder="Zoeken op alle kolommen, meerdere kolommen zoeken mogelijk door je zoekwoorden met een , te scheiden..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-dc-gray-100 rounded-lg text-sm text-dc-gray-500 placeholder:text-dc-gray-300 focus:outline-none focus:ring-2 focus:ring-dc-blue-500/30 focus:border-dc-blue-500"
              />
            </div>

            <div className="bg-white rounded-xl border border-dc-gray-100 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-dc-gray-100">
                    <th className="w-12 px-3 py-3 text-center text-xs font-semibold text-dc-gray-400">
                      <label className="inline-flex items-center justify-center cursor-pointer">
                        <input
                          ref={selectAllRef}
                          type="checkbox"
                          checked={allVisibleSelected}
                          disabled={selectableFilteredIds.length === 0}
                          onChange={(e) => toggleAllVisibleSelection(e.target.checked)}
                          className="h-4 w-4 rounded border-dc-gray-300 text-dc-blue-500 focus:ring-dc-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      </label>
                    </th>
                    <SortableTh
                      label="Relatie"
                      active={sort.key === 'relatie'}
                      direction={sort.direction}
                      onClick={() => setSort((current) => nextSortState(current, 'relatie'))}
                      className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400"
                    />
                    <SortableTh
                      label="Onderdeel"
                      active={sort.key === 'onderdeel'}
                      direction={sort.direction}
                      onClick={() => setSort((current) => nextSortState(current, 'onderdeel'))}
                      className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400"
                    />
                    <SortableTh
                      label="Abonnement"
                      active={sort.key === 'abonnement'}
                      direction={sort.direction}
                      onClick={() => setSort((current) => nextSortState(current, 'abonnement'))}
                      className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400"
                    />
                    <SortableTh
                      label="Bedrag"
                      active={sort.key === 'bedrag'}
                      direction={sort.direction}
                      onClick={() => setSort((current) => nextSortState(current, 'bedrag'))}
                      className="text-right px-5 py-3 text-xs font-semibold text-dc-gray-400"
                    />
                    <SortableTh
                      label="Start abonnement"
                      active={sort.key === 'startAbonnement'}
                      direction={sort.direction}
                      onClick={() => setSort((current) => nextSortState(current, 'startAbonnement'))}
                      className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400"
                    />
                    <SortableTh
                      label="Stop abonnement"
                      active={sort.key === 'stopAbonnement'}
                      direction={sort.direction}
                      onClick={() => setSort((current) => nextSortState(current, 'stopAbonnement'))}
                      className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400"
                    />
                    <SortableTh
                      label="PO actie"
                      active={sort.key === 'poActie'}
                      direction={sort.direction}
                      onClick={() => setSort((current) => nextSortState(current, 'poActie'))}
                      className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400"
                    />
                    <SortableTh
                      label="PO nummer"
                      active={sort.key === 'poNummer'}
                      direction={sort.direction}
                      onClick={() => setSort((current) => nextSortState(current, 'poNummer'))}
                      className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400"
                    />
                    <SortableTh
                      label="PO geldig t/m"
                      active={sort.key === 'poGeldigTm'}
                      direction={sort.direction}
                      onClick={() => setSort((current) => nextSortState(current, 'poGeldigTm'))}
                      className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400"
                    />
                    <SortableTh
                      label="Factuur periode"
                      active={sort.key === 'factuurPeriode'}
                      direction={sort.direction}
                      onClick={() => setSort((current) => nextSortState(current, 'factuurPeriode'))}
                      className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400"
                    />
                    <SortableTh
                      label="Laatste factuurdatum"
                      active={sort.key === 'laatsteFactuurdatum'}
                      direction={sort.direction}
                      onClick={() => setSort((current) => nextSortState(current, 'laatsteFactuurdatum'))}
                      className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400"
                    />
                    <SortableTh
                      label="Laatste factuurperiode"
                      active={sort.key === 'laatsteFactuurperiode'}
                      direction={sort.direction}
                      onClick={() => setSort((current) => nextSortState(current, 'laatsteFactuurperiode'))}
                      className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400"
                    />
                    <SortableTh
                      label="Reden status"
                      active={sort.key === 'redenStatus'}
                      direction={sort.direction}
                      onClick={() => setSort((current) => nextSortState(current, 'redenStatus'))}
                      className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400"
                    />
                    <SortableTh
                      label="Status"
                      active={sort.key === 'status'}
                      direction={sort.direction}
                      onClick={() => setSort((current) => nextSortState(current, 'status'))}
                      className="sticky right-0 z-20 text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 bg-white shadow-[-1px_0_0_0_rgb(229_231_235)]"
                    />
                  </tr>
                </thead>
                <tbody>
                  {filteredAbonnementen.map((item) => (
                    <tr key={item.id} className="dc-zebra-row">
                      <td className="w-12 px-3 py-3 text-center text-dc-gray-500">
                        <input
                          type="checkbox"
                          checked={selectedIdSet.has(item.id)}
                          onChange={(e) => toggleRowSelection(item.id, e.target.checked)}
                          className="h-4 w-4 rounded border-dc-gray-300 text-dc-blue-500 focus:ring-dc-blue-500"
                        />
                      </td>
                      <td className="px-5 py-3 text-dc-gray-500">
                        <div>{item.relatie || '-'}</div>
                        {item.factuurContactpersoonExtra && (
                          <div className="mt-1 text-[11px] text-dc-gray-400">{item.factuurContactpersoonExtra}</div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-dc-gray-500">{item.onderdeel || '-'}</td>
                      <td className="px-5 py-3 text-dc-gray-500">{item.abonnement || '-'}</td>
                      <td className="px-5 py-3 text-right text-dc-gray-500">{formatDutchNumber(item.bedrag)}</td>
                      <td className="px-5 py-3 text-dc-gray-500">{item.startAbonnement || '-'}</td>
                      <td className="px-5 py-3 text-dc-gray-500">{item.stopAbonnement || '-'}</td>
                      <td className="px-5 py-3 text-dc-gray-500">
                        {(item.poActie || '').split('(')[0].trim() || '-'}
                      </td>
                      <td className="px-5 py-3 text-dc-gray-500">{item.poNummer || '-'}</td>
                      <td className="px-5 py-3 text-dc-gray-500">{item.poGeldigTm || '-'}</td>
                      <td className="px-5 py-3 text-dc-gray-500">{item.factuurPeriode || '-'}</td>
                      <td className="px-5 py-3 text-dc-gray-500">{item.laatsteFactuurdatum || '-'}</td>
                      <td className="px-5 py-3 text-dc-gray-500">{item.laatsteFactuurperiode || '-'}</td>
                      <td className="px-5 py-3 text-dc-gray-500">{item.redenStatus || '-'}</td>
                      <td className="sticky right-0 z-10 px-5 py-3 text-dc-gray-500 bg-white shadow-[-1px_0_0_0_rgb(229_231_235)]">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                            item.status === 'Factureren'
                              ? 'bg-green-50 text-green-700 border border-green-200'
                              : item.status === 'Niet actief'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : item.status === 'Aanvragen'
                              ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                              : item.status === 'Proforma'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!readingAbonnementen && abonnementenLoaded && filteredAbonnementen.length === 0 && (
                    <tr>
                      <td colSpan={15} className="px-5 py-8 text-center text-dc-gray-300 text-sm">
                        {abonnementen.length === 0
                          ? 'Geen actieve abonnementen gevonden voor verkoopfacturatie'
                          : 'Geen abonnementen gevonden voor de huidige zoekopdracht'}
                      </td>
                    </tr>
                  )}
                  {!readingAbonnementen && !abonnementenLoaded && (
                    <tr>
                      <td colSpan={15} className="px-5 py-8 text-center text-dc-gray-300 text-sm">
                        Klik op &apos;Inlezen abonnementen&apos; om resultaten te tonen
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'exporteren-exact' && (
          <div className="bg-white rounded-xl border border-dc-gray-100 p-6">
            {(exportTitelPreview || selectedPeriode || selectedJaar) && (
              <div className="mb-4 rounded-lg border border-dc-gray-100 bg-dc-gray-50 px-4 py-3 text-sm text-dc-gray-500">
                <div className="font-medium mb-2">Titel preview</div>
                <div className="space-y-1">
                  {exportTitelVarianten.map((variant) => (
                    <div key={variant.label} className="grid grid-cols-[150px_1fr] gap-3">
                      <span className="text-dc-gray-400">{variant.label}</span>
                      <span className="font-medium">{variant.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="mb-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleBuildExactPreview}
                  disabled={buildingExactPreview || geselecteerdeAbonnementen.length === 0}
                  className="h-[38px] px-4 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {buildingExactPreview && <Loader2 className="inline w-4 h-4 mr-2 animate-spin" />}
                  {buildingExactPreview ? 'Bezig...' : 'Inlezen geselecteerde abonnementen'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmExportOpen(true)}
                  disabled={generatingExactCsv || geselecteerdeAbonnementen.length === 0}
                  className="h-[38px] px-4 rounded-lg bg-yellow-400 text-dc-gray-700 text-sm font-medium hover:bg-yellow-500 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {generatingExactCsv && <Loader2 className="inline w-4 h-4 mr-2 animate-spin" />}
                  {!generatingExactCsv && <AlertTriangle className="inline w-4 h-4 mr-2" />}
                  {generatingExactCsv ? 'Bezig...' : 'Exporteren'}
                </button>
                <div className="flex-1 min-w-[220px] h-[38px] rounded-lg border border-dc-gray-100 bg-dc-gray-50 overflow-hidden">
                  <div className="relative h-full">
                    <div
                      className="absolute inset-y-0 left-0 bg-dc-blue-500/80 transition-all duration-300"
                      style={{ width: `${exactExportProgressPercent}%` }}
                    />
                    <div className="relative z-10 flex h-full items-center justify-between px-3 text-xs text-dc-gray-600">
                      <span className="truncate pr-3">
                        {generatingExactCsv ? exactExportProgress.label || 'Ninox bijwerken...' : 'Voortgang export naar Ninox'}
                      </span>
                      <span className="shrink-0 font-medium">
                        {generatingExactCsv && exactExportProgress.total > 0
                          ? `${exactExportProgress.current}/${exactExportProgress.total}`
                          : '0/0'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {exactFout && (
              <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                Exact export mislukt: {exactFout}
              </div>
            )}
            {geselecteerdeAbonnementen.length > 0 && skippedSelectedCount > 0 && (
              <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {skippedSelectedCount} geselecteerde abonnement{skippedSelectedCount === 1 ? '' : 'en'} hebben geen actieve
                exportregels in de gekozen periode en worden niet bijgewerkt of verwijderd bij export.
              </div>
            )}
            {geselecteerdeAbonnementen.length > 0 && exactTreeHeeftDeelperiodes && (
              <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                Een of meer artikelregels zijn slechts een deel van de gekozen periode actief. In dat geval worden aantal en
                van/t/m-datum per artikelregel herberekend op basis van de effectieve overlap.
              </div>
            )}
            {exactPreview && (
              <div className="mb-4 rounded-xl border border-dc-gray-100 bg-dc-gray-50 p-4">
                <pre className="whitespace-pre-wrap break-all text-xs text-dc-gray-500 font-mono">{exactPreview}</pre>
              </div>
            )}
            <div className="mb-4 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dc-gray-300" />
              <input
                type="text"
                value={exactZoek}
                onChange={(e) => setExactZoek(e.target.value)}
                placeholder="Zoeken op alle kolommen, meerdere kolommen zoeken mogelijk door je zoekwoorden met een , te scheiden..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-dc-gray-100 rounded-lg text-sm text-dc-gray-500 placeholder:text-dc-gray-300 focus:outline-none focus:ring-2 focus:ring-dc-blue-500/30 focus:border-dc-blue-500"
              />
            </div>
            <div className="bg-white rounded-xl border border-dc-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dc-gray-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400">Artikel Exact</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400">Omschrijving</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-dc-gray-400">Aantal</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-dc-gray-400">Prijs</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-dc-gray-400">Bedrag</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400">Eenmalig</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400">Start actief</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400">Stop actief</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400">Export periode</th>
                    <th className="sticky right-0 z-20 text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 bg-white shadow-[-1px_0_0_0_rgb(229_231_235)]">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExactTreeAbonnementen.map(({ item, range, regels, periodeCode }) => {
                    const isOpen = exactZoek.trim().length > 0 || Boolean(openExactAbonnementen[item.id]);
                    return (
                      <Fragment key={item.id}>
                        <tr className="border-b border-dc-gray-100 bg-dc-gray-50/70">
                          <td className="px-5 py-3 text-dc-gray-500 font-semibold">
                            <button
                              type="button"
                              onClick={() => toggleExactAbonnement(item.id)}
                              className="inline-flex items-center gap-2 text-left hover:text-dc-blue-500"
                            >
                              {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                              <span>{item.debiteurennummerExact || '-'}</span>
                            </button>
                          </td>
                          <td className="px-5 py-3 text-dc-gray-500 font-semibold">
                            {item.relatie || '-'} | {item.abonnement || '-'}{item.onderdeel ? ` | ${item.onderdeel}` : ''}
                            <div className="mt-1 text-xs font-normal text-dc-gray-400">
                              Periode: {formatIsoDateToDutch(range.start) || '-'} t/m {formatIsoDateToDutch(range.end) || '-'} | Regels: {regels.length}
                            </div>
                            {regels.some(
                              (regel) =>
                                regel.exportStart !== formatIsoDateToDutch(range.start) || regel.exportEnd !== formatIsoDateToDutch(range.end)
                            ) && (
                              <div className="mt-1 text-xs font-medium text-red-600">
                                Deelperiode actief: een of meer regels gebruiken een kortere van/t/m-periode
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-3 text-right text-dc-gray-400">-</td>
                          <td className="px-5 py-3 text-right text-dc-gray-400">-</td>
                          <td className="px-5 py-3 text-right text-dc-gray-400">-</td>
                          <td className="px-5 py-3 text-dc-gray-400">{regels.some((regel) => isEenmaligFacturerenAan(regel.eenmaligFactureren)) ? 'Ja' : 'Nee'}</td>
                          <td className="px-5 py-3 text-dc-gray-400">{regels[0]?.startActief || '-'}</td>
                          <td className="px-5 py-3 text-dc-gray-400">{regels[regels.length - 1]?.stopActief || '-'}</td>
                          <td className="px-5 py-3 text-dc-gray-400">
                            {regels.length > 0
                              ? `${regels[0]?.exportStart || formatIsoDateToDutch(range.start) || '-'} - ${
                                  regels[regels.length - 1]?.exportEnd || formatIsoDateToDutch(range.end) || '-'
                                }`
                              : '-'}
                          </td>
                          <td className="sticky right-0 z-10 px-5 py-3 text-dc-gray-400 bg-dc-gray-50/70 shadow-[-1px_0_0_0_rgb(229_231_235)]">
                            <div className="text-[11px] leading-4">
                              <div>Periodecode: {periodeCode || '-'}</div>
                              <div>Totaalbedrag: {formatDutchNumber(item.bedrag)}</div>
                            </div>
                          </td>
                        </tr>
                        {isOpen &&
                          regels.map((regel) => (
                            <tr key={regel.id} className="dc-zebra-row">
                              <td className="px-5 py-3 text-dc-gray-500 pl-12">{regel.artikelnummerExact || '-'}</td>
                              <td className="px-5 py-3 text-dc-gray-500">{buildArtikelOmschrijving(regel.omschrijving, item.onderdeel) || '-'}</td>
                              <td className="px-5 py-3 text-dc-gray-500 text-right">{formatDutchNumber(regel.aantal)}</td>
                              <td className="px-5 py-3 text-dc-gray-500 text-right">{formatDutchNumber(regel.prijsPerEenheid)}</td>
                              <td className="px-5 py-3 text-dc-gray-500 text-right">{formatDutchNumber(regel.bedrag)}</td>
                              <td className="px-5 py-3 text-dc-gray-500">
                                {isEenmaligFacturerenAan(regel.eenmaligFactureren) ? 'Ja' : regel.eenmaligFactureren || 'Nee'}
                              </td>
                              <td className="px-5 py-3 text-dc-gray-500">{regel.startActief || '-'}</td>
                              <td className="px-5 py-3 text-dc-gray-500">{regel.stopActief || '-'}</td>
                              <td className="px-5 py-3 text-dc-gray-500">{regel.exportStart || '-'} - {regel.exportEnd || '-'}</td>
                              <td className="sticky right-0 z-10 px-5 py-3 text-dc-gray-400 bg-white shadow-[-1px_0_0_0_rgb(229_231_235)]">
                                <div className="text-[11px] leading-4">
                                  <div>Telling: {regel.telling || '-'}</div>
                                  <div>Resource?: {usesResourceTelling(regel.telling) ? 'Ja' : 'Nee'}</div>
                                  <div>Bron aantal: {formatDutchNumber(regel.bronAantal)}</div>
                                  <div>Basis aantal: {formatDutchNumber(regel.basisAantal)}{usesResourceTelling(regel.telling) ? ' (Resource)' : ''}</div>
                                  <div>Telling veld: {formatDutchNumber(regel.tellingWaarde)}</div>
                                  <div>
                                    Gebruikt: {formatDutchNumber(regel.aantal)}
                                    {isKwartaalFactuurPeriode(item.factuurPeriode)
                                      ? ` (x${regel.actieveMaanden || 0} kwartaalmaanden)`
                                      : isHalfJaarFactuurPeriode(item.factuurPeriode)
                                        ? ' (x6 halfjaarmaanden)'
                                      : isJaarFactuurPeriode(item.factuurPeriode)
                                        ? ' (x12 jaarmaanden)'
                                      : usesResourceTelling(regel.telling)
                                        ? ' (Resource)'
                                        : ''}
                                  </div>
                                  <div>Export van/t/m: {regel.exportStart || '-'} - {regel.exportEnd || '-'}</div>
                                </div>
                              </td>
                            </tr>
                          ))}
                        {isOpen && regels.length === 0 && (
                          <tr className="dc-zebra-row">
                            <td colSpan={10} className="px-5 py-6 text-center text-dc-gray-300 text-sm">
                              Geen artikelregels gevonden binnen de gekozen periodefilters
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                  {geselecteerdeAbonnementen.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-5 py-8 text-center text-dc-gray-300 text-sm">
                        Selecteer eerst abonnementen in het tabblad Abonnementen
                      </td>
                    </tr>
                  )}
                  {geselecteerdeAbonnementen.length > 0 && filteredExactTreeAbonnementen.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-5 py-8 text-center text-dc-gray-300 text-sm">
                        {exactZoek.trim()
                          ? 'Geen abonnementen of artikelregels gevonden voor de huidige zoekopdracht'
                          : 'Geen exporteerbare Exact-regels gevonden voor de huidige selectie en periode'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'status-abonnementen' && (
          <div className="bg-white rounded-xl border border-dc-gray-100 p-6">
            <div className="flex flex-col lg:flex-row gap-3 lg:items-end mb-6">
              <div className="w-full max-w-[120px]">
                <label className="block text-xs font-medium text-dc-gray-400 mb-1">Jaar</label>
                <ComboBox
                  value={selectedJaar}
                  onChange={setSelectedJaar}
                  options={jaarOpties.map((option) => ({ value: option, label: option }))}
                  placeholder="Jaar"
                  searchable={false}
                />
              </div>
              <div className="w-full max-w-[220px]">
                <label className="block text-xs font-medium text-dc-gray-400 mb-1">Periode</label>
                <ComboBox
                  value={selectedPeriode}
                  onChange={setSelectedPeriode}
                  options={MAANDEN.map((maand) => ({ value: maand, label: maand }))}
                  placeholder="Periode"
                  searchable={false}
                  sortOptions={false}
                />
              </div>
              <div className="w-full max-w-[180px]">
                <label className="block text-xs font-medium text-dc-gray-400 mb-1">Alleen errors tonen</label>
                <YesNoSlicer value={alleenErrorsTonen} onChange={setAlleenErrorsTonen} />
              </div>
              <button
                type="button"
                disabled={readingAbonnementen}
                onClick={() => void handleLeesAbonnementen()}
                className="h-[38px] px-4 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {readingAbonnementen && <Loader2 className="inline w-4 h-4 mr-2 animate-spin" />}
                {readingAbonnementen ? 'Bezig...' : 'Inlezen abonnementen'}
              </button>
              <button
                type="button"
                onClick={handlePrintStatusAbonnementenOverview}
                disabled={printingOverview || filteredStatusAbonnementen.length === 0}
                className="h-[38px] px-4 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {printingOverview && <Loader2 className="inline w-4 h-4 mr-2 animate-spin" />}
                {printingOverview ? 'Bezig...' : 'Printen overzicht'}
              </button>
              <div className="text-sm text-dc-gray-400">
                Overzicht van actieve abonnementen. Kolom <span className="font-medium text-dc-gray-500">Factuurdatum</span> gebruikt
                veld <span className="font-medium text-dc-gray-500">Laatste factuurdatum</span> en de statuscontrole rekent op
                gekozen <span className="font-medium text-dc-gray-500">Jaar</span> en <span className="font-medium text-dc-gray-500">Periode</span>.
              </div>
            </div>

            <LoadingSpinner active={readingAbonnementen} message="Actieve abonnementen laden uit Ninox..." />

            {abonnementenFout && (
              <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                Ninox laden mislukt: {abonnementenFout}
              </div>
            )}

            <div className="mb-4 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dc-gray-300" />
              <input
                type="text"
                value={statusAbonnementenZoek}
                onChange={(e) => setStatusAbonnementenZoek(e.target.value)}
                placeholder="Zoeken op relatie, onderdeel, abonnement of factuurdatum..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-dc-gray-100 rounded-lg text-sm text-dc-gray-500 placeholder:text-dc-gray-300 focus:outline-none focus:ring-2 focus:ring-dc-blue-500/30 focus:border-dc-blue-500"
              />
            </div>

            <div className="mb-4 text-sm text-dc-gray-400">
              Actieve abonnementen: <span className="font-medium text-dc-gray-500">{filteredStatusAbonnementen.length}</span>
            </div>

            <div className="bg-white rounded-xl border border-dc-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dc-gray-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400">Relatie</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400">Onderdeel</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400">Status info</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400">Abonnement</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400">Factuurdatum</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400">Laatste factuurperiode</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400">Facturen in de maand</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400">Factuur periode</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStatusAbonnementen.map((item) => {
                    const facturatieStatus = getFacturatieAchterstandStatus(item, selectedJaar, selectedPeriode);
                    return (
                      <tr key={item.id} className="dc-zebra-row">
                        <td className="px-5 py-3 text-dc-gray-500">{item.relatie || '-'}</td>
                        <td className="px-5 py-3 text-dc-gray-500">{item.onderdeel || '-'}</td>
                        <td className="px-5 py-3 text-dc-gray-500">{item.statusInfo || '-'}</td>
                        <td className="px-5 py-3 text-dc-gray-500">{item.abonnement || '-'}</td>
                        <td className="px-5 py-3 text-dc-gray-500">{item.laatsteFactuurdatum || '-'}</td>
                        <td className="px-5 py-3 text-dc-gray-500">{item.laatsteFactuurperiode || '-'}</td>
                        <td className="px-5 py-3 text-dc-gray-500">{item.facturenInDeMaand || '-'}</td>
                        <td className="px-5 py-3 text-dc-gray-500">{item.factuurPeriode || '-'}</td>
                        <td className="px-5 py-3 text-dc-gray-500">
                          {facturatieStatus.waarschuwing ? (
                            <span
                              className="inline-flex items-center justify-center rounded-full border border-red-200 bg-red-50 p-1"
                              title={facturatieStatus.titel}
                            >
                              <AlertTriangle className="w-4 h-4 text-red-600" />
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!readingAbonnementen && abonnementenLoaded && filteredStatusAbonnementen.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-5 py-8 text-center text-dc-gray-300 text-sm">
                        {abonnementen.length === 0
                          ? 'Geen abonnementen gevonden'
                          : 'Geen actieve abonnementen gevonden voor de huidige zoekopdracht'}
                      </td>
                    </tr>
                  )}
                  {!readingAbonnementen && !abonnementenLoaded && (
                    <tr>
                      <td colSpan={9} className="px-5 py-8 text-center text-dc-gray-300 text-sm">
                        Klik op &apos;Inlezen abonnementen&apos; om resultaten te tonen
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
          </>
        )}

        {activeOnderdeel === 'ninox-api' && (
          <div className="bg-white rounded-xl border border-dc-gray-100 p-5">
            <NinoxStatusPage />
          </div>
        )}
      </div>
      <ConfirmDialog
        open={confirmExportOpen}
        title="Export verwerken"
        message={`Weet u zeker dat onderstaande regels verwerkt kunnen worden?${exactExportGroepen.length > 0 ? ` (${exactExportGroepen.length} exportgroep${exactExportGroepen.length === 1 ? '' : 'en'})` : ''}`}
        cancelLabel="Nee"
        confirmLabel="Ja"
        confirming={generatingExactCsv}
        onCancel={() => {
          if (!generatingExactCsv) {
            setConfirmExportOpen(false);
          }
        }}
        onConfirm={() => void handleGenerateExactCsv()}
      />
    </div>
  );
}
