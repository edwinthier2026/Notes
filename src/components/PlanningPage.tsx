import { CalendarDays, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createNinoxPlanRegel, deleteNinoxPlanRegel, fetchNinoxPersoneel, fetchNinoxPlanRegelTypeOpties, fetchNinoxPlanRegels, updateNinoxPlanRegel } from '../lib/ninox';
import { formatDateDdMmYyyy, formatDateTimeDdMmYyyyHhMm } from '../lib/date';
import type { Personeel, PlanRegel } from '../types';
import ConfirmDialog from './ui/ConfirmDialog';
import ComboBox from './ui/ComboBox';
import DateFieldInput from './ui/DateFieldInput';
import LoadingSpinner from './ui/LoadingSpinner';
import NumericFieldInput from './ui/NumericFieldInput';

type WeekDag = {
  key: string;
  datum: Date;
  labelKort: string;
  labelDatum: string;
};

type PlanningWeergave = 'dag' | 'werkweek' | 'week' | 'maand';

type PlanDragPreview = {
  regelId: number;
  titel: string;
  type: string;
  aantalUren: string;
  personeelId: number;
  personeelNaam: string;
  startIso: string;
  stopIso: string;
  leftPx: number;
  widthPx: number;
  topPx: number;
  label: string;
};

type PlanResizeState = {
  regel: PlanRegel;
  side: 'start' | 'end';
  initialClientX: number;
  blockTopPx: number;
  rowStepPx: number;
  hasMoved: boolean;
  preview: PlanDragPreview | null;
};

type PlanDrawState = {
  personeelId: number;
  personeelNaam: string;
  initialClientX: number;
  initialDate: Date;
  blockTopPx: number;
  rowStepPx: number;
  hasMoved: boolean;
  preview: PlanDragPreview | null;
};

type PlanDragState = {
  regel: PlanRegel;
  initialClientX: number;
  initialClientY: number;
  initialBlockLeftPx: number;
  initialRowIndex: number;
  durationMinutes: number;
  blockWidthPx: number;
  blockTopPx: number;
  rowStepPx: number;
  grabOffsetX: number;
  grabOffsetY: number;
  hasMoved: boolean;
  preview: PlanDragPreview | null;
};

const WEEKDAG_LABELS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
const PLANBORD_START_HOUR = 0;
const PLANBORD_END_HOUR = 24;
const PLANBORD_UUR_COUNT = PLANBORD_END_HOUR - PLANBORD_START_HOUR;
const PLANBORD_MEDEWERKER_BREEDTE = 160;
const PLANBORD_METRIEK_BREEDTE = 55;
const PLANBORD_DAG_BREEDTE = 288;
const PLANBORD_LINKS_BREEDTE = PLANBORD_MEDEWERKER_BREEDTE + PLANBORD_METRIEK_BREEDTE * 3;
const PLANBORD_UUR_LABELS = Array.from(
  { length: PLANBORD_UUR_COUNT },
  (_, index) => `${String(index + PLANBORD_START_HOUR).padStart(2, '0')}`
);
const PLANBORD_RIJ_HOOGTE = 36;
const PLANBLOK_VERTICAL_MARGIN = 1;
const PLANBORD_METRIEK_KOLOMMEN = [
  { key: 'verlofurenPerJaar', labelTop: 'Verlof', labelBottom: 'Saldo' },
  { key: 'verlofurenOpgenomen', labelTop: 'Verlof', labelBottom: 'Opgenomen' },
  { key: 'verlofurenResultaat', labelTop: 'Verlof', labelBottom: 'Resultaat' },
] as const;

function startVanWeek(baseDate: Date): Date {
  const current = new Date(baseDate);
  current.setHours(0, 0, 0, 0);
  const dag = current.getDay();
  const offset = dag === 0 ? -6 : 1 - dag;
  current.setDate(current.getDate() + offset);
  return current;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function buildMaandDagen(baseDate: Date): WeekDag[] {
  const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const end = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
  const days: WeekDag[] = [];
  for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, 1)) {
    const dagIndex = cursor.getDay() === 0 ? 6 : cursor.getDay() - 1;
    days.push({
      key: cursor.toISOString().slice(0, 10),
      datum: new Date(cursor),
      labelKort: WEEKDAG_LABELS[dagIndex] || '',
      labelDatum: formatDateDdMmYyyy(cursor),
    });
  }
  return days;
}

function sameDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function parseIsoDateTime(value: string | null | undefined): Date | null {
  const raw = String(value || '').trim();
  if (!raw) {
    return null;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseDdMmYyyyToDate(value: string | null | undefined): Date | null {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) {
    return null;
  }
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const probe = new Date(year, month - 1, day);
  if (
    !Number.isFinite(day) ||
    !Number.isFinite(month) ||
    !Number.isFinite(year) ||
    probe.getFullYear() !== year ||
    probe.getMonth() !== month - 1 ||
    probe.getDate() !== day
  ) {
    return null;
  }
  return probe;
}

function formatTijd(value: string | null | undefined): string {
  const raw = String(value || '').trim();
  const isoMatch = raw.match(/[T ](\d{2}):(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}:${isoMatch[2]}`;
  }
  const nlMatch = raw.match(/\b(\d{2}):(\d{2})\b/);
  if (nlMatch) {
    return `${nlMatch[1]}:${nlMatch[2]}`;
  }
  return '';
}

function buildWeekDagen(weekStart: Date): WeekDag[] {
  return Array.from({ length: 7 }, (_, index) => {
    const datum = addDays(weekStart, index);
    return {
      key: datum.toISOString().slice(0, 10),
      datum,
      labelKort: WEEKDAG_LABELS[index] || '',
      labelDatum: formatDateDdMmYyyy(datum),
    };
  });
}

function overlapsDag(item: PlanRegel, dag: Date): boolean {
  const start = parseIsoDateTime(item.startDatumTijd);
  const stop = parseIsoDateTime(item.stopDatumTijd) || start;
  if (!start || !stop) {
    return false;
  }
  const dagStart = new Date(dag);
  dagStart.setHours(0, 0, 0, 0);
  const dagEinde = new Date(dag);
  dagEinde.setHours(23, 59, 59, 999);
  return start <= dagEinde && stop >= dagStart;
}

function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function getDagSegment(regel: PlanRegel, dag: Date): { left: string; width: string; label: string } | null {
  const start = parseIsoDateTime(regel.startDatumTijd);
  const stop = parseIsoDateTime(regel.stopDatumTijd) || start;
  if (!start || !stop) {
    return null;
  }
  const dagStart = new Date(dag);
  dagStart.setHours(0, 0, 0, 0);
  const dagEinde = new Date(dag);
  dagEinde.setHours(23, 59, 59, 999);
  if (start > dagEinde || stop < dagStart) {
    return null;
  }

  const visibleStart = start < dagStart ? dagStart : start;
  const visibleStop = stop > dagEinde ? dagEinde : stop;
  const schaalStart = PLANBORD_START_HOUR * 60;
  const schaalEinde = PLANBORD_END_HOUR * 60;
  const startMinutes = Math.max(minutesOfDay(visibleStart), schaalStart);
  const stopMinutes = Math.min(minutesOfDay(visibleStop), schaalEinde);
  if (stopMinutes <= schaalStart || startMinutes >= schaalEinde || stopMinutes <= startMinutes) {
    return null;
  }
  const schaalDuur = schaalEinde - schaalStart;
  const leftPercent = ((startMinutes - schaalStart) / schaalDuur) * 100;
  const rightPercent = ((stopMinutes - schaalStart) / schaalDuur) * 100;
  const widthPercent = Math.max(rightPercent - leftPercent, 1.5);
  return {
    left: `${leftPercent}%`,
    width: `${widthPercent}%`,
    label: formatPlanLabel(regel.startDatumTijd, regel.stopDatumTijd),
  };
}

function hourLabelLeftStyle(hour: number): string {
  return `${((hour - PLANBORD_START_HOUR + 0.5) / (PLANBORD_END_HOUR - PLANBORD_START_HOUR)) * 100}%`;
}

function toDateTimeLocalValue(value: string | null | undefined): string {
  const parsed = parseIsoDateTime(value);
  if (!parsed) {
    return '';
  }
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  const hours = String(parsed.getHours()).padStart(2, '0');
  const minutes = String(parsed.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function toLocalIsoSeconds(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:00`;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizePlanSearchText(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function diffMinutes(start: Date, stop: Date): number {
  return Math.max(0, Math.round((stop.getTime() - start.getTime()) / (60 * 1000)));
}

function formatPlanLabel(startIso: string, stopIso: string): string {
  return `${formatTijd(startIso) || formatDateTimeDdMmYyyyHhMm(startIso)}${
    stopIso ? ` tot ${formatTijd(stopIso) || formatDateTimeDdMmYyyyHhMm(stopIso)}` : ''
  }`;
}

function findWeekDagIndex(weekDagen: WeekDag[], date: Date): number {
  return weekDagen.findIndex((dag) => sameDay(dag.datum, date));
}

function adjustForVerborgenDagUren(date: Date): Date {
  return date;
}

function formatPlanTooltipDatum(startIso: string, stopIso: string): string {
  const start = parseIsoDateTime(startIso);
  const stop = parseIsoDateTime(stopIso) || start;
  if (!start) {
    return '';
  }
  if (!stop || sameDay(start, stop)) {
    return formatDateDdMmYyyy(start);
  }
  return `${formatDateDdMmYyyy(start)} t/m ${formatDateDdMmYyyy(stop)}`;
}

function formatPlanMetricValue(value: string | null | undefined): string {
  const raw = String(value || '').trim();
  if (!raw) {
    return '0,00';
  }
  const normalized = raw.replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return raw;
  }
  return new Intl.NumberFormat('nl-NL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parsed);
}

function parsePlanMetricNumber(value: string | null | undefined): number {
  const raw = String(value || '').trim();
  if (!raw) {
    return 0;
  }
  const normalized = raw.replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizePlanKleur(value: string | null | undefined): string {
  const text = String(value || '').trim();
  const shortHex = text.match(/^#([0-9a-fA-F]{3})$/);
  if (shortHex) {
    const [r, g, b] = shortHex[1].split('');
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  const longHex = text.match(/^#([0-9a-fA-F]{6})$/);
  if (longHex) {
    return `#${longHex[1].toUpperCase()}`;
  }
  return '';
}

function hexToRgba(hex: string, alpha: number): string | undefined {
  const normalized = normalizePlanKleur(hex);
  const match = normalized.match(/^#([0-9A-F]{6})$/);
  if (!match) {
    return undefined;
  }
  const numeric = Number.parseInt(match[1], 16);
  const red = (numeric >> 16) & 255;
  const green = (numeric >> 8) & 255;
  const blue = numeric & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function PlanPreviewTooltip({
  titel,
  type,
  aantalUren,
  startIso,
  stopIso,
  label,
  topPx,
  rowStepPx,
}: {
  titel: string;
  type: string;
  aantalUren: string;
  startIso: string;
  stopIso: string;
  label: string;
  topPx: number;
  rowStepPx: number;
}) {
  const tooltipPositionClass = topPx <= rowStepPx ? 'top-full mt-2' : 'bottom-full mb-2';

  return (
    <div
      className={`pointer-events-none absolute left-1/2 z-40 min-w-[11rem] -translate-x-1/2 rounded-xl border border-dc-gray-200 bg-white/98 px-3 py-2 text-center shadow-xl backdrop-blur-sm ${tooltipPositionClass}`}
    >
      <div className="text-[11px] font-semibold leading-4 text-dc-gray-600">
        {[type, titel, aantalUren ? `${aantalUren} uur` : '']
          .filter((item) => String(item || '').trim().length > 0)
          .join(', ')}
      </div>
      <div className="mt-1 text-[10px] leading-3 text-dc-gray-400">
        {formatPlanTooltipDatum(startIso, stopIso)} {label ? `| ${label}` : ''}
      </div>
    </div>
  );
}

export default function PlanningPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [personeel, setPersoneel] = useState<Personeel[]>([]);
  const [planRegels, setPlanRegels] = useState<PlanRegel[]>([]);
  const [planningWeergave, setPlanningWeergave] = useState<PlanningWeergave>('week');
  const [ankerDatum, setAnkerDatum] = useState<Date>(new Date());
  const [weekPickerValue, setWeekPickerValue] = useState('');
  const [medewerkerZoekterm, setMedewerkerZoekterm] = useState('');
  const [planRegelModal, setPlanRegelModal] = useState<PlanRegel | null>(null);
  const [planRegelIsNieuw, setPlanRegelIsNieuw] = useState(false);
  const [planRegelTitel, setPlanRegelTitel] = useState('');
  const [planRegelKleur, setPlanRegelKleur] = useState('');
  const [planRegelPersoneelId, setPlanRegelPersoneelId] = useState('');
  const [planRegelType, setPlanRegelType] = useState('');
  const [planRegelAantalUren, setPlanRegelAantalUren] = useState('');
  const [planRegelStart, setPlanRegelStart] = useState('');
  const [planRegelStop, setPlanRegelStop] = useState('');
  const [planRegelTypeOpties, setPlanRegelTypeOpties] = useState<string[]>([]);
  const [planRegelError, setPlanRegelError] = useState('');
  const [planRegelSaving, setPlanRegelSaving] = useState(false);
  const [planRegelDeleting, setPlanRegelDeleting] = useState(false);
  const [planRegelVoorVerwijderen, setPlanRegelVoorVerwijderen] = useState<PlanRegel | null>(null);
  const [drawState, setDrawState] = useState<PlanDrawState | null>(null);
  const [dragState, setDragState] = useState<PlanDragState | null>(null);
  const [resizeState, setResizeState] = useState<PlanResizeState | null>(null);
  const [dragSavingId, setDragSavingId] = useState<number | null>(null);
  const boardScrollRef = useRef<HTMLDivElement | null>(null);
  const boardGridRef = useRef<HTMLDivElement | null>(null);
  const drawStateRef = useRef<PlanDrawState | null>(null);
  const dragStateRef = useRef<PlanDragState | null>(null);
  const resizeStateRef = useRef<PlanResizeState | null>(null);

  const loadPlanning = async () => {
    setLoading(true);
    try {
      const [personeelRows, planRows, typeOpties] = await Promise.all([
        fetchNinoxPersoneel(),
        fetchNinoxPlanRegels(),
        fetchNinoxPlanRegelTypeOpties().catch(() => []),
      ]);
      setPersoneel(personeelRows);
      setPlanRegels(planRows);
      setPlanRegelTypeOpties(typeOpties);
      setError('');
    } catch (err) {
      setPersoneel([]);
      setPlanRegels([]);
      setPlanRegelTypeOpties([]);
      setError(err instanceof Error ? err.message : 'Planning laden mislukt.');
    } finally {
      setLoading(false);
    }
  };

  const applyLocalPlanRegelUpdate = (id: number, patch: Partial<PlanRegel>) => {
    setPlanRegels((current) =>
      current
        .map((item) => (item.id === id ? { ...item, ...patch } : item))
        .sort((a, b) => a.startDatumTijd.localeCompare(b.startDatumTijd, 'nl', { sensitivity: 'base', numeric: true }))
    );
  };

  const autoScrollPlanbordHorizontaal = (clientX: number) => {
    const container = boardScrollRef.current;
    if (!container) {
      return;
    }
    const rect = container.getBoundingClientRect();
    const thresholdPx = 72;
    const maxStepPx = 28;
    let delta = 0;

    if (clientX > rect.right - thresholdPx) {
      const ratio = (clientX - (rect.right - thresholdPx)) / thresholdPx;
      delta = Math.ceil(Math.max(0, Math.min(1, ratio)) * maxStepPx);
    } else if (clientX < rect.left + thresholdPx) {
      const ratio = ((rect.left + thresholdPx) - clientX) / thresholdPx;
      delta = -Math.ceil(Math.max(0, Math.min(1, ratio)) * maxStepPx);
    }

    if (!delta) {
      return;
    }

    const maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth);
    container.scrollLeft = clampNumber(container.scrollLeft + delta, 0, maxScrollLeft);
  };

  useEffect(() => {
    void loadPlanning();
  }, []);

  useEffect(() => {
    drawStateRef.current = drawState;
  }, [drawState]);

  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  useEffect(() => {
    resizeStateRef.current = resizeState;
  }, [resizeState]);

  const closePlanRegelModal = () => {
    setPlanRegelModal(null);
    setPlanRegelIsNieuw(false);
    setPlanRegelTitel('');
    setPlanRegelKleur('');
    setPlanRegelPersoneelId('');
    setPlanRegelType('');
    setPlanRegelAantalUren('');
    setPlanRegelStart('');
    setPlanRegelStop('');
    setPlanRegelError('');
    setPlanRegelVoorVerwijderen(null);
  };

  const openPlanRegelModal = (regel: PlanRegel, isNieuw = false) => {
    const matchedPersoneel = personeel.find((item) => regel.personeelId && item.id === regel.personeelId) || null;

    setPlanRegelModal(regel);
    setPlanRegelIsNieuw(isNieuw);
    setPlanRegelTitel(regel.titel || '');
    setPlanRegelKleur(normalizePlanKleur(regel.kleur));
    setPlanRegelPersoneelId(matchedPersoneel ? String(matchedPersoneel.id) : regel.personeelId ? String(regel.personeelId) : '');
    setPlanRegelType(regel.type || '');
    setPlanRegelAantalUren(regel.aantalUren || '');
    setPlanRegelStart(toDateTimeLocalValue(regel.startDatumTijd));
    setPlanRegelStop(toDateTimeLocalValue(regel.stopDatumTijd));
    setPlanRegelError('');
    setPlanRegelVoorVerwijderen(null);
  };

  const handleSavePlanRegel = async () => {
    if (!planRegelModal) {
      return;
    }
    if (!planRegelTitel.trim()) {
      setPlanRegelError('Titel is verplicht.');
      return;
    }
    if (!planRegelPersoneelId) {
      setPlanRegelError('Personeel is verplicht.');
      return;
    }
    if (!planRegelStart) {
      setPlanRegelError('Start datum is verplicht.');
      return;
    }
    if (!planRegelStop) {
      setPlanRegelError('Stop datum is verplicht.');
      return;
    }
    if (new Date(planRegelStop).getTime() < new Date(planRegelStart).getTime()) {
      setPlanRegelError('Stop datum moet gelijk aan of later dan Start datum zijn.');
      return;
    }

    setPlanRegelSaving(true);
    setPlanRegelError('');
    try {
      if (planRegelIsNieuw) {
        const newId = await createNinoxPlanRegel({
          titel: planRegelTitel.trim(),
          kleur: planRegelKleur || null,
          personeelId: Number(planRegelPersoneelId),
          type: planRegelType || null,
          aantalUren: planRegelAantalUren,
          startDatumTijd: planRegelStart,
          stopDatumTijd: planRegelStop,
        });
        setPlanRegels((current) =>
          [...current, {
            id: newId,
            titel: planRegelTitel.trim(),
            kleur: planRegelKleur || undefined,
            personeelId: Number(planRegelPersoneelId),
            type: planRegelType || undefined,
            aantalUren: planRegelAantalUren || undefined,
            startDatumTijd: planRegelStart,
            stopDatumTijd: planRegelStop,
          }].sort((a, b) => a.startDatumTijd.localeCompare(b.startDatumTijd, 'nl', { sensitivity: 'base', numeric: true }))
        );
      } else {
        await updateNinoxPlanRegel(planRegelModal.id, {
          titel: planRegelTitel.trim(),
          kleur: planRegelKleur || null,
          personeelId: Number(planRegelPersoneelId),
          type: planRegelType || null,
          aantalUren: planRegelAantalUren,
          startDatumTijd: planRegelStart,
          stopDatumTijd: planRegelStop,
        });
        applyLocalPlanRegelUpdate(planRegelModal.id, {
          titel: planRegelTitel.trim(),
          kleur: planRegelKleur || undefined,
          personeelId: Number(planRegelPersoneelId),
          type: planRegelType || undefined,
          aantalUren: planRegelAantalUren || undefined,
          startDatumTijd: planRegelStart,
          stopDatumTijd: planRegelStop,
        });
      }
      closePlanRegelModal();
    } catch (err) {
      setPlanRegelError(err instanceof Error ? err.message : planRegelIsNieuw ? 'Opslaan mislukt.' : 'Bijwerken mislukt.');
    } finally {
      setPlanRegelSaving(false);
    }
  };

  const handleDeletePlanRegel = async () => {
    if (!planRegelVoorVerwijderen) {
      return;
    }

    setPlanRegelDeleting(true);
    setPlanRegelError('');
    try {
      await deleteNinoxPlanRegel(planRegelVoorVerwijderen.id);
      setPlanRegels((current) => current.filter((item) => item.id !== planRegelVoorVerwijderen.id));
      closePlanRegelModal();
    } catch (err) {
      setPlanRegelError(err instanceof Error ? err.message : 'Verwijderen mislukt.');
    } finally {
      setPlanRegelDeleting(false);
    }
  };

  const weekStart = useMemo(() => startVanWeek(ankerDatum), [ankerDatum]);

  const weekDagen = useMemo(() => buildWeekDagen(weekStart), [weekStart]);

  const zichtbareWeekDagen = useMemo(
    () => {
      if (planningWeergave === 'dag') {
        const dagIndex = ankerDatum.getDay() === 0 ? 6 : ankerDatum.getDay() - 1;
        return [
          {
            key: ankerDatum.toISOString().slice(0, 10),
            datum: new Date(ankerDatum),
            labelKort: WEEKDAG_LABELS[dagIndex] || '',
            labelDatum: formatDateDdMmYyyy(ankerDatum),
          },
        ];
      }
      if (planningWeergave === 'werkweek') {
        return weekDagen.slice(0, 5);
      }
      if (planningWeergave === 'maand') {
        return buildMaandDagen(ankerDatum);
      }
      return weekDagen;
    },
    [ankerDatum, planningWeergave, weekDagen]
  );

  const weekTitel = useMemo(() => {
    const eerste = zichtbareWeekDagen[0]?.datum;
    const laatste = zichtbareWeekDagen[zichtbareWeekDagen.length - 1]?.datum;
    if (!eerste || !laatste) {
      return '';
    }
    return `${formatDateDdMmYyyy(eerste)} t/m ${formatDateDdMmYyyy(laatste)}`;
  }, [zichtbareWeekDagen]);

  useEffect(() => {
    setWeekPickerValue(formatDateDdMmYyyy(ankerDatum));
  }, [ankerDatum]);

  const planbordGridTemplateColumns = useMemo(
    () =>
      `${PLANBORD_MEDEWERKER_BREEDTE}px repeat(${PLANBORD_METRIEK_KOLOMMEN.length}, ${PLANBORD_METRIEK_BREEDTE}px) repeat(${Math.max(
        zichtbareWeekDagen.length,
        1
      )}, minmax(${PLANBORD_DAG_BREEDTE}px, 1fr))`,
    [zichtbareWeekDagen.length]
  );

  const planbordMinWidth = useMemo(
    () => `${PLANBORD_LINKS_BREEDTE + Math.max(zichtbareWeekDagen.length, 1) * PLANBORD_DAG_BREEDTE}px`,
    [zichtbareWeekDagen.length]
  );

  const planningWeergaveOpties = useMemo(
    () => [
      { value: 'dag', label: 'Dag' },
      { value: 'werkweek', label: 'Werkweek' },
      { value: 'week', label: 'Week' },
      { value: 'maand', label: 'Maand' },
    ],
    []
  );

  const resetPeriodeLabel =
    planningWeergave === 'dag'
      ? 'Vandaag'
      : planningWeergave === 'maand'
      ? 'Deze maand'
      : 'Deze week';

  const planningKalenderJaar = ankerDatum.getFullYear();

  const personeelOpties = useMemo(
    () =>
      personeel.map((item) => ({
        value: String(item.id),
        label: item.roepnaam || item.naam || `Personeel ${item.id}`,
        subtitle: item.naam && item.roepnaam && item.roepnaam !== item.naam ? item.naam : undefined,
        searchText: `${item.roepnaam || ''} ${item.naam || ''} ${item.mailZakelijk || ''} ${item.telefoonZakelijk || ''}`,
      })),
    [personeel]
  );

  const planRegelTypeComboOpties = useMemo(
    () => planRegelTypeOpties.map((value) => ({ value, label: value })),
    [planRegelTypeOpties]
  );

  const verlofMetricsPerPersoneel = useMemo(() => {
    const jaarStart = new Date(planningKalenderJaar, 0, 1, 0, 0, 0, 0);
    const jaarEinde = new Date(planningKalenderJaar, 11, 31, 23, 59, 59, 999);
    const opgenomenByPersoneelId = new Map<number, number>();

    for (const regel of planRegels) {
      if (!regel.personeelId) {
        continue;
      }
      if (normalizePlanSearchText(regel.type || '') !== normalizePlanSearchText('Verlof')) {
        continue;
      }

      const start = parseIsoDateTime(regel.startDatumTijd);
      const stop = parseIsoDateTime(regel.stopDatumTijd) || start;
      if (!start || !stop) {
        continue;
      }
      if (start > jaarEinde || stop < jaarStart) {
        continue;
      }

      const current = opgenomenByPersoneelId.get(regel.personeelId) || 0;
      opgenomenByPersoneelId.set(regel.personeelId, current + parsePlanMetricNumber(regel.aantalUren));
    }

    const result = new Map<number, { saldo: string; opgenomen: string; resultaat: string }>();
    for (const medewerker of personeel) {
      const saldoNumber = parsePlanMetricNumber(medewerker.verlofurenPerJaar);
      const opgenomenNumber = opgenomenByPersoneelId.get(medewerker.id) || 0;
      const resultaatNumber = saldoNumber - opgenomenNumber;
      result.set(medewerker.id, {
        saldo: formatPlanMetricValue(String(saldoNumber)),
        opgenomen: formatPlanMetricValue(String(opgenomenNumber)),
        resultaat: formatPlanMetricValue(String(resultaatNumber)),
      });
    }

    return result;
  }, [personeel, planRegels, planningKalenderJaar]);

  const gefilterdPersoneel = useMemo(() => {
    const normalizedSearch = normalizePlanSearchText(medewerkerZoekterm);
    if (!normalizedSearch) {
      return personeel;
    }
    return personeel.filter((item) =>
      normalizePlanSearchText(`${item.roepnaam || ''} ${item.naam || ''}`).includes(normalizedSearch)
    );
  }, [medewerkerZoekterm, personeel]);

  const planRegelsPerPersoneelDag = useMemo(() => {
    const result = new Map<string, PlanRegel[]>();
    for (const medewerker of gefilterdPersoneel) {
      for (const dag of zichtbareWeekDagen) {
        const key = `${medewerker.id}-${dag.key}`;
        const regels = planRegels
          .filter((item) => {
            const matchOpId = typeof item.personeelId === 'number' && Number.isFinite(item.personeelId) && item.personeelId === medewerker.id;
            return matchOpId && overlapsDag(item, dag.datum);
          })
          .sort((a, b) => a.startDatumTijd.localeCompare(b.startDatumTijd, 'nl', { sensitivity: 'base', numeric: true }));
        result.set(key, regels);
      }
    }
    return result;
  }, [gefilterdPersoneel, planRegels, zichtbareWeekDagen]);

  const totaalWeekRegels = useMemo(() => {
    const eerste = zichtbareWeekDagen[0]?.datum;
    const laatste = zichtbareWeekDagen[zichtbareWeekDagen.length - 1]?.datum;
    if (!eerste || !laatste) {
      return 0;
    }
    const laatsteDag = new Date(laatste);
    laatsteDag.setHours(23, 59, 59, 999);
    return planRegels.filter((item) => {
      const start = parseIsoDateTime(item.startDatumTijd);
      const stop = parseIsoDateTime(item.stopDatumTijd) || start;
      return Boolean(start && stop && start <= laatsteDag && stop >= eerste);
    }).length;
  }, [planRegels, zichtbareWeekDagen]);

  const resolveDragPreview = (
    clientX: number,
    clientY: number,
    drag: PlanDragState
  ): PlanDragPreview | null => {
    const board = boardGridRef.current;
    if (!board || zichtbareWeekDagen.length === 0 || gefilterdPersoneel.length === 0) {
      return null;
    }

    const rect = board.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const medewerkerKolomBreedte = PLANBORD_LINKS_BREEDTE;
    const dagenvakBreedte = rect.width - medewerkerKolomBreedte;
    const schaalDuurMinuten = (PLANBORD_END_HOUR - PLANBORD_START_HOUR) * 60;
    if (dagenvakBreedte <= 0 || localY < 0 || localY > rect.height || localX < medewerkerKolomBreedte || localX > rect.width) {
      return null;
    }

    const visibleDayCount = zichtbareWeekDagen.length;
    const dayWidth = dagenvakBreedte / visibleDayCount;
    const oorspronkelijkeStart = parseIsoDateTime(drag.regel.startDatumTijd);
    if (!oorspronkelijkeStart) {
      return null;
    }
    const blockLeft = clampNumber(localX - drag.grabOffsetX, medewerkerKolomBreedte, rect.width - drag.blockWidthPx);
    const deltaY = clientY - drag.initialClientY;
    const rowSwitchThreshold = PLANBORD_RIJ_HOOGTE * 0.6;
    const rowShift =
      Math.abs(deltaY) >= rowSwitchThreshold ? Math.round(deltaY / PLANBORD_RIJ_HOOGTE) : 0;
    const rowIndex = Math.max(0, Math.min(gefilterdPersoneel.length - 1, drag.initialRowIndex + rowShift));
    const medewerker = gefilterdPersoneel[rowIndex];
    if (!medewerker) {
      return null;
    }

    const deltaBlockLeftPx = blockLeft - drag.initialBlockLeftPx;
    const deltaMinutes = Math.round(((deltaBlockLeftPx / dayWidth) * schaalDuurMinuten) / 60) * 60;
    const nextStart = addMinutes(oorspronkelijkeStart, deltaMinutes);
    const nextStop = addMinutes(nextStart, drag.durationMinutes);

    return {
      regelId: drag.regel.id,
      titel: drag.regel.titel || '-',
      type: drag.regel.type || '',
      aantalUren: drag.regel.aantalUren || '',
      personeelId: medewerker.id,
      personeelNaam: medewerker.roepnaam || medewerker.naam || '',
      startIso: toLocalIsoSeconds(nextStart),
      stopIso: toLocalIsoSeconds(nextStop),
      leftPx: blockLeft,
      widthPx: drag.blockWidthPx,
      topPx: drag.blockTopPx + rowShift * drag.rowStepPx,
      label: formatPlanLabel(toLocalIsoSeconds(nextStart), toLocalIsoSeconds(nextStop)),
    };
  };

  const resolveResizePreview = (
    clientX: number,
    resize: PlanResizeState
  ): PlanDragPreview | null => {
    const board = boardGridRef.current;
    if (!board || zichtbareWeekDagen.length === 0) {
      return null;
    }

    const originalStart = parseIsoDateTime(resize.regel.startDatumTijd);
    const originalStop = parseIsoDateTime(resize.regel.stopDatumTijd) || originalStart;
    if (!originalStart || !originalStop) {
      return null;
    }

    const rect = board.getBoundingClientRect();
    const medewerkerKolomBreedte = PLANBORD_LINKS_BREEDTE;
    const dagenvakBreedte = rect.width - medewerkerKolomBreedte;
    if (dagenvakBreedte <= 0) {
      return null;
    }

    const visibleDayCount = zichtbareWeekDagen.length;
    const dayWidth = dagenvakBreedte / visibleDayCount;
    const schaalDuurMinuten = (PLANBORD_END_HOUR - PLANBORD_START_HOUR) * 60;
    const localX = clampNumber(clientX - rect.left, medewerkerKolomBreedte, rect.width);
    const relativeX = localX - medewerkerKolomBreedte;
    const dayIndex = clampNumber(Math.floor(relativeX / dayWidth), 0, visibleDayCount - 1);
    const withinDayX = clampNumber(relativeX - dayIndex * dayWidth, 0, dayWidth);
    const rawMinutes = (withinDayX / dayWidth) * schaalDuurMinuten;
    const snappedOffset = Math.round(rawMinutes / 60) * 60;
    const snappedDag = new Date(zichtbareWeekDagen[dayIndex].datum);
    snappedDag.setHours(0, 0, 0, 0);
    const snappedDateRaw = addMinutes(snappedDag, PLANBORD_START_HOUR * 60 + snappedOffset);
    const referenceDate = resize.side === 'start' ? originalStart : originalStop;
    const referenceDayIndex = findWeekDagIndex(zichtbareWeekDagen, referenceDate);
    const snappedDate =
      referenceDayIndex >= 0
        ? adjustForVerborgenDagUren(snappedDateRaw)
        : snappedDateRaw;

    const eersteDag = new Date(zichtbareWeekDagen[0].datum);
    eersteDag.setHours(PLANBORD_START_HOUR, 0, 0, 0);
    const laatsteDag = new Date(zichtbareWeekDagen[zichtbareWeekDagen.length - 1].datum);
    laatsteDag.setHours(PLANBORD_END_HOUR, 0, 0, 0);

    const clampDate = (date: Date, min: Date, max: Date) =>
      new Date(clampNumber(date.getTime(), min.getTime(), max.getTime()));

    const dateToBoardPx = (date: Date): number => {
      const matchedDayIndex = zichtbareWeekDagen.findIndex((dag) => sameDay(dag.datum, date));
      const safeDayIndex = clampNumber(matchedDayIndex >= 0 ? matchedDayIndex : 0, 0, visibleDayCount - 1);
      const schaalStart = PLANBORD_START_HOUR * 60;
      const minuteOffset = clampNumber(minutesOfDay(date) - schaalStart, 0, schaalDuurMinuten);
      return medewerkerKolomBreedte + safeDayIndex * dayWidth + (minuteOffset / schaalDuurMinuten) * dayWidth;
    };

    let nextStart = originalStart;
    let nextStop = originalStop;
    if (resize.side === 'start') {
      const maxStart = addMinutes(originalStop, -60);
      nextStart = clampDate(snappedDate, eersteDag, maxStart);
    } else {
      const minStop = addMinutes(originalStart, 60);
      nextStop = clampDate(snappedDate, minStop, laatsteDag);
    }

    const startIso = toLocalIsoSeconds(nextStart);
    const stopIso = toLocalIsoSeconds(nextStop);
    const leftPx = dateToBoardPx(nextStart);
    const rightPx = dateToBoardPx(nextStop);

    return {
      regelId: resize.regel.id,
      titel: resize.regel.titel || '-',
      type: resize.regel.type || '',
      aantalUren: resize.regel.aantalUren || '',
      personeelId: resize.regel.personeelId || 0,
      personeelNaam: resize.regel.personeelNaam || '',
      startIso,
      stopIso,
      leftPx,
      widthPx: Math.max(rightPx - leftPx, 12),
      topPx: resize.blockTopPx,
      label: formatPlanLabel(startIso, stopIso),
    };
  };

  const resolveDrawPreview = (
    clientX: number,
    draw: PlanDrawState
  ): PlanDragPreview | null => {
    const board = boardGridRef.current;
    if (!board || zichtbareWeekDagen.length === 0) {
      return null;
    }

    const rect = board.getBoundingClientRect();
    const medewerkerKolomBreedte = PLANBORD_LINKS_BREEDTE;
    const dagenvakBreedte = rect.width - medewerkerKolomBreedte;
    if (dagenvakBreedte <= 0) {
      return null;
    }

    const visibleDayCount = zichtbareWeekDagen.length;
    const dayWidth = dagenvakBreedte / visibleDayCount;
    const schaalDuurMinuten = (PLANBORD_END_HOUR - PLANBORD_START_HOUR) * 60;
    const localX = clampNumber(clientX - rect.left, medewerkerKolomBreedte, rect.width);
    const relativeX = localX - medewerkerKolomBreedte;
    const dayIndex = clampNumber(Math.floor(relativeX / dayWidth), 0, visibleDayCount - 1);
    const withinDayX = clampNumber(relativeX - dayIndex * dayWidth, 0, dayWidth);
    const rawMinutes = (withinDayX / dayWidth) * schaalDuurMinuten;
    const snappedOffset = Math.round(rawMinutes / 60) * 60;
    const snappedDay = new Date(zichtbareWeekDagen[dayIndex].datum);
    snappedDay.setHours(0, 0, 0, 0);
    const snappedDateRaw = addMinutes(snappedDay, PLANBORD_START_HOUR * 60 + snappedOffset);
    const initialDayIndex = findWeekDagIndex(zichtbareWeekDagen, draw.initialDate);
    const snappedDate =
      initialDayIndex >= 0
        ? adjustForVerborgenDagUren(snappedDateRaw)
        : snappedDateRaw;

    const startDate =
      snappedDate.getTime() <= draw.initialDate.getTime() ? snappedDate : draw.initialDate;
    const stopAnchor =
      snappedDate.getTime() >= draw.initialDate.getTime() ? snappedDate : draw.initialDate;
    const stopDate = addMinutes(stopAnchor, 60);
    const startIso = toLocalIsoSeconds(startDate);
    const stopIso = toLocalIsoSeconds(stopDate);

    const dateToBoardPx = (date: Date): number => {
      const matchedDayIndex = zichtbareWeekDagen.findIndex((dag) => sameDay(dag.datum, date));
      const safeDayIndex = clampNumber(matchedDayIndex >= 0 ? matchedDayIndex : 0, 0, visibleDayCount - 1);
      const schaalStart = PLANBORD_START_HOUR * 60;
      const minuteOffset = clampNumber(minutesOfDay(date) - schaalStart, 0, schaalDuurMinuten);
      return medewerkerKolomBreedte + safeDayIndex * dayWidth + (minuteOffset / schaalDuurMinuten) * dayWidth;
    };

    const leftPx = dateToBoardPx(startDate);
    const rightPx = dateToBoardPx(stopDate);
    return {
      regelId: 0,
      titel: 'Nieuw planblok',
      type: '',
      aantalUren: '',
      personeelId: draw.personeelId,
      personeelNaam: draw.personeelNaam,
      startIso,
      stopIso,
      leftPx,
      widthPx: Math.max(rightPx - leftPx, 12),
      topPx: draw.blockTopPx,
      label: formatPlanLabel(startIso, stopIso),
    };
  };

  useEffect(() => {
    if (!drawState) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      autoScrollPlanbordHorizontaal(event.clientX);
      setDrawState((current) => {
        if (!current) {
          return current;
        }
        const moved = current.hasMoved || Math.abs(event.clientX - current.initialClientX) > 4;
        if (!moved) {
          return current;
        }
        return {
          ...current,
          hasMoved: true,
          preview: resolveDrawPreview(event.clientX, current) || current.preview,
        };
      });
    };

    const handlePointerUp = () => {
      const current = drawStateRef.current;
      if (!current) {
        return;
      }
      const preview = current.preview;
      setDrawState(null);
      if (!current.hasMoved || !preview) {
        return;
      }

      openPlanRegelModal(
        {
          id: 0,
          titel: '',
          kleur: '',
          personeelId: preview.personeelId,
          personeelNaam: preview.personeelNaam,
          startDatumTijd: preview.startIso,
          stopDatumTijd: preview.stopIso,
        },
        true
      );
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [drawState, zichtbareWeekDagen]);

  useEffect(() => {
    if (!dragState) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      autoScrollPlanbordHorizontaal(event.clientX);
      setDragState((current) => {
        if (!current) {
          return current;
        }
        const moved =
          current.hasMoved ||
          Math.abs(event.clientX - current.initialClientX) > 4 ||
          Math.abs(event.clientY - current.initialClientY) > 4;
        if (!moved) {
          return current;
        }
        return {
          ...current,
          hasMoved: true,
          preview: resolveDragPreview(event.clientX, event.clientY, current) || current.preview,
        };
      });
    };

    const handlePointerUp = () => {
      const current = dragStateRef.current;
      if (!current) {
        return;
      }
      if (!current.hasMoved) {
        setDragState(null);
        openPlanRegelModal(current.regel);
        return;
      }

      const preview = current.preview;
      const originalStart = parseIsoDateTime(current.regel.startDatumTijd);
      const originalStop = parseIsoDateTime(current.regel.stopDatumTijd) || originalStart;
      const previewStart = parseIsoDateTime(preview?.startIso);
      const previewStop = parseIsoDateTime(preview?.stopIso);
      const startChanged = originalStart && previewStart ? originalStart.getTime() !== previewStart.getTime() : false;
      const stopChanged = originalStop && previewStop ? originalStop.getTime() !== previewStop.getTime() : false;
      const personeelChanged = Boolean(preview && preview.personeelId && preview.personeelId !== current.regel.personeelId);

      if (!preview || (!startChanged && !stopChanged && !personeelChanged)) {
        setDragState(null);
        return;
      }

      const originalPatch: Partial<PlanRegel> = {
        personeelId: current.regel.personeelId,
        startDatumTijd: current.regel.startDatumTijd,
        stopDatumTijd: current.regel.stopDatumTijd,
      };
      const nextPatch: Partial<PlanRegel> = {
        personeelId: preview.personeelId,
        startDatumTijd: preview.startIso,
        stopDatumTijd: preview.stopIso,
      };

      setError('');
      setDragSavingId(current.regel.id);
      applyLocalPlanRegelUpdate(current.regel.id, nextPatch);
      setDragState(null);

      void (async () => {
        try {
          await updateNinoxPlanRegel(current.regel.id, {
            titel: current.regel.titel || '',
            kleur: current.regel.kleur || null,
            personeelId: preview.personeelId,
            startDatumTijd: preview.startIso,
            stopDatumTijd: preview.stopIso,
          });
        } catch (err) {
          applyLocalPlanRegelUpdate(current.regel.id, originalPatch);
          setError(err instanceof Error ? err.message : 'Planning verplaatsen mislukt.');
        } finally {
          setDragSavingId(null);
        }
      })();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragState, gefilterdPersoneel, zichtbareWeekDagen]);

  useEffect(() => {
    if (!resizeState) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      autoScrollPlanbordHorizontaal(event.clientX);
      setResizeState((current) => {
        if (!current) {
          return current;
        }
        const moved = current.hasMoved || Math.abs(event.clientX - current.initialClientX) > 4;
        if (!moved) {
          return current;
        }
        return {
          ...current,
          hasMoved: true,
          preview: resolveResizePreview(event.clientX, current) || current.preview,
        };
      });
    };

    const handlePointerUp = () => {
      const current = resizeStateRef.current;
      if (!current) {
        return;
      }
      if (!current.hasMoved) {
        setResizeState(null);
        return;
      }

      const preview = current.preview;
      const startChanged = Boolean(preview && preview.startIso !== current.regel.startDatumTijd);
      const stopChanged = Boolean(preview && preview.stopIso !== current.regel.stopDatumTijd);
      if (!preview || (!startChanged && !stopChanged)) {
        setResizeState(null);
        return;
      }

      const originalPatch: Partial<PlanRegel> = {
        startDatumTijd: current.regel.startDatumTijd,
        stopDatumTijd: current.regel.stopDatumTijd,
      };
      const nextPatch: Partial<PlanRegel> = {
        startDatumTijd: preview.startIso,
        stopDatumTijd: preview.stopIso,
      };

      setError('');
      setDragSavingId(current.regel.id);
      applyLocalPlanRegelUpdate(current.regel.id, nextPatch);
      setResizeState(null);

      void (async () => {
        try {
          await updateNinoxPlanRegel(current.regel.id, {
            titel: current.regel.titel || '',
            kleur: current.regel.kleur || null,
            personeelId: current.regel.personeelId || null,
            startDatumTijd: preview.startIso,
            stopDatumTijd: preview.stopIso,
          });
        } catch (err) {
          applyLocalPlanRegelUpdate(current.regel.id, originalPatch);
          setError(err instanceof Error ? err.message : 'Planningduur wijzigen mislukt.');
        } finally {
          setDragSavingId(null);
        }
      })();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [resizeState, zichtbareWeekDagen]);

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <CalendarDays size={24} className="text-dc-blue-500" />
          <h1 className="text-2xl font-semibold text-dc-gray-500">Planning</h1>
        </div>
        <p className="text-sm text-dc-gray-400">
          Planbord op basis van tabel PlanRegels ({totaalWeekRegels} regels in deze periode)
        </p>
      </div>

      <div className="bg-white rounded-xl border border-dc-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-dc-blue-500 flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-dc-gray-500">Weekoverzicht</div>
            <div className="mt-0.5 flex items-center gap-2 text-sm text-dc-gray-400">
              <span>{weekTitel}</span>
              <DateFieldInput
                value={weekPickerValue}
                onChange={(value) => {
                  setWeekPickerValue(value);
                  const parsed = parseDdMmYyyyToDate(value);
                  if (parsed) {
                    setAnkerDatum(parsed);
                  }
                }}
                placeholder="dd/mm/yyyy"
                iconOnly={true}
                buttonClassName="rounded-md p-1 text-dc-gray-400 hover:bg-dc-gray-50 hover:text-dc-blue-500"
                buttonTitle="Kies andere week"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-dc-gray-400 whitespace-nowrap">Tonen op</span>
              <div className="w-36">
                <ComboBox
                  value={planningWeergave}
                  onChange={(value) => setPlanningWeergave(value as PlanningWeergave)}
                  options={planningWeergaveOpties}
                  placeholder="Kies weergave"
                  searchPlaceholder="Zoek weergave..."
                  emptyText="Geen weergave gevonden"
                  sortOptions={false}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setAnkerDatum((current) => {
                  if (planningWeergave === 'dag') {
                    return addDays(current, -1);
                  }
                  if (planningWeergave === 'maand') {
                    return new Date(current.getFullYear(), current.getMonth() - 1, current.getDate());
                  }
                  return addDays(current, -7);
                });
              }}
              className="px-3 py-2 rounded-lg border border-dc-gray-200 text-sm font-medium text-dc-gray-500 hover:bg-dc-gray-50"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => {
                setAnkerDatum(new Date());
              }}
              className="px-4 py-2 rounded-lg bg-dc-blue-500 text-white text-sm font-medium hover:bg-dc-blue-600"
            >
              {resetPeriodeLabel}
            </button>
            <button
              type="button"
              onClick={() => {
                setAnkerDatum((current) => {
                  if (planningWeergave === 'dag') {
                    return addDays(current, 1);
                  }
                  if (planningWeergave === 'maand') {
                    return new Date(current.getFullYear(), current.getMonth() + 1, current.getDate());
                  }
                  return addDays(current, 7);
                });
              }}
              className="px-3 py-2 rounded-lg border border-dc-gray-200 text-sm font-medium text-dc-gray-500 hover:bg-dc-gray-50"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {error && (
          <div className="m-5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {loading ? (
          <div className="p-6">
            <LoadingSpinner active={true} message="Planning laden uit Ninox..." />
          </div>
        ) : (
          <div ref={boardScrollRef} className="overflow-auto">
            <div
              className="relative grid"
              style={{ gridTemplateColumns: planbordGridTemplateColumns, minWidth: planbordMinWidth }}
            >
              <div className="sticky left-0 z-20 bg-dc-gray-50 border-b border-r border-dc-gray-100 px-4 py-3">
                <div className="text-xs font-semibold uppercase text-dc-gray-400">Medewerker</div>
                <input
                  type="text"
                  value={medewerkerZoekterm}
                  onChange={(event) => setMedewerkerZoekterm(event.target.value)}
                  placeholder="Zoek medewerker..."
                  className="mt-2 w-full rounded-lg border border-dc-gray-200 bg-white px-2.5 py-1.5 text-xs font-normal text-dc-gray-500 outline-none focus:border-dc-blue-500"
                />
              </div>
              {PLANBORD_METRIEK_KOLOMMEN.map((kolom) => (
                <div
                  key={kolom.key}
                  className="border-b border-dc-gray-100 bg-dc-gray-50 px-2 py-3 text-center text-[11px] font-semibold leading-tight text-dc-gray-400"
                >
                  <div>{kolom.labelTop}</div>
                  <div>{kolom.labelBottom}</div>
                </div>
              ))}
              {zichtbareWeekDagen.map((dag, dayIndex) => (
                <div
                  key={dag.key}
                  className={`relative border-b border-dc-gray-100 py-2 text-center ${
                    sameDay(dag.datum, new Date()) ? 'bg-dc-blue-50' : 'bg-dc-gray-50'
                  } ${dayIndex > 0 ? 'border-l' : ''}`}
                  style={dayIndex > 0 ? { borderLeftColor: '#2563EB' } : undefined}
                >
                  <div className="px-4">
                    <div
                      className={`text-xs font-semibold uppercase ${
                        dag.labelKort === 'Za' || dag.labelKort === 'Zo' ? 'text-red-500' : 'text-dc-gray-400'
                      }`}
                    >
                      {dag.labelKort}
                    </div>
                    <div className="mt-0 text-sm font-medium text-dc-gray-500 leading-tight">{dag.labelDatum}</div>
                  </div>
                  <div className="relative mt-1 h-4 overflow-hidden">
                    {PLANBORD_UUR_LABELS.map((label, index) => {
                      const hour = index + PLANBORD_START_HOUR;
                      return (
                        <div
                          key={`${dag.key}-${label}`}
                          className="absolute top-0 -translate-x-1/2 text-[9px] text-dc-blue-500 whitespace-nowrap [writing-mode:vertical-rl] rotate-180 leading-none"
                          style={{ left: hourLabelLeftStyle(hour) }}
                        >
                          {label}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div
              ref={boardGridRef}
              className="relative grid"
              style={{ gridTemplateColumns: planbordGridTemplateColumns, minWidth: planbordMinWidth }}
            >
              <div className="pointer-events-none absolute inset-0 grid" style={{ gridTemplateColumns: planbordGridTemplateColumns }}>
                <div />
                {PLANBORD_METRIEK_KOLOMMEN.map((kolom) => (
                  <div key={`metric-overlay-${kolom.key}`} />
                ))}
                {zichtbareWeekDagen.map((dag) => (
                  <div
                    key={`${dag.key}-overlay`}
                    className=""
                    style={{
                      backgroundImage:
                        `repeating-linear-gradient(to right, rgba(148, 163, 184, 0.22) 0px, rgba(148, 163, 184, 0.22) 1px, transparent 1px, transparent calc(100% / ${PLANBORD_UUR_COUNT}))`,
                    }}
                  />
                ))}
              </div>

              {dragState?.hasMoved && dragState.preview && (
                <div className="pointer-events-none absolute inset-0 z-30">
                  <div
                    className="absolute overflow-visible opacity-95"
                    style={{
                      left: `${dragState.preview.leftPx}px`,
                      top: `${dragState.preview.topPx}px`,
                      width: `${dragState.preview.widthPx}px`,
                      height: `${Math.max(dragState.rowStepPx - PLANBLOK_VERTICAL_MARGIN * 2, 12)}px`,
                    }}
                  >
                    <PlanPreviewTooltip
                      titel={dragState.preview.titel}
                      type={dragState.preview.type}
                      aantalUren={dragState.preview.aantalUren}
                      startIso={dragState.preview.startIso}
                      stopIso={dragState.preview.stopIso}
                      label={dragState.preview.label}
                      topPx={dragState.preview.topPx}
                      rowStepPx={dragState.rowStepPx}
                    />
                    <div
                      className="flex h-full min-w-0 flex-col justify-center rounded-md border border-dc-blue-400 bg-gradient-to-r from-dc-blue-200 to-dc-blue-100 px-1.5 py-0 shadow-md overflow-hidden"
                      style={{
                        background: hexToRgba(dragState.regel.kleur || '', 0.22) || undefined,
                        backgroundColor: hexToRgba(dragState.regel.kleur || '', 0.22) || undefined,
                        borderColor: normalizePlanKleur(dragState.regel.kleur) || undefined,
                      }}
                    >
                      <div className="truncate text-center text-[11px] font-semibold leading-4 text-dc-blue-700">{dragState.preview.titel}</div>
                      <div className="truncate text-center text-[10px] leading-3 text-dc-gray-500">{dragState.preview.label}</div>
                    </div>
                  </div>
                </div>
              )}

              {drawState?.hasMoved && drawState.preview && (
                <div className="pointer-events-none absolute inset-0 z-30">
                  <div
                    className="absolute overflow-visible opacity-95"
                    style={{
                      left: `${drawState.preview.leftPx}px`,
                      top: `${drawState.preview.topPx}px`,
                      width: `${drawState.preview.widthPx}px`,
                      height: `${Math.max(drawState.rowStepPx - PLANBLOK_VERTICAL_MARGIN * 2, 12)}px`,
                    }}>
                    <PlanPreviewTooltip
                      titel={drawState.preview.titel}
                      type={drawState.preview.type}
                      aantalUren={drawState.preview.aantalUren}
                      startIso={drawState.preview.startIso}
                      stopIso={drawState.preview.stopIso}
                      label={drawState.preview.label}
                      topPx={drawState.preview.topPx}
                      rowStepPx={drawState.rowStepPx}
                    />
                    <div className="flex h-full min-w-0 flex-col justify-center overflow-hidden rounded-md border border-dc-blue-400 bg-dc-blue-100/80 px-1.5 py-0 shadow-md">
                      <div className="truncate text-center text-[11px] font-semibold leading-4 text-dc-blue-700">{drawState.preview.titel}</div>
                      <div className="truncate text-center text-[10px] leading-3 text-dc-gray-500">{drawState.preview.label}</div>
                    </div>
                  </div>
                </div>
              )}

              {resizeState?.hasMoved && resizeState.preview && (
                <div className="pointer-events-none absolute inset-0 z-30">
                  <div
                    className="absolute overflow-visible opacity-95"
                    style={{
                      left: `${resizeState.preview.leftPx}px`,
                      top: `${resizeState.preview.topPx}px`,
                      width: `${resizeState.preview.widthPx}px`,
                      height: `${Math.max(resizeState.rowStepPx - PLANBLOK_VERTICAL_MARGIN * 2, 12)}px`,
                    }}
                  >
                    <PlanPreviewTooltip
                      titel={resizeState.preview.titel}
                      type={resizeState.preview.type}
                      aantalUren={resizeState.preview.aantalUren}
                      startIso={resizeState.preview.startIso}
                      stopIso={resizeState.preview.stopIso}
                      label={resizeState.preview.label}
                      topPx={resizeState.preview.topPx}
                      rowStepPx={resizeState.rowStepPx}
                    />
                    <div
                      className="flex h-full min-w-0 flex-col justify-center rounded-md border px-1.5 py-0 shadow-md overflow-hidden"
                      style={{
                        background: hexToRgba(resizeState.regel.kleur || '', 0.22) || undefined,
                        backgroundColor: hexToRgba(resizeState.regel.kleur || '', 0.22) || undefined,
                        borderColor: normalizePlanKleur(resizeState.regel.kleur) || undefined,
                      }}
                    >
                      <div className="truncate text-center text-[11px] font-semibold leading-4 text-dc-blue-700">{resizeState.preview.titel}</div>
                      <div className="truncate text-center text-[10px] leading-3 text-dc-gray-500">{resizeState.preview.label}</div>
                    </div>
                  </div>
                </div>
              )}

              {gefilterdPersoneel.map((medewerker, rowIndex) => (
                <FragmentRow
                  key={medewerker.id}
                  medewerker={medewerker}
                  metrics={
                    verlofMetricsPerPersoneel.get(medewerker.id) || {
                      saldo: '0,00',
                      opgenomen: '0,00',
                      resultaat: '0,00',
                    }
                  }
                  rowIndex={rowIndex}
                  weekDagen={zichtbareWeekDagen}
                  planRegelsPerPersoneelDag={planRegelsPerPersoneelDag}
                  onOpenPlanRegel={openPlanRegelModal}
                  onStartDrag={(regel, event) => {
                    event.preventDefault();
                    setDrawState(null);
                    setResizeState(null);
                    const buttonRect = event.currentTarget.getBoundingClientRect();
                    const boardRect = boardGridRef.current?.getBoundingClientRect();
                    const cellRect = event.currentTarget.closest<HTMLElement>('[data-plan-cell="1"]')?.getBoundingClientRect();
                    const start = parseIsoDateTime(regel.startDatumTijd);
                    const stop = parseIsoDateTime(regel.stopDatumTijd) || start;
                    const durationMinutes = start && stop ? Math.max(diffMinutes(start, stop), 1) : 60;
                    setDragState({
                      regel,
                      initialClientX: event.clientX,
                      initialClientY: event.clientY,
                      initialBlockLeftPx: boardRect ? buttonRect.left - boardRect.left : 0,
                      initialRowIndex: rowIndex,
                      durationMinutes,
                      blockWidthPx: buttonRect.width,
                      blockTopPx: boardRect ? buttonRect.top - boardRect.top : rowIndex * PLANBORD_RIJ_HOOGTE + 4,
                      rowStepPx: cellRect?.height || PLANBORD_RIJ_HOOGTE,
                      grabOffsetX: event.clientX - buttonRect.left,
                      grabOffsetY: event.clientY - buttonRect.top,
                      hasMoved: false,
                      preview: null,
                    });
                  }}
                  onStartResize={(regel, side, event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setDrawState(null);
                    setDragState(null);
                    const buttonRect = event.currentTarget.closest('button')?.getBoundingClientRect();
                    const boardRect = boardGridRef.current?.getBoundingClientRect();
                    const cellRect = event.currentTarget.closest<HTMLElement>('[data-plan-cell="1"]')?.getBoundingClientRect();
                    if (!buttonRect) {
                      return;
                    }
                    setResizeState({
                      regel,
                      side,
                      initialClientX: event.clientX,
                      blockTopPx: boardRect ? buttonRect.top - boardRect.top : rowIndex * PLANBORD_RIJ_HOOGTE + PLANBLOK_VERTICAL_MARGIN,
                      rowStepPx: cellRect?.height || PLANBORD_RIJ_HOOGTE,
                      hasMoved: false,
                      preview: null,
                    });
                  }}
                  onStartDraw={(medewerker, event) => {
                    event.preventDefault();
                    setDragState(null);
                    setResizeState(null);
                    const boardRect = boardGridRef.current?.getBoundingClientRect();
                    const cellRect = event.currentTarget.getBoundingClientRect();
                    const rect = boardGridRef.current?.getBoundingClientRect();
                    if (!rect) {
                      return;
                    }
                    const medewerkerKolomBreedte = PLANBORD_LINKS_BREEDTE;
                    const dagenvakBreedte = rect.width - medewerkerKolomBreedte;
                    const visibleDayCount = zichtbareWeekDagen.length;
                    if (dagenvakBreedte <= 0 || visibleDayCount <= 0) {
                      return;
                    }
                    const dayWidth = dagenvakBreedte / visibleDayCount;
                    const localX = clampNumber(event.clientX - rect.left, medewerkerKolomBreedte, rect.width);
                    const relativeX = localX - medewerkerKolomBreedte;
                    const dayIndex = clampNumber(Math.floor(relativeX / dayWidth), 0, visibleDayCount - 1);
                    const withinDayX = clampNumber(relativeX - dayIndex * dayWidth, 0, dayWidth);
                    const rawMinutes = (withinDayX / dayWidth) * ((PLANBORD_END_HOUR - PLANBORD_START_HOUR) * 60);
                    const snappedOffset = Math.round(rawMinutes / 60) * 60;
                    const snappedDay = new Date(zichtbareWeekDagen[dayIndex].datum);
                    snappedDay.setHours(0, 0, 0, 0);
                    const initialDate = addMinutes(snappedDay, PLANBORD_START_HOUR * 60 + snappedOffset);
                    setDrawState({
                      personeelId: medewerker.id,
                      personeelNaam: medewerker.roepnaam || medewerker.naam || '',
                      initialClientX: event.clientX,
                      initialDate,
                      blockTopPx: boardRect ? cellRect.top - boardRect.top : 0,
                      rowStepPx: cellRect.height || PLANBORD_RIJ_HOOGTE,
                      hasMoved: false,
                      preview: null,
                    });
                  }}
                  activeRegelId={(dragState?.hasMoved ? dragState.regel.id : null) || (resizeState?.hasMoved ? resizeState.regel.id : null)}
                  dragSavingId={dragSavingId}
                />
              ))}

              {gefilterdPersoneel.length === 0 && (
                <div className="col-span-8 px-5 py-12 text-center text-sm text-dc-gray-300">
                  Geen medewerkers gevonden voor deze zoekopdracht
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {planRegelModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div
            className="w-full max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] bg-white rounded-xl border border-dc-gray-100 overflow-hidden flex flex-col"
            style={{ width: '768px', minWidth: '768px' }}
          >
            <div className="px-6 py-4 border-b border-dc-blue-500">
              <h2 className="text-lg font-semibold text-dc-gray-500">Planning bewerken</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-[repeat(16,minmax(0,1fr))] gap-3">
                <div className="md:col-span-5">
                  <label className="block text-xs font-medium text-dc-gray-400 mb-1">Titel</label>
                  <input
                    value={planRegelTitel}
                    onChange={(e) => setPlanRegelTitel(e.target.value)}
                    className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500"
                  />
                </div>
                <div className="md:col-span-5">
                  <label className="block text-xs font-medium text-dc-gray-400 mb-1">Personeel</label>
                  <ComboBox
                    value={planRegelPersoneelId}
                    onChange={setPlanRegelPersoneelId}
                    options={personeelOpties}
                    placeholder="Selecteer medewerker"
                    searchPlaceholder="Zoek medewerker..."
                    emptyText="Geen medewerkers gevonden"
                  />
                </div>
                <div className="md:col-span-5">
                  <label className="block text-xs font-medium text-dc-gray-400 mb-1">Type</label>
                  <ComboBox
                    value={planRegelType}
                    onChange={setPlanRegelType}
                    options={planRegelTypeComboOpties}
                    placeholder="Selecteer verlof"
                    searchPlaceholder="Zoek type..."
                    emptyText="Geen verlofopties gevonden"
                  />
                </div>
                <div className="md:col-span-5">
                  <label className="block text-xs font-medium text-dc-gray-400 mb-1">Start datum</label>
                  <input
                    type="datetime-local"
                    value={planRegelStart}
                    onChange={(e) => setPlanRegelStart(e.target.value)}
                    className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500"
                  />
                </div>
                <div className="md:col-span-5">
                  <label className="block text-xs font-medium text-dc-gray-400 mb-1">Stop datum</label>
                  <input
                    type="datetime-local"
                    value={planRegelStop}
                    onChange={(e) => setPlanRegelStop(e.target.value)}
                    className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500"
                  />
                </div>
                <div className="md:col-span-5">
                  <label className="block text-xs font-medium text-dc-gray-400 mb-1">Aantal uren</label>
                  <NumericFieldInput
                    value={planRegelAantalUren}
                    onChange={setPlanRegelAantalUren}
                    fractionDigits={2}
                    placeholder="Aantal uren"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs font-medium text-dc-gray-400 mb-1">Kleur</label>
                  <div className="flex items-center gap-3 rounded-lg border border-dc-gray-200 px-3 py-2">
                    <input
                      type="color"
                      value={normalizePlanKleur(planRegelKleur) || '#93C5FD'}
                      onChange={(event) => setPlanRegelKleur(normalizePlanKleur(event.target.value))}
                      className="h-8 w-10 cursor-pointer rounded border border-dc-gray-200 bg-white p-0"
                    />
                    <div
                      className="h-6 w-6 rounded border border-dc-gray-200"
                      style={{ backgroundColor: normalizePlanKleur(planRegelKleur) || '#93C5FD' }}
                    />
                  </div>
                </div>
              </div>

              {planRegelError && (
                <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {planRegelError}
                </div>
              )}
            </div>

            <div className="border-t border-dc-blue-500 px-6 py-4 flex items-center justify-between gap-2">
              <div>
                {!planRegelIsNieuw ? (
                  <button
                    type="button"
                    onClick={() => setPlanRegelVoorVerwijderen(planRegelModal)}
                    disabled={planRegelSaving || planRegelDeleting}
                    className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {planRegelDeleting && <Loader2 className="inline w-4 h-4 mr-2 animate-spin" />}
                    {planRegelDeleting ? 'Bezig...' : 'Verwijderen'}
                  </button>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={closePlanRegelModal}
                  disabled={planRegelSaving || planRegelDeleting}
                  className="px-4 py-2 rounded-lg border border-dc-gray-200 text-sm font-medium text-dc-gray-500 hover:bg-dc-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Annuleren
                </button>
                <button
                  type="button"
                  onClick={() => void handleSavePlanRegel()}
                  disabled={planRegelSaving || planRegelDeleting}
                  className="px-4 py-2 rounded-lg bg-dc-blue-500 text-white text-sm font-medium hover:bg-dc-blue-600 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {planRegelSaving && <Loader2 className="inline w-4 h-4 mr-2 animate-spin" />}
                  {planRegelSaving ? (planRegelIsNieuw ? 'Opslaan...' : 'Bijwerken...') : (planRegelIsNieuw ? 'Opslaan' : 'Bijwerken')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(planRegelVoorVerwijderen)}
        title="Verwijderen"
        message={
          planRegelVoorVerwijderen
            ? `Weet je zeker dat je planningregel "${planRegelVoorVerwijderen.titel || 'onbekend'}" wilt verwijderen?`
            : ''
        }
        confirmLabel="Verwijderen"
        confirming={planRegelDeleting}
        onCancel={() => setPlanRegelVoorVerwijderen(null)}
        onConfirm={() => void handleDeletePlanRegel()}
      />
    </div>
  );
}

function FragmentRow({
  medewerker,
  metrics,
  rowIndex,
  weekDagen,
  planRegelsPerPersoneelDag,
  onOpenPlanRegel,
  onStartDrag,
  onStartResize,
  onStartDraw,
  activeRegelId,
  dragSavingId,
}: {
  medewerker: Personeel;
  metrics: { saldo: string; opgenomen: string; resultaat: string };
  rowIndex: number;
  weekDagen: WeekDag[];
  planRegelsPerPersoneelDag: Map<string, PlanRegel[]>;
  onOpenPlanRegel: (regel: PlanRegel) => void;
  onStartDrag: (regel: PlanRegel, event: React.PointerEvent<HTMLButtonElement>) => void;
  onStartResize: (regel: PlanRegel, side: 'start' | 'end', event: React.PointerEvent<HTMLDivElement>) => void;
  onStartDraw: (medewerker: Personeel, event: React.PointerEvent<HTMLDivElement>) => void;
  activeRegelId: number | null;
  dragSavingId: number | null;
}) {
  const rowClass = rowIndex % 2 === 0 ? 'bg-white' : 'bg-dc-gray-50/40';

  return (
    <>
      <div
        className={`sticky left-0 z-10 border-b border-r border-dc-gray-100 px-4 ${rowClass}`}
        style={{ height: `${PLANBORD_RIJ_HOOGTE}px` }}
      >
        <div className="flex h-full flex-col justify-center">
          <div className="font-medium leading-5 text-dc-gray-500">{medewerker.roepnaam || medewerker.naam || '-'}</div>
        {medewerker.naam && medewerker.roepnaam && medewerker.roepnaam !== medewerker.naam ? (
            <div className="text-[11px] leading-4 text-dc-gray-400">{medewerker.naam}</div>
        ) : null}
        </div>
      </div>
      <div className={`border-b border-dc-gray-100 px-3 text-right ${rowClass}`} style={{ height: `${PLANBORD_RIJ_HOOGTE}px` }}>
        <div className="flex h-full items-center justify-end text-sm font-medium text-dc-gray-500">
          {metrics.saldo}
        </div>
      </div>
      <div className={`border-b border-dc-gray-100 px-3 text-right ${rowClass}`} style={{ height: `${PLANBORD_RIJ_HOOGTE}px` }}>
        <div className="flex h-full items-center justify-end text-sm font-medium text-dc-gray-500">
          {metrics.opgenomen}
        </div>
      </div>
      <div className={`border-b border-dc-gray-100 px-3 text-right ${rowClass}`} style={{ height: `${PLANBORD_RIJ_HOOGTE}px` }}>
        <div className="flex h-full items-center justify-end text-sm font-medium text-dc-gray-500">
          {metrics.resultaat}
        </div>
      </div>
      {weekDagen.map((dag, dayIndex) => {
        const regels = planRegelsPerPersoneelDag.get(`${medewerker.id}-${dag.key}`) || [];
        return (
          <div
            key={`${medewerker.id}-${dag.key}`}
            data-plan-cell="1"
            data-row-index={rowIndex}
            data-day-index={dayIndex}
            className={`relative z-10 border-b border-dc-gray-100 bg-transparent ${dayIndex > 0 ? 'border-l' : ''}`}
            style={dayIndex > 0 ? { borderLeftColor: '#2563EB' } : undefined}
          >
            <div
              className="relative"
              onPointerDown={(event) => {
                if (event.target !== event.currentTarget) {
                  return;
                }
                onStartDraw(medewerker, event);
              }}
              style={{
                height: '100%',
                minHeight: `${PLANBORD_RIJ_HOOGTE}px`,
                backgroundColor: 'transparent',
              }}
            >
              {regels.map((regel) => {
                const segment = getDagSegment(regel, dag.datum);
                if (!segment) {
                  return null;
                }
                const isDraggingThis = activeRegelId === regel.id;
                const isSavingThis = dragSavingId === regel.id;
                const tooltipPositionClass =
                  rowIndex === 0
                    ? 'top-full mt-2'
                    : 'bottom-full mb-2';
                return (
                  <button
                    type="button"
                    key={`${regel.id}-${dag.key}`}
                    onClick={() => onOpenPlanRegel(regel)}
                    onPointerDown={(event) => onStartDrag(regel, event)}
                    disabled={isSavingThis}
                    className={`group absolute z-20 rounded-md border border-dc-blue-300 bg-gradient-to-r from-dc-blue-100 to-dc-blue-50 px-1.5 py-0 shadow-sm overflow-visible text-left hover:from-dc-blue-200 hover:to-dc-blue-100 disabled:opacity-70 disabled:cursor-not-allowed ${
                      isDraggingThis ? 'opacity-0' : ''
                    }`}
                    style={{
                      left: segment.left,
                      width: segment.width,
                      top: `${PLANBLOK_VERTICAL_MARGIN}px`,
                      bottom: `${PLANBLOK_VERTICAL_MARGIN}px`,
                      background: hexToRgba(regel.kleur || '', 0.16) || undefined,
                      backgroundColor: hexToRgba(regel.kleur || '', 0.16) || undefined,
                      borderColor: normalizePlanKleur(regel.kleur) || undefined,
                    }}
                  >
                    <div
                      className={`pointer-events-none absolute left-1/2 z-30 hidden min-w-[10rem] -translate-x-1/2 rounded-xl border border-dc-gray-200 bg-white/98 px-3 py-2 text-center shadow-xl backdrop-blur-sm group-hover:block group-focus-visible:block ${tooltipPositionClass}`}
                    >
                      <div className="text-[11px] font-semibold leading-4 text-dc-gray-600">
                        {[regel.type || '', regel.titel || '-', regel.aantalUren ? `${regel.aantalUren} uur` : '']
                          .filter((item) => String(item || '').trim().length > 0)
                          .join(', ')}
                      </div>
                      <div className="mt-1 text-[10px] leading-3 text-dc-gray-400">
                        {formatPlanTooltipDatum(regel.startDatumTijd, regel.stopDatumTijd)} | {segment.label}
                      </div>
                    </div>
                    {!isSavingThis ? (
                      <>
                        <div
                          className="absolute left-0 top-0 bottom-0 z-10 w-2 cursor-ew-resize"
                          onPointerDown={(event) => onStartResize(regel, 'start', event)}
                        />
                        <div
                          className="absolute right-0 top-0 bottom-0 z-10 w-2 cursor-ew-resize"
                          onPointerDown={(event) => onStartResize(regel, 'end', event)}
                        />
                      </>
                    ) : null}
                    <div className="flex h-full min-w-0 flex-col justify-center overflow-hidden rounded-md">
                      <div className="flex min-w-0 items-center justify-center gap-1.5">
                        {isSavingThis ? <Loader2 className="h-3 w-3 shrink-0 animate-spin text-dc-blue-600" /> : null}
                        <div className="truncate text-center text-[11px] font-semibold leading-4 text-dc-blue-700">{regel.titel || '-'}</div>
                      </div>
                      <div className="truncate text-center text-[10px] leading-3 text-dc-gray-500">{segment.label}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}
