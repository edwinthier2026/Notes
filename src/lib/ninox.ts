import type {
  AfspraakContract,
  Contactpersoon,
  ContactpersoonMailOptie,
  DossierItem,
  Factuur,
  Gebruiker,
  Grootboekrekening,
  InkoopopdrachtItem,
  Lid,
  MailBericht,
  MailTemplate,
  Materiaal,
  MemoriaalBoeking,
  Personeel,
  PlanRegel,
  PrijsafspraakItem,
  Relatie,
  StandaardDocument,
  VerlofUur,
  ToezichtDienst,
  WbsoStatusAanvraag,
} from '../types';
import { fetchApi } from './api';
import { formatDutchNumber, parseDutchNumber } from './amount';
import { formatDateTimeDdMmYyyyHhMm, normalizeDateTimeToIso, normalizeDateToIso } from './date';
import {
  createNinoxBackupArchiveWithDeps,
  createNinoxBackupDumpWithDeps,
  createNinoxTableBackupArchiveWithDeps,
  createNinoxTableBackupDumpWithDeps,
  type NinoxBackupArchive,
  type NinoxBackupDump,
  type NinoxBackupProgress,
  type NinoxChoiceOption,
  type NinoxTable,
  type NinoxTableField,
} from './ninox-backup';
import {
  clearNinoxInstellingenDocument01WithDeps,
  clearNinoxInstellingenDocument02WithDeps,
  fetchGoogleInstellingenWithDeps,
  fetchInstellingenBanknummerWithDeps,
  fetchInstellingenGrootboekRefsWithDeps,
  fetchNinoxInstellingenDocument01WithDeps,
  fetchNinoxInstellingenDocument02WithDeps,
  fetchNinoxInstellingenOverzichtWithDeps,
  saveGoogleTokensInstellingenWithDeps,
  updateNinoxInstellingAlgemeenWithDeps,
  uploadNinoxInstellingenDocument01WithDeps,
  uploadNinoxInstellingenDocument02WithDeps,
  verhoogEnBewaarInstellingenFactuurnummerWithDeps,
  verhoogEnBewaarInstellingenLidnummerWithDeps,
} from './ninox-instellingen';

export type {
  NinoxBackupArchive,
  NinoxBackupDump,
  NinoxBackupFile,
  NinoxBackupProgress,
  NinoxBackupRecord,
  NinoxBackupTableDump,
  NinoxChoiceOption,
  NinoxTable,
  NinoxTableField,
} from './ninox-backup';

const tableIds = {
  leden: 'A',
  materiaal: 'D',
  gebruikers: 'P',
  grootboek: 'W',
  facturenInkoop: 'FB',
  facturenVerkoop: 'GB',
} as const;

interface NinoxRecord {
  id: number;
  modifiedAt?: string;
  fields?: Record<string, unknown>;
  [key: string]: unknown;
}

interface NinoxFieldSchemaIndex {
  normalized: Set<string>;
  byNormalized: Map<string, NinoxTableField>;
}

export interface NinoxConnectionResult {
  ok: boolean;
  status: number;
  message: string;
  tables: NinoxTable[];
}

export interface NinoxLookupOption {
  id: string;
  label: string;
  subtitle?: string;
}

export interface VerkoopfactuurAbonnementFactuurRecordInput {
  abonnementId: number;
  factuurdatum: string;
  factuurperiode: string;
  bedragExclusiefBtw: number;
  titel: string;
}

export interface NinoxLedenGroep {
  id: number;
  omschrijving: string;
}

export interface NinoxInformatieItem {
  id: number;
  onderwerp: string;
  omschrijving: string;
  omschrijvingHtml: string;
}

export interface NinoxLidmaatschap {
  id: number;
  omschrijving: string;
  periode: string;
  bedrag: number;
  tegenrekeningId?: string;
  tegenrekening?: string;
  tegenrekeningNummer?: string;
  tegenrekeningNaam?: string;
}

export interface NinoxGrootboekLookupOption {
  id: string;
  nummer: string;
  naam: string;
  label: string;
}

export interface NinoxBrevet {
  id: number;
  omschrijving: string;
}

export interface NinoxMateriaalGroep {
  id: number;
  omschrijving: string;
  aantalJarenAfschrijven: number;
  kostenOnderhoudPerJaar: number;
  keuren: number;
}

export interface NinoxMateriaalMerk {
  id: number;
  omschrijving: string;
  opmerkingen?: string;
}

export interface NinoxMateriaalType {
  id: number;
  omschrijving: string;
  opmerkingen?: string;
}

export interface NinoxMateriaalDocumentatie {
  id: number;
  omschrijving: string;
  opmerkingen?: string;
  hasDocument?: boolean;
}

export interface NinoxMateriaalUitleen {
  id: number;
  lid: string;
  voorOpleiding: string;
  uitgeleend: string;
  retour: string;
  mailVerzonden?: string;
  opmerkingen?: string;
  materiaal1: string;
  materiaal2: string;
  materiaal3: string;
  materiaal4: string;
  materiaal5: string;
  materiaal6: string;
}

export interface NinoxPlanningStofzuigen {
  id: number;
  datum: string;
  vanaf: string;
  totEnMet: string;
  bad: string;
  reinigen: string;
}

export interface NinoxBoekhouding {
  grootboekrekeningen: Grootboekrekening[];
  inkoopFacturen: Factuur[];
  verkoopFacturen: Factuur[];
  facturen: Factuur[];
}

export interface NinoxInstellingItem {
  id: number;
  factuurnummer: string;
  naam: string;
  adres: string;
  postcode: string;
  woonplaats: string;
  rawFields: Record<string, unknown>;
}

export interface UpdateNinoxInstellingAlgemeenInput {
  naam: string;
  adres: string;
  postcode: string;
  woonplaats: string;
  kvkNummer: string;
  lidnummer: string;
  factuurnummer: string;
  crediteuren: string;
  debiteuren: string;
  bank: string;
  kas: string;
  locatieLogoMail: string;
  locatieLogoFactuur: string;
  incassantId: string;
  extraFields?: Record<string, string>;
  rawFields?: Record<string, unknown>;
}

export interface NieuweGebruikerInput {
  naam: string;
  gebruikersnaam: string;
  wachtwoord: string;
  email: string;
  functie?: string;
  toegang: boolean;
  beheerder: boolean;
  melding: string;
  relaties?: boolean;
  afsprakenEnContracten?: boolean;
  verkoopkansen?: boolean;
  abonnementen?: boolean;
  koppelingen?: boolean;
  tabellen?: boolean;
  personeel?: boolean;
  administratie?: boolean;
  materiaalbeheer?: boolean;
  planning?: boolean;
  mailen?: boolean;
  googleAgenda?: boolean;
  googleDrive?: boolean;
}

export interface UpdateGebruikerInput {
  naam: string;
  gebruikersnaam: string;
  wachtwoord?: string;
  email: string;
  functie?: string;
  toegang: boolean;
  beheerder: boolean;
  melding: string;
  relaties?: boolean;
  afsprakenEnContracten?: boolean;
  verkoopkansen?: boolean;
  abonnementen?: boolean;
  koppelingen?: boolean;
  tabellen?: boolean;
  personeel?: boolean;
  administratie?: boolean;
  materiaalbeheer?: boolean;
  planning?: boolean;
  mailen?: boolean;
  googleAgenda?: boolean;
  googleDrive?: boolean;
}

export interface NieuwLidInput {
  naam: string;
  roepnaam: string;
  email: string;
  mobiel: string;
  brevet: string;
  lidmaatschap: Lid['lidmaatschap'];
  startdatum: string;
}

export interface UpdateLidInput extends NieuwLidInput {}

export interface NieuweRelatieInput {
  naamRelatie: string;
  type?: string;
  actief?: string;
  gestoptPer?: string;
  adres?: string;
  postcode?: string;
  woonplaats?: string;
  land?: string;
  standaardGrootboekrekening?: string;
  opmerkingen?: string;
}

export interface GrootboekrekeningInput {
  nummer: string;
  naam: string;
  categorie: string;
  saldo: number;
  balans?: string;
}

export interface NieuwFactuurInput {
  factuurnummer: string;
  datum: string;
  periode?: string;
  titel?: string;
  omschrijving: string;
  bedrag: number;
  omschrijving2?: string;
  bedrag2?: number;
  betaald: number;
  betaaldatum?: string;
  grootboek?: string;
  grootboekNummerTekst?: string;
  grootboek2?: string;
  lidId?: number;
  relatieId?: number;
  documentBestand?: File | null;
  door?: string;
  datumTijd?: string;
}

export interface VerkoopfactuurAbonnementItem {
  id: number;
  relatie: string;
  factuurContactpersoonExtra: string;
  relatieType: string;
  debiteurennummerExact: string;
  onderdeel: string;
  statusInfo: string;
  abonnement: string;
  abonnementBevatProforma: boolean;
  startAbonnement: string;
  stopAbonnement: string;
  statusAbonnement: string;
  poActie: string;
  poNummer: string;
  aparteFactuur: string;
  poGeldigTm: string;
  factuurPeriode: string;
  artikelenVerdichtenTot1Factuurregel: boolean;
  factuurtekst: string;
  artikelnummerVerdichtExact: string;
  tellingPerMaand: number[];
  tellingPerCode: Record<string, number>;
  laatsteFactuurdatum: string;
  laatsteFactuurperiode: string;
  facturenInDeMaand: string;
  status: 'Niet actief' | 'Niet factureren' | 'Factureren' | 'Aanvragen' | 'Proforma' | 'Onbekend' | 'Geen telling';
  artikelregels: VerkoopfactuurAbonnementArtikelItem[];
}

export interface VerkoopfactuurAbonnementArtikelItem {
  id: number;
  artikelnummerExact: string;
  omschrijving: string;
  telling: string;
  aantal: number;
  prijsPerEenheid: number;
  eenmaligFactureren: string;
  startActief: string;
  stopActief: string;
}

export interface NieuwMemoriaalBoekingInput {
  datum: string;
  datumTijd?: string;
  door?: string;
  omschrijving: string;
  vanGrootboek: string;
  naarGrootboek: string;
  bedrag: number;
}

export interface NieuwMailBerichtInput {
  onderwerp: string;
  inhoud: string;
  datum: string;
  aan?: string;
  status?: string;
  ontvangersAantal?: number;
  ontvangerEmails?: string[];
  ontvangerNamen?: string[];
}

export interface MailOntvangerInput {
  email: string;
  naam?: string;
  mergeFields?: Record<string, string>;
}

export interface MailAttachmentInput {
  filename: string;
  contentType: string;
  base64Content: string;
}

export interface VerzendMailBerichtInput {
  onderwerp: string;
  inhoud: string;
  htmlPart?: string;
  ontvangers: MailOntvangerInput[];
  attachments?: MailAttachmentInput[];
  replyAdres?: string;
  idempotencyKey: string;
  actorKey?: string;
  // Legacy vlag; standaard is actieve-ledencontrole aan.
  enforceActieveLeden?: boolean;
  // Alleen gebruiken bij expliciete functionele uitzondering.
  allowInactieveLeden?: boolean;
}

export interface VerzendMailBerichtResult {
  status: string;
  verzondenAantal: number;
  uitgeslotenAantal: number;
  totaalAantal: number;
  fouten?: string[]; // Optioneel: lijst met foutmeldingen bij deels verzonden
}

export interface VerzendMailBerichtProgress {
  current: number;
  total: number;
}



async function request(path: string, init?: RequestInit): Promise<Response> {
  if (init?.signal) {
    return fetchApi(`/ninox${path}`, {
      headers: {
        Accept: 'application/json',
        ...(init?.headers || {}),
      },
      ...init,
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    return await fetchApi(`/ninox${path}`, {
      headers: {
        Accept: 'application/json',
        ...(init?.headers || {}),
      },
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

const ninoxFieldSchemaCache = new Map<string, NinoxFieldSchemaIndex>();

function normalizeFieldSchemaKey(value: string): string {
  return value.toLowerCase().replace(/[\s_-]+/g, '');
}

async function getNinoxFieldSchemaIndex(tableId: string, forceRefresh = false): Promise<NinoxFieldSchemaIndex> {
  if (!forceRefresh) {
    const cached = ninoxFieldSchemaCache.get(tableId);
    if (cached) {
      return cached;
    }
  }

  const schema = await fetchNinoxTableFields(tableId);
  const normalized = new Set<string>();
  const byNormalized = new Map<string, NinoxTableField>();
  for (const field of schema) {
    if (field.name && field.name.trim()) {
      const key = normalizeFieldSchemaKey(field.name);
      normalized.add(key);
      byNormalized.set(key, field);
    }
    if (field.id && field.id.trim()) {
      const key = normalizeFieldSchemaKey(field.id);
      normalized.add(key);
      byNormalized.set(key, field);
    }
  }

  const nextIndex: NinoxFieldSchemaIndex = { normalized, byNormalized };
  ninoxFieldSchemaCache.set(tableId, nextIndex);
  return nextIndex;
}

function isDateFieldType(fieldTypeRaw: string): boolean {
  const fieldType = normalizeFieldSchemaKey(fieldTypeRaw);
  return fieldType.includes('date') && !fieldType.includes('datetime');
}

function isDateTimeFieldType(fieldTypeRaw: string): boolean {
  const fieldType = normalizeFieldSchemaKey(fieldTypeRaw);
  return fieldType.includes('datetime') || fieldType.includes('timestamp');
}

function validateYyyyMmDd(yyyy: number, mm: number, dd: number): boolean {
  if (!Number.isFinite(yyyy) || !Number.isFinite(mm) || !Number.isFinite(dd)) {
    return false;
  }
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) {
    return false;
  }
  const probe = new Date(Date.UTC(yyyy, mm - 1, dd));
  return probe.getUTCFullYear() === yyyy && probe.getUTCMonth() === mm - 1 && probe.getUTCDate() === dd;
}

function parseIsoDateStrict(raw: string): string | null {
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!iso) {
    return null;
  }
  const yyyy = Number(iso[1]);
  const mm = Number(iso[2]);
  const dd = Number(iso[3]);
  if (!validateYyyyMmDd(yyyy, mm, dd)) {
    return null;
  }
  return `${iso[1]}-${iso[2]}-${iso[3]}`;
}

function parseDutchDateStrict(raw: string): string | null {
  const nl = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!nl) {
    return null;
  }
  const dd = Number(nl[1]);
  const mm = Number(nl[2]);
  const yyyy = Number(nl[3]);
  if (!validateYyyyMmDd(yyyy, mm, dd)) {
    return null;
  }
  return `${nl[3]}-${nl[2]}-${nl[1]}`;
}

function normalizeDateFieldStrict(value: string): string {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }
  const iso = parseIsoDateStrict(raw);
  if (iso) {
    return iso;
  }
  const nl = parseDutchDateStrict(raw);
  if (nl) {
    return nl;
  }
  throw new Error(`Veld moet formaat dd/mm/yyyy hebben. Ontvangen: "${raw}"`);
}

function normalizeDateTimeFieldStrict(value: string): string {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }
  const isoWithTime = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (isoWithTime) {
    const yyyy = Number(isoWithTime[1]);
    const mm = Number(isoWithTime[2]);
    const dd = Number(isoWithTime[3]);
    const hh = Number(isoWithTime[4]);
    const mi = Number(isoWithTime[5]);
    const ss = Number(isoWithTime[6] || '0');
    if (!validateYyyyMmDd(yyyy, mm, dd) || hh < 0 || hh > 23 || mi < 0 || mi > 59 || ss < 0 || ss > 59) {
      throw new Error(`Veld moet formaat dd/mm/yyyy HH:mm hebben. Ontvangen: "${raw}"`);
    }
    return `${isoWithTime[1]}-${isoWithTime[2]}-${isoWithTime[3]}T${isoWithTime[4]}:${isoWithTime[5]}:${String(ss).padStart(2, '0')}`;
  }
  const nlWithTime = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
  if (nlWithTime) {
    const dd = Number(nlWithTime[1]);
    const mm = Number(nlWithTime[2]);
    const yyyy = Number(nlWithTime[3]);
    const hh = Number(nlWithTime[4]);
    const mi = Number(nlWithTime[5]);
    if (!validateYyyyMmDd(yyyy, mm, dd) || hh < 0 || hh > 23 || mi < 0 || mi > 59) {
      throw new Error(`Veld moet formaat dd/mm/yyyy HH:mm hebben. Ontvangen: "${raw}"`);
    }
    return `${nlWithTime[3]}-${nlWithTime[2]}-${nlWithTime[1]}T${nlWithTime[4]}:${nlWithTime[5]}:00`;
  }
  const isoDate = parseIsoDateStrict(raw) || parseDutchDateStrict(raw);
  if (isoDate) {
    return `${isoDate}T12:00:00`;
  }
  throw new Error(`Veld moet formaat dd/mm/yyyy HH:mm hebben. Ontvangen: "${raw}"`);
}

async function normalizeDateFieldsForWrite(
  tableId: string,
  fields: Record<string, unknown>
): Promise<{ fields: Record<string, unknown>; verify: Array<{ field: NinoxTableField; key: string; expected: string }> }> {
  const index = await getNinoxFieldSchemaIndex(tableId, false);
  const normalizedFields: Record<string, unknown> = { ...fields };
  const verify: Array<{ field: NinoxTableField; key: string; expected: string }> = [];

  for (const [key, value] of Object.entries(fields)) {
    const schema = index.byNormalized.get(normalizeFieldSchemaKey(key));
    if (!schema) {
      continue;
    }
    if (value === null || value === undefined) {
      continue;
    }
    if (typeof value !== 'string') {
      continue;
    }
    try {
      if (isDateTimeFieldType(schema.type)) {
        const normalized = normalizeDateTimeFieldStrict(value);
        normalizedFields[key] = normalized;
        if (normalized) {
          verify.push({ field: schema, key, expected: normalized });
        }
      } else if (isDateFieldType(schema.type)) {
        const normalized = normalizeDateFieldStrict(value);
        normalizedFields[key] = normalized;
        if (normalized) {
          verify.push({ field: schema, key, expected: normalized });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ongeldige datumwaarde.';
      throw new Error(`Datumcontrole mislukt voor veld "${schema.name}": ${message}`);
    }
  }

  return { fields: normalizedFields, verify };
}

function normalizeStoredDateForCompare(value: unknown, schema: NinoxTableField): string {
  const raw = asString(value).trim();
  if (!raw) {
    return '';
  }
  if (isDateTimeFieldType(schema.type)) {
    const isoWithTime = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (isoWithTime) {
      return `${isoWithTime[1]}-${isoWithTime[2]}-${isoWithTime[3]}T${isoWithTime[4]}:${isoWithTime[5]}:${isoWithTime[6] || '00'}`;
    }
    const nlWithTime = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
    if (nlWithTime) {
      return `${nlWithTime[3]}-${nlWithTime[2]}-${nlWithTime[1]}T${nlWithTime[4]}:${nlWithTime[5]}:00`;
    }
    return '';
  }
  const isoDate = parseIsoDateStrict(raw);
  if (isoDate) {
    return isoDate;
  }
  const nlDate = parseDutchDateStrict(raw);
  if (nlDate) {
    return nlDate;
  }
  return '';
}

async function verifyWrittenDateFields(
  tableId: string,
  recordId: number,
  verify: Array<{ field: NinoxTableField; key: string; expected: string }>
): Promise<void> {
  if (verify.length === 0) {
    return;
  }
  const response = await request(`/tables/${tableId}/records/${recordId}`);
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    const message = typeof errorPayload?.message === 'string' ? errorPayload.message : 'Onbekende Ninox fout';
    throw new Error(`Controle na opslaan mislukt (${response.status}): ${message}`);
  }
  const record = (await response.json().catch(() => null)) as NinoxRecord | null;
  const storedFields = record?.fields ?? {};
  for (const check of verify) {
    const normalizedTarget = normalizeFieldSchemaKey(check.field.name);
    const storedEntry = Object.entries(storedFields).find(([storedKey]) => normalizeFieldSchemaKey(storedKey) === normalizedTarget);
    const storedRaw = storedEntry ? storedEntry[1] : storedFields[check.field.name];
    const storedNormalized = normalizeStoredDateForCompare(storedRaw, check.field);
    if (!storedNormalized) {
      throw new Error(`Controle na opslaan mislukt: veld "${check.field.name}" is leeg gebleven in Ninox.`);
    }
    if (isDateTimeFieldType(check.field.type)) {
      // Vergelijk op minuutniveau; Ninox kan seconden aanpassen.
      const expectedMinute = check.expected.slice(0, 16);
      const storedMinute = storedNormalized.slice(0, 16);
      if (expectedMinute !== storedMinute) {
        throw new Error(
          `Controle na opslaan mislukt voor veld "${check.field.name}": verwacht ${check.expected}, ontvangen ${storedNormalized}.`
        );
      }
    } else if (storedNormalized !== check.expected) {
      throw new Error(
        `Controle na opslaan mislukt voor veld "${check.field.name}": verwacht ${check.expected}, ontvangen ${storedNormalized}.`
      );
    }
  }
}

async function assertKnownNinoxFields(
  tableId: string,
  fields: Record<string, unknown>,
  mode: 'aanmaken' | 'bijwerken'
): Promise<void> {
  const keys = Object.keys(fields).filter((key) => key.trim().length > 0);
  if (keys.length === 0) {
    return;
  }

  const findUnknown = (index: NinoxFieldSchemaIndex): string[] =>
    keys.filter((key) => !index.normalized.has(normalizeFieldSchemaKey(key)));

  const cachedIndex = await getNinoxFieldSchemaIndex(tableId, false);
  let unknown = findUnknown(cachedIndex);
  if (unknown.length > 0) {
    const refreshedIndex = await getNinoxFieldSchemaIndex(tableId, true);
    unknown = findUnknown(refreshedIndex);
  }

  if (unknown.length > 0) {
    throw new Error(
      `Veldcontrole mislukt bij ${mode} (tabel ${tableId}). Onbekende veldnaam${unknown.length > 1 ? 'en' : ''}: ${unknown.join(', ')}`
    );
  }
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = parseDutchNumber(value);
    if (parsed !== null) {
      return parsed;
    }
  }
  return fallback;
}

function extractComparableNumber(value: unknown, fallback = 0): number {
  const direct = asNumber(value, Number.NaN);
  if (Number.isFinite(direct)) {
    return direct;
  }

  if (Array.isArray(value) && value.length > 0) {
    for (const item of value) {
      const nested = extractComparableNumber(item, Number.NaN);
      if (Number.isFinite(nested)) {
        return nested;
      }
    }
    return fallback;
  }

  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const candidates = [
      obj.value,
      obj.id,
      obj.key,
      obj.recordId,
      obj.caption,
      obj.label,
      obj.name,
      obj.text,
      obj.title,
    ];
    for (const candidate of candidates) {
      const nested = asNumber(candidate, Number.NaN);
      if (Number.isFinite(nested)) {
        return nested;
      }
    }
  }

  const textValue = extractComparableText(value);
  if (textValue) {
    const parsed = asNumber(textValue, Number.NaN);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function asIntegerNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return fallback;
    }
    const parsed = Number(trimmed.replace(/[^\d-]/g, ''));
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }
  return fallback;
}

function asBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value === 1;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'ja' || normalized === 'yes' || normalized === 'true' || normalized === '1';
  }
  if (Array.isArray(value)) {
    return value.some((item) => asBoolean(item));
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const candidates = [
      obj.value,
      obj.id,
      obj.key,
      obj.recordId,
      obj.caption,
      obj.label,
      obj.name,
      obj.text,
      obj.title,
      obj.checked,
      obj.selected,
    ];
    return candidates.some((candidate) => asBoolean(candidate));
  }
  return false;
}

function asPrimitiveString(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return '';
}

function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function asRichTextHtml(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    const joined = value
      .map((item) => asRichTextHtml(item, ''))
      .filter((item) => item.length > 0)
      .join('\n')
      .trim();
    return joined || fallback;
  }
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    const richCandidates = [
      obj.html,
      obj.value,
      obj.content,
      obj.text,
      obj.plainText,
      obj.markdown,
      obj.caption,
      obj.label,
      obj.name,
    ];
    for (const candidate of richCandidates) {
      const extracted = asRichTextHtml(candidate, '');
      if (extracted) {
        return extracted;
      }
    }
  }
  return fallback;
}

function asRichTextString(value: unknown, fallback = ''): string {
  const html = asRichTextHtml(value, fallback);
  return html ? stripHtmlTags(html) : fallback;
}

function extractComparableText(value: unknown): string {
  const direct = asPrimitiveString(value).trim();
  if (direct) {
    return direct;
  }
  if (Array.isArray(value) && value.length > 0) {
    return extractComparableText(value[0]);
  }
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    const candidates = [obj.caption, obj.label, obj.name, obj.text, obj.value, obj.id];
    for (const candidate of candidates) {
      const text = asPrimitiveString(candidate).trim();
      if (text) {
        return text;
      }
    }
  }
  return '';
}

function containsNormalizedText(value: unknown, needle: string, depth = 0): boolean {
  if (depth > 5) {
    return false;
  }

  const direct = asPrimitiveString(value).trim();
  if (direct && normalizeCompare(direct).includes(needle)) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.some((item) => containsNormalizedText(item, needle, depth + 1));
  }

  if (typeof value === 'object' && value !== null) {
    return Object.values(value as Record<string, unknown>).some((item) => containsNormalizedText(item, needle, depth + 1));
  }

  return false;
}

function extractComparableLinkValue(value: unknown): string {
  const direct = asPrimitiveString(value).trim();
  if (direct) {
    return direct;
  }
  if (Array.isArray(value) && value.length > 0) {
    return extractComparableLinkValue(value[0]);
  }
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    const idFirst = [obj.id, obj.value, obj.key, obj.recordId];
    for (const candidate of idFirst) {
      const text = asPrimitiveString(candidate).trim();
      if (text) {
        return text;
      }
    }
    const textFallback = [obj.caption, obj.name, obj.text, obj.label];
    for (const candidate of textFallback) {
      const text = asPrimitiveString(candidate).trim();
      if (text) {
        return text;
      }
    }
  }
  return '';
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function todayLocalIsoDate(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseStrictDateToIso(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const yyyy = value.getFullYear();
    const mm = String(value.getMonth() + 1).padStart(2, '0');
    const dd = String(value.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const parsed = parseStrictDateToIso(item);
      if (parsed) {
        return parsed;
      }
    }
    return null;
  }

  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    const candidates = [
      obj.iso,
      obj.date,
      obj.datetime,
      obj.value,
      obj.text,
      obj.caption,
      obj.label,
      obj.name,
      obj.displayValue,
      obj.display,
      obj.formatted,
      obj.formattedValue,
      obj.start,
      obj.end,
    ];
    for (const candidate of candidates) {
      const parsed = parseStrictDateToIso(candidate);
      if (parsed) {
        return parsed;
      }
    }
  }

  const raw = extractComparableText(value).trim() || asString(value).trim();
  if (!raw || raw === '-' || raw === '--/--/----') {
    return null;
  }

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    const probe = new Date(year, month - 1, day);
    if (
      probe.getFullYear() === year &&
      probe.getMonth() === month - 1 &&
      probe.getDate() === day
    ) {
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }
    return null;
  }

  const nlMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (nlMatch) {
    const day = Number(nlMatch[1]);
    const month = Number(nlMatch[2]);
    const year = Number(nlMatch[3]);
    const probe = new Date(year, month - 1, day);
    if (
      probe.getFullYear() === year &&
      probe.getMonth() === month - 1 &&
      probe.getDate() === day
    ) {
      return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return null;
}

function isLidActiefOpDatum(lid: Lid, datumIso: string): boolean {
  const rawFields = lid.rawFields || {};
  const lidVanaf =
    parseStrictDateToIso(rawFields['Lid vanaf']) ||
    parseStrictDateToIso(rawFields['Lid vanf']) ||
    parseStrictDateToIso(lid.startdatum);
  const lidTm =
    parseStrictDateToIso(rawFields['Lid t/m']) ||
    parseStrictDateToIso(rawFields['Lid tm']) ||
    parseStrictDateToIso(rawFields['Lid tot']);

  if (lidVanaf && datumIso < lidVanaf) {
    return false;
  }
  if (lidTm && datumIso > lidTm) {
    return false;
  }
  return true;
}

async function filterActieveLedenOntvangers(
  ontvangers: MailOntvangerInput[],
  datumIso: string
): Promise<{ actieveOntvangers: MailOntvangerInput[]; uitgeslotenAantal: number }> {
  const leden = await fetchNinoxLeden();
  const actieveStatusPerEmail = new Map<string, boolean>();

  for (const lid of leden) {
    const email = String(lid.email || '').trim().toLowerCase();
    if (!email) {
      continue;
    }
    const actief = isLidActiefOpDatum(lid, datumIso);
    const bestaand = actieveStatusPerEmail.get(email);
    actieveStatusPerEmail.set(email, Boolean(bestaand) || actief);
  }

  let uitgeslotenAantal = 0;
  const actieveOntvangers = ontvangers.filter((ontvanger) => {
    const key = String(ontvanger.email || '').trim().toLowerCase();
    if (!key) {
      uitgeslotenAantal += 1;
      return false;
    }
    if (!actieveStatusPerEmail.has(key)) {
      return true;
    }
    const actief = actieveStatusPerEmail.get(key) === true;
    if (!actief) {
      uitgeslotenAantal += 1;
    }
    return actief;
  });

  return { actieveOntvangers, uitgeslotenAantal };
}

function getWeekNumber(dateStr: string): number {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

function mapLidmaatschap(fields: Record<string, unknown>): Lid['lidmaatschap'] {
  const groep = asString(fields['Lid van groep - 01']).toLowerCase();
  if (groep.includes('jeugd')) {
    return 'Jeugd';
  }
  if (groep.includes('passief')) {
    return 'Passief';
  }
  return 'Actief';
}

function lidmaatschapToGroep(lidmaatschap: Lid['lidmaatschap']): string {
  if (lidmaatschap === 'Jeugd') {
    return 'Jeugd';
  }
  if (lidmaatschap === 'Passief') {
    return 'Passief';
  }
  return 'Actief';
}

function mapBrevet(fields: Record<string, unknown>): string {
  const raw = asString(fields['Hoogste brevet']);
  return raw || 'Geen';
}

function mapActiviteiten(fields: Record<string, unknown>): string[] {
  const activiteiten: string[] = [];
  if (asBoolean(fields.Duiken)) {
    activiteiten.push('Duiken');
  }
  if (asBoolean(fields.Onderwaterhockey)) {
    activiteiten.push('OWH');
  }
  if (asBoolean(fields.Zwemtraining)) {
    activiteiten.push('Zwemtraining');
  }
  return activiteiten;
}

function mapCertificeringen(fields: Record<string, unknown>): string[] {
  const certs: string[] = [];
  if (asBoolean(fields.EHBO)) {
    certs.push('EHBO');
  }
  if (asBoolean(fields.Reanimatie)) {
    certs.push('Reanimatie');
  }
  if (asBoolean(fields['Reddend zwemmen'])) {
    certs.push('Reddend zwemmen');
  }
  if (asBoolean(fields.BHV)) {
    certs.push('BHV');
  }
  return certs;
}

function mapGroepen(fields: Record<string, unknown>): string[] {
  const keys = [
    'Lid van groep - 01',
    'Lid van groep - 02',
    'Lid van groep - 03',
    'Lid van groep - 04',
    'Lid van groep - 05',
    'Lid van groep - 06',
    'Lid van groep - 07',
    'Lid van groep - 08',
  ];

  return keys
    .map((key) => asString(fields[key]))
    .filter((value) => value.length > 0);
}

function mapLid(record: NinoxRecord): Lid {
  const fields = record.fields ?? {};
  const roepnaam = asString(fields.Roepnaam) || asString(fields.Naam).split(',')[0] || `Lid ${record.id}`;

  return {
    id: record.id,
    naam: asString(fields.Naam, `Lid ${record.id}`),
    roepnaam,
    email: asString(fields['E-mail']),
    mobiel: asString(fields['Mobiel nummer']),
    brevet: mapBrevet(fields),
    activiteiten: mapActiviteiten(fields),
    certificeringen: mapCertificeringen(fields),
    groepen: mapGroepen(fields),
    lidmaatschap: mapLidmaatschap(fields),
    startdatum: asString(fields['Lid vanaf']) || todayIsoDate(),
    rawFields: fields,
  };
}

function mapKeuringsStatus(fields: Record<string, unknown>): Materiaal['keuringsstatus'] {
  const status = asString(fields['Status laatste keuring']);
  const keuringsdatum = asString(fields['Datum laatste keuring']);

  if (status === 'Afgekeurd') {
    return 'Afgekeurd';
  }

  if (keuringsdatum && keuringsdatum < todayIsoDate()) {
    return 'Keuring verlopen';
  }

  if (status === 'Goedgekeurd') {
    return 'Goedgekeurd';
  }

  return 'Keuring verlopen';
}

function mapMateriaal(record: NinoxRecord): Materiaal {
  const fields = record.fields ?? {};
  const keuringsdatum = asString(fields['Datum laatste keuring']) || asString(fields['Datum laatste fysieke controle']) || todayIsoDate();

  return {
    id: record.id,
    labelnummer: asString(fields.Labelnummer, `AD-${record.id}`),
    maat: asString(fields.Maat),
    opmerkingen: asString(fields.Opmerkingen) || asString(fields.Opmerking) || asString(fields.Memo),
    datumAanschaf: asString(fields['Datum aanschaf']),
    aanschafprijs: asNumber(fields.Aanschafprijs, 0),
    datumLaatsteOnderhoud: asString(fields['Datum laatste onderhoud']),
    kostenOnderhoud: asNumber(fields['Kosten onderhoud'], 0),
    datumLaatsteFysiekeControle: asString(fields['Datum laatste fysieke controle']),
    statusFysiekeControle: asString(fields['Status fysieke controle']) || asString(fields['Status laatste keuring']),
    datumLaatsteKeuring: asString(fields['Datum laatste keuring']),
    statusLaatsteKeuring: asString(fields['Status laatste keuring']) || asString(fields['Status fysieke controle']),
    typeSerienummer1: asString(fields['Type serienummer 1']) || asString(fields['Type Serienummer 1']),
    typeSerienummer2: asString(fields['Type serienummer 2']) || asString(fields['Type Serienummer 2']),
    typeSerienummer3: asString(fields['Type serienummer 3']) || asString(fields['Type Serienummer 3']),
    serienummer1: asString(fields['Serienummer 1']),
    serienummer2: asString(fields['Serienummer 2']),
    serienummer3: asString(fields['Serienummer 3']),
    merk: asString(fields.Merk),
    type: asString(fields.Type),
    omschrijving: asString(fields.Tooninformatie) || asString(fields.Type) || asString(fields.Labelnummer, `Materiaal ${record.id}`),
    groep: extractComparableText(fields.Groep) || asString(fields.Groep) || 'Onbekend',
    serienummer: asString(fields['Serienummer 1']) || '-',
    keuringsstatus: mapKeuringsStatus(fields),
    keuringsdatum,
    locatie: asString(fields.Locatie) || 'Onbekend',
    hasDocument: hasDocumentValue(fields.Document),
  };
}

function asRole(fields: Record<string, unknown>): Gebruiker['rol'] {
  // Simpel: Beheerder ja/nee veld bepaalt de rol
  if (asBoolean(fields.Beheerder)) {
    return 'Beheerder';
  }
  return 'Gebruiker';
}

function mapCategorie(raw: string): Grootboekrekening['categorie'] {
  const normalized = raw.toLowerCase();
  if (normalized.includes('inkomst') || normalized.includes('opbrengst')) {
    return 'Inkomsten';
  }
  if (normalized.includes('uitgav') || normalized.includes('kost')) {
    return 'Uitgaven';
  }
  if (normalized.includes('balans') || normalized.includes('bezitting') || normalized.includes('vermogen') || normalized.includes('schuld') || normalized.includes('verrekening')) {
    return 'Balans';
  }
  return 'Uitgaven';
}

function mapCategorieFromRekeningNummer(nummer: string): Grootboekrekening['categorie'] | null {
  const trimmed = nummer.trim();
  if (!trimmed) {
    return null;
  }

  const first = trimmed[0];
  if (first >= '0' && first <= '3') {
    return 'Balans';
  }
  if (first === '4') {
    return 'Inkomsten';
  }
  if (first === '7') {
    return 'Uitgaven';
  }
  return null;
}

function mapFactuurStatus(_datum: string, bedrag: number, betaald: number): Factuur['status'] {
  if (Math.abs(bedrag) > 0 && Math.abs(betaald) >= Math.abs(bedrag)) {
    return 'Betaald';
  }
  return 'Open';
}

function hasDocumentValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const candidates = [obj.name, obj.fileName, obj.url, obj.id, obj.caption, obj.value];
    return candidates.some((candidate) => hasDocumentValue(candidate));
  }
  return false;
}

function normalizePlanRegelKleurValue(value: unknown): string {
  const normalize = (candidate: unknown): string => {
    const text = String(candidate || '').trim();
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
  };

  const direct = normalize(value);
  if (direct) {
    return direct;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const nested = normalizePlanRegelKleurValue(entry);
      if (nested) {
        return nested;
      }
    }
  }
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    const candidates = [obj.color, obj.hex, obj.value, obj.text, obj.caption, obj.label, obj.name];
    for (const candidate of candidates) {
      const nested = normalizePlanRegelKleurValue(candidate);
      if (nested) {
        return nested;
      }
    }
  }
  return '';
}

function extractLinkedRecordId(value: unknown): number | null {
  const toNumericId = (candidate: unknown): number | null => {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (!trimmed) {
        return null;
      }
      const parsed = Number(trimmed);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
      // Support Ninox-like string refs (e.g. "A,123" or "table:123").
      const match = trimmed.match(/(\d+)/);
      if (match) {
        const fromText = Number(match[1]);
        return Number.isFinite(fromText) ? fromText : null;
      }
      return null;
    }
    return null;
  };

  const direct = toNumericId(value);
  if (direct !== null) {
    return direct;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (Array.isArray(value) && value.length > 0) {
    for (const entry of value) {
      const extracted = extractLinkedRecordId(entry);
      if (extracted !== null) {
        return extracted;
      }
    }
    return null;
  }
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    const idCandidates = [obj.id, obj.value, obj.key, obj.recordId];
    for (const candidate of idCandidates) {
      const extracted = toNumericId(candidate);
      if (extracted !== null) {
        return extracted;
      }
    }
  }
  return null;
}

function getNinoxRecordValue(record: NinoxRecord, fieldNames: string[]): unknown {
  const normalizedNames = fieldNames
    .map((name) => String(name || '').trim())
    .filter((name, index, arr) => name.length > 0 && arr.indexOf(name) === index);

  const fields = record.fields ?? {};
  for (const fieldName of normalizedNames) {
    if (fields[fieldName] !== undefined) {
      return fields[fieldName];
    }
  }

  return undefined;
}

function getNinoxLinkedRecordIdFromRecord(record: NinoxRecord, fieldNames: string[]): number | null {
  const value = getNinoxRecordValue(record, fieldNames);
  return extractLinkedRecordId(value);
}

function mapMailStatus(raw: string): MailBericht['status'] {
  const text = raw.trim();
  return text || 'Concept';
}

function parseMailDatumToTimestamp(value: string): number | null {
  const raw = value.trim();
  if (!raw) {
    return null;
  }

  const isoDateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDateOnly) {
    return Date.parse(`${isoDateOnly[1]}-${isoDateOnly[2]}-${isoDateOnly[3]}T00:00:00Z`);
  }

  const isoDateTime = raw.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (isoDateTime) {
    const timestamp = Date.parse(raw);
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  const nlDate = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (nlDate) {
    return Date.parse(`${nlDate[3]}-${nlDate[2]}-${nlDate[1]}T00:00:00Z`);
  }

  const nlDateTime = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
  if (nlDateTime) {
    return Date.parse(`${nlDateTime[3]}-${nlDateTime[2]}-${nlDateTime[1]}T${nlDateTime[4]}:${nlDateTime[5]}:00Z`);
  }

  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapMailBericht(record: NinoxRecord): MailBericht {
  const fields = record.fields ?? {};
  const modifiedAt = asString(record.modifiedAt);
  const datum =
    asString(fields['Datum+tijd']) ||
    asString(fields['Datum tijd']) ||
    asString(fields.Datum) ||
    asString(fields['Verzenddatum']) ||
    asString(fields['Aangemaakt op']) ||
    modifiedAt ||
    todayIsoDate();

  const ontvangersCandidates = [
    asNumber(fields.Ontvangers, NaN),
    asNumber(fields['Aantal ontvangers'], NaN),
    asNumber(fields.Ontvangersaantal, NaN),
    asNumber(fields['Aantal leden'], NaN),
  ];
  const ontvangers = ontvangersCandidates.find((value) => Number.isFinite(value));

  return {
    id: record.id,
    datum,
    aan: extractComparableText(fields.Aan) || asString(fields.Aan) || '',
    onderwerp: asString(fields.Onderwerp) || asString(fields.Titel) || asString(fields.Omschrijving, `Mail ${record.id}`),
    status: mapMailStatus(asString(fields.Status)),
    ontvangers: typeof ontvangers === 'number' ? ontvangers : 0,
    hasDocument: hasDocumentValue(fields.Document),
  };
}

async function parseTables(response: Response): Promise<NinoxTable[]> {
  const payload = await response.json();
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((table) => ({
      id: String(table.id ?? ''),
      name: String(table.name ?? ''),
    }))
    .filter((table) => table.id && table.name);
}

export async function fetchNinoxTableFields(tableId: string): Promise<NinoxTableField[]> {
  const response = await request(`/tables/${tableId}`);
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    const message = typeof errorPayload?.message === 'string' ? errorPayload.message : 'Onbekende Ninox fout';
    throw new Error(`Tabel ${tableId} schema ophalen mislukt (${response.status}): ${message}`);
  }

  const payload = (await response.json()) as { fields?: Array<Record<string, unknown>> };
  const rawFields = Array.isArray(payload?.fields) ? payload.fields : [];

  const parseChoiceItems = (candidate: unknown): NinoxChoiceOption[] => {
    const toOption = (item: unknown): NinoxChoiceOption | null => {
      if (typeof item === 'string') {
        const text = item.trim();
        if (!text) {
          return null;
        }
        return { id: text, caption: text };
      }
      if (typeof item === 'object' && item !== null) {
        const obj = item as Record<string, unknown>;
        const id =
          asString(obj.id).trim() ||
          asString(obj.value).trim() ||
          asString(obj.key).trim() ||
          asString(obj.caption).trim() ||
          asString(obj.label).trim();
        const caption = asString(obj.caption).trim() || asString(obj.label).trim() || asString(obj.name).trim() || id;
        if (!id && !caption) {
          return null;
        }
        return {
          id: id || caption,
          caption: caption || id,
        };
      }
      return null;
    };

    if (Array.isArray(candidate)) {
      return candidate.map(toOption).filter((option): option is NinoxChoiceOption => Boolean(option));
    }

    if (typeof candidate === 'string') {
      const parts = candidate
        .split(/\r?\n|;|\||,/)
        .map((part) => part.trim())
        .filter(Boolean);
      return parts.map((part) => ({ id: part, caption: part }));
    }

    if (candidate && typeof candidate === 'object') {
      const obj = candidate as Record<string, unknown>;
      const mapped: NinoxChoiceOption[] = [];
      for (const [key, value] of Object.entries(obj)) {
        const valueText =
          asString(value).trim() ||
          (value && typeof value === 'object'
            ? asString((value as Record<string, unknown>).caption).trim() ||
              asString((value as Record<string, unknown>).label).trim() ||
              asString((value as Record<string, unknown>).name).trim() ||
              asString((value as Record<string, unknown>).value).trim() ||
              asString((value as Record<string, unknown>).id).trim()
            : '');
        const keyText = asString(key).trim();
        if (!keyText && !valueText) {
          continue;
        }
        mapped.push({
          id: keyText || valueText,
          caption: valueText || keyText,
        });
      }
      return mapped;
    }

    return [];
  };

  const looksLikeChoiceArray = (candidate: unknown): boolean => {
    if (!Array.isArray(candidate) || candidate.length === 0) {
      return false;
    }
    const sample = candidate[0];
    if (typeof sample === 'string') {
      return true;
    }
    if (typeof sample === 'object' && sample !== null) {
      const obj = sample as Record<string, unknown>;
      return Boolean(obj.id || obj.caption || obj.label || obj.value || obj.key || obj.name);
    }
    return false;
  };

  const choiceLikeKey = (key: string): boolean => /choices?|options?|values?|items?|enum|list|selections?/i.test(key);

  const collectChoiceArraysDeep = (root: unknown): unknown[][] => {
    const results: unknown[][] = [];
    const visited = new Set<unknown>();

    const visit = (node: unknown) => {
      if (!node || typeof node !== 'object') {
        return;
      }
      if (visited.has(node)) {
        return;
      }
      visited.add(node);

      if (Array.isArray(node)) {
        if (looksLikeChoiceArray(node)) {
          results.push(node);
          return;
        }
        for (const item of node) {
          visit(item);
        }
        return;
      }

      const obj = node as Record<string, unknown>;
      for (const value of Object.values(obj)) {
        visit(value);
      }
    };

    visit(root);
    return results;
  };

  const collectChoiceCandidatesByKeyDeep = (root: unknown): unknown[] => {
    const results: unknown[] = [];
    const visited = new Set<unknown>();

    const visit = (node: unknown) => {
      if (!node || typeof node !== 'object') {
        return;
      }
      if (visited.has(node)) {
        return;
      }
      visited.add(node);

      if (Array.isArray(node)) {
        for (const item of node) {
          visit(item);
        }
        return;
      }

      const obj = node as Record<string, unknown>;
      for (const [key, value] of Object.entries(obj)) {
        if (choiceLikeKey(key)) {
          results.push(value);
        }
        visit(value);
      }
    };

    visit(root);
    return results;
  };

  const parseChoices = (field: Record<string, unknown>): NinoxChoiceOption[] | undefined => {
    const properties = (field.properties && typeof field.properties === 'object' ? (field.properties as Record<string, unknown>) : {}) || {};
    const config = (field.config && typeof field.config === 'object' ? (field.config as Record<string, unknown>) : {}) || {};
    const settings = (field.settings && typeof field.settings === 'object' ? (field.settings as Record<string, unknown>) : {}) || {};
    const metadata = (field.metadata && typeof field.metadata === 'object' ? (field.metadata as Record<string, unknown>) : {}) || {};

    const shallowCandidates = [
      field.choices,
      field.options,
      field.values,
      properties.choices,
      properties.options,
      properties.values,
      config.choices,
      config.options,
      config.values,
      settings.choices,
      settings.options,
      settings.values,
      metadata.choices,
      metadata.options,
      metadata.values,
    ];
    const deepArrayCandidates = collectChoiceArraysDeep(field);
    const keyedCandidates = collectChoiceCandidatesByKeyDeep(field);
    const candidates = [...shallowCandidates, ...deepArrayCandidates, ...keyedCandidates];

    const dedupe = new Map<string, NinoxChoiceOption>();
    for (const candidate of candidates) {
      const mapped = parseChoiceItems(candidate).sort((a, b) => a.caption.localeCompare(b.caption, 'nl', { sensitivity: 'base', numeric: true }));
      for (const option of mapped) {
        const key = `${option.id}__${option.caption}`.toLowerCase();
        if (!dedupe.has(key)) {
          dedupe.set(key, option);
        }
      }
    }

    const merged = Array.from(dedupe.values()).sort((a, b) => a.caption.localeCompare(b.caption, 'nl', { sensitivity: 'base', numeric: true }));
    if (merged.length > 0) {
      return merged;
    }

    return undefined;
  };

  const mergeByKey = (fields: NinoxTableField[]) => {
    const dedupe = new Map<string, NinoxTableField>();
    for (const field of fields) {
      const keyById = field.id.trim();
      const keyByName = normalizeCompare(field.name);
      const existing = dedupe.get(keyById) || dedupe.get(keyByName);
      if (!existing) {
        dedupe.set(keyById || keyByName, field);
        continue;
      }
      if ((!existing.choices || existing.choices.length === 0) && field.choices && field.choices.length > 0) {
        existing.choices = field.choices;
      }
      if ((!existing.type || existing.type === 'string') && field.type && field.type !== 'string') {
        existing.type = field.type;
      }
    }
    return Array.from(dedupe.values()).filter((field) => field.id && field.name);
  };

  const mapRawField = (field: Record<string, unknown>): NinoxTableField => {
    const choices = parseChoices(field);
    return {
      id: asString(field.id),
      name: asString(field.name),
      type: asString(field.type) || asString(field.kind) || asString(field.dataType) || 'string',
      choices,
    };
  };

  const mappedPrimary = rawFields.map(mapRawField);

  let mappedSecondary: NinoxTableField[] = [];
  try {
    const secondaryResponse = await request(`/tables/${tableId}/fields`);
    if (secondaryResponse.ok) {
      const secondaryPayload = (await secondaryResponse.json()) as { fields?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>;
      const secondaryFields = Array.isArray(secondaryPayload)
        ? secondaryPayload
        : Array.isArray(secondaryPayload?.fields)
        ? secondaryPayload.fields
        : [];
      mappedSecondary = secondaryFields.map(mapRawField);
    }
  } catch {
    // Optional fallback endpoint; ignore when unavailable.
  }

  const merged = mergeByKey([...mappedPrimary, ...mappedSecondary]).map((field) => ({
    id: asString(field.id),
    name: asString(field.name),
    type: asString(field.type) || 'string',
    choices: field.choices,
  }));

  const needsDetail = merged.filter(
    (field) =>
      /choice/i.test(field.type) &&
      field.id &&
      (!Array.isArray(field.choices) || field.choices.length === 0)
  );

  if (needsDetail.length > 0) {
    const detailResults = await Promise.allSettled(
      needsDetail.map(async (field) => {
        const detailResponse = await request(`/tables/${tableId}/fields/${field.id}`);
        if (!detailResponse.ok) {
          return { id: field.id, choices: [] as NinoxChoiceOption[] };
        }
        const detailPayload = (await detailResponse.json()) as Record<string, unknown>;
        const parsed = parseChoices(detailPayload) || [];
        return { id: field.id, choices: parsed };
      })
    );

    const choicesById = new Map<string, NinoxChoiceOption[]>();
    for (const result of detailResults) {
      if (result.status === 'fulfilled' && result.value.choices.length > 0) {
        choicesById.set(result.value.id, result.value.choices);
      }
    }

    return merged.map((field) => {
      const detailChoices = choicesById.get(field.id);
      if (detailChoices && detailChoices.length > 0) {
        return { ...field, choices: detailChoices };
      }
      return field;
    });
  }

  return merged;
}

export async function fetchNinoxGrootboekCategorieOpties(): Promise<string[]> {
  const fields = await fetchNinoxTableFields(tableIds.grootboek);
  const categorieField = fields.find((field) => normalizeCompare(field.name) === normalizeCompare('Categorie'));
  if (!categorieField || !Array.isArray(categorieField.choices) || categorieField.choices.length === 0) {
    return ['Inkomsten', 'Uitgaven', 'Balans'];
  }

  const values = categorieField.choices
    .map((choice) => asString(choice.caption).trim())
    .filter((value, index, all) => value.length > 0 && all.indexOf(value) === index);

  return values.length > 0 ? values : ['Inkomsten', 'Uitgaven', 'Balans'];
}

export async function fetchNinoxGrootboekBalansOpties(): Promise<string[]> {
  const fields = await fetchNinoxTableFields(tableIds.grootboek);
  const balansField = fields.find((field) => normalizeCompare(field.name) === normalizeCompare('Balans'));
  if (!balansField || !Array.isArray(balansField.choices) || balansField.choices.length === 0) {
    return [];
  }
  return balansField.choices
    .map((choice) => asString(choice.caption).trim() || asString(choice.id).trim())
    .filter((value, index, all) => value.length > 0 && all.indexOf(value) === index);
}

export async function fetchNinoxRelatieLandOpties(): Promise<string[]> {
  const tableId = await fetchTableIdByName('Relaties');
  if (!tableId) {
    throw new Error('Tabel Relaties niet gevonden.');
  }
  const fields = await fetchNinoxTableFields(tableId);
  const landField = fields.find((field) => normalizeCompare(field.name) === normalizeCompare('Land'));
  if (!landField || !Array.isArray(landField.choices) || landField.choices.length === 0) {
    return [];
  }
  return landField.choices
    .map((choice) => asString(choice.caption).trim() || asString(choice.id).trim())
    .filter((value, index, all) => value.length > 0 && all.indexOf(value) === index)
    .sort((a, b) => a.localeCompare(b, 'nl', { sensitivity: 'base', numeric: true }));
}

async function fetchRawChoiceValuesInFieldOrder(tableId: string, aliases: string[]): Promise<string[]> {
  const response = await request(`/tables/${tableId}`);
  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as { fields?: Array<Record<string, unknown>> };
  const rawFields = Array.isArray(payload?.fields) ? payload.fields : [];
  const target = rawFields.find((field) => aliases.some((alias) => normalizeCompare(asString(field.name)) === normalizeCompare(alias)));
  if (!target) {
    return [];
  }

  const rawChoices = Array.isArray(target.choices)
    ? target.choices
    : Array.isArray((target.properties as Record<string, unknown> | undefined)?.choices)
    ? ((target.properties as Record<string, unknown>).choices as unknown[])
    : [];

  const values: string[] = [];
  for (const choice of rawChoices) {
    if (typeof choice === 'string') {
      const text = choice.trim();
      if (text && !values.includes(text)) {
        values.push(text);
      }
      continue;
    }
    if (choice && typeof choice === 'object') {
      const obj = choice as Record<string, unknown>;
      const text =
        asString(obj.caption).trim() ||
        asString(obj.label).trim() ||
        asString(obj.name).trim() ||
        asString(obj.id).trim() ||
        asString(obj.value).trim();
      if (text && !values.includes(text)) {
        values.push(text);
      }
    }
  }

  return values;
}

export async function fetchNinoxStatusVasteOpties(): Promise<{
  jaar: string[];
  status: string[];
  periodeVan: string[];
  periodeTm: string[];
}> {
  const tableId = await fetchTableIdByName('Status');
  if (!tableId) {
    throw new Error('Tabel Status niet gevonden.');
  }

  const fields = await fetchNinoxTableFields(tableId);
  const findChoices = (aliases: string[]): string[] => {
    const target = fields.find((field) => aliases.some((alias) => normalizeCompare(field.name) === normalizeCompare(alias)));
    if (!target || !Array.isArray(target.choices) || target.choices.length === 0) {
      return [];
    }
    return target.choices
      .map((choice) => asString(choice.caption).trim() || asString(choice.id).trim())
      .filter((value, index, all) => value.length > 0 && all.indexOf(value) === index)
      .sort((a, b) => a.localeCompare(b, 'nl', { sensitivity: 'base', numeric: true }));
  };

  const [periodeVan, periodeTm] = await Promise.all([
    fetchRawChoiceValuesInFieldOrder(tableId, ['Periode van', 'Periode vanaf']),
    fetchRawChoiceValuesInFieldOrder(tableId, ['Periode t/m', 'Periode tm', 'Periode tot']),
  ]);

  return {
    jaar: findChoices(['Jaar']),
    status: findChoices(['Status']),
    periodeVan,
    periodeTm,
  };
}

export async function createNinoxRecord(tableId: string, fields: Record<string, unknown>): Promise<number> {
  await assertKnownNinoxFields(tableId, fields, 'aanmaken');
  const normalized = await normalizeDateFieldsForWrite(tableId, fields);
  const id = await createNinoxRecordReturningId(tableId, normalized.fields);
  await verifyWrittenDateFields(tableId, id, normalized.verify);
  return id;
}

async function createNinoxRecordReturningId(tableId: string, fields: Record<string, unknown>): Promise<number> {
  const payload = [{ fields }];
  const response = await request(`/tables/${tableId}/records`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    const message = typeof errorPayload?.message === 'string' ? errorPayload.message : 'Onbekende Ninox fout';
    throw new Error(`Record aanmaken mislukt (${response.status}): ${message}`);
  }

  const created = await response.json().catch(() => null);
  if (Array.isArray(created) && created.length > 0 && typeof created[0]?.id === 'number') {
    return created[0].id;
  }
  if (created && typeof created.id === 'number') {
    return created.id;
  }
  throw new Error('Record aangemaakt, maar geen record-id teruggekregen van Ninox.');
}

export async function updateNinoxRecord(tableId: string, id: number, fields: Record<string, unknown>): Promise<void> {
  await assertKnownNinoxFields(tableId, fields, 'bijwerken');
  const normalized = await normalizeDateFieldsForWrite(tableId, fields);
  const response = await request(`/tables/${tableId}/records/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: normalized.fields }),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    const message = typeof errorPayload?.message === 'string' ? errorPayload.message : 'Onbekende Ninox fout';
    throw new Error(`Record bijwerken mislukt (${response.status}): ${message}`);
  }
  await verifyWrittenDateFields(tableId, id, normalized.verify);
}

export async function deleteNinoxRecord(tableId: string, id: number): Promise<void> {
  const response = await request(`/tables/${tableId}/records/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    const message = typeof errorPayload?.message === 'string' ? errorPayload.message : 'Onbekende Ninox fout';
    throw new Error(`Record verwijderen mislukt (${response.status}): ${message}`);
  }
}

export async function createNinoxGrootboekrekening(input: GrootboekrekeningInput): Promise<void> {
  await createNinoxRecord(tableIds.grootboek, {
    Nummer: input.nummer,
    Omschrijving: input.naam,
    Categorie: input.categorie,
    Saldo: input.saldo,
    Balans: input.balans,
  });
}

export async function updateNinoxGrootboekrekening(id: number, input: GrootboekrekeningInput): Promise<void> {
  await updateNinoxRecord(tableIds.grootboek, id, {
    Nummer: input.nummer,
    Omschrijving: input.naam,
    Categorie: input.categorie,
    Saldo: input.saldo,
    Balans: input.balans,
  });
}

export async function deleteNinoxGrootboekrekening(id: number): Promise<void> {
  await deleteNinoxRecord(tableIds.grootboek, id);
}

export async function pingNinoxKeepAlive(): Promise<void> {
  const response = await request('/tables');
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    const message = typeof errorPayload?.message === 'string' ? errorPayload.message : 'Onbekende Ninox fout';
    throw new Error(`Ninox keep-alive mislukt (${response.status}): ${message}`);
  }
}
export async function testNinoxConnection(): Promise<NinoxConnectionResult> {
  try {
    const response = await request('/tables');
    if (!response.ok) {
      let message = `Ninox antwoordde met HTTP ${response.status}`;
      try {
        const errorPayload = await response.json();
        if (errorPayload?.message) {
          message = `${message}: ${errorPayload.message}`;
        }
      } catch {
        // Ignore JSON parsing errors in error responses.
      }

      return {
        ok: false,
        status: response.status,
        message,
        tables: [],
      };
    }

    const tables = [...(await parseTables(response))].sort((a, b) => a.name.localeCompare(b.name, 'nl', { sensitivity: 'base' }));
    const tablesWithCounts = await Promise.all(
      tables.map(async (table) => {
        try {
          const records = await fetchTableRecords(table.id, 500);
          return { ...table, recordCount: records.length };
        } catch {
          return { ...table, recordCount: undefined };
        }
      })
    );

    return {
      ok: true,
      status: response.status,
      message: 'Ninox verbinding is gelukt.',
      tables: tablesWithCounts,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Onbekende fout';
    return {
      ok: false,
      status: 0,
      message: `Verbindingsfout: ${message}`,
      tables: [],
    };
  }
}
const ninoxBackupDeps = {
  request,
  parseTables,
  fetchNinoxTableFields,
  fetchTableRecords,
  fetchRecordFileNames,
  resolveLinkedFileNameForField,
  base64ToBlob,
  normalizeCompare,
  asString,
};

const ninoxInstellingenDeps = {
  fetchTableIdByName,
  fetchTableRecords,
  fetchNinoxTableFields,
  updateNinoxRecord,
  uploadNinoxRecordDocument,
  fetchRecordFileNames,
  resolveLinkedFileNameForField,
  request,
  asString,
  extractComparableText,
  normalizeCompare,
  asIntegerNumber,
  base64ToBlob,
};

export async function createNinoxBackupDump(
  onProgress?: (progress: NinoxBackupProgress) => void
): Promise<NinoxBackupDump> {
  return createNinoxBackupDumpWithDeps(ninoxBackupDeps, onProgress);
}

export async function createNinoxTableBackupDump(
  tableNameOrId: string,
  onProgress?: (progress: NinoxBackupProgress) => void
): Promise<NinoxBackupDump> {
  return createNinoxTableBackupDumpWithDeps(ninoxBackupDeps, tableNameOrId, onProgress);
}

export async function createNinoxBackupArchive(
  onProgress?: (progress: NinoxBackupProgress) => void
): Promise<NinoxBackupArchive> {
  return createNinoxBackupArchiveWithDeps(ninoxBackupDeps, onProgress);
}

export async function createNinoxTableBackupArchive(
  tableNameOrId: string,
  onProgress?: (progress: NinoxBackupProgress) => void
): Promise<NinoxBackupArchive> {
  return createNinoxTableBackupArchiveWithDeps(ninoxBackupDeps, tableNameOrId, onProgress);
}

async function fetchTableRecordsSinglePage(tableId: string, perPage = 500): Promise<NinoxRecord[]> {
  const response = await request(`/tables/${tableId}/records?perPage=${perPage}`);
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    const message = typeof errorPayload?.message === 'string' ? errorPayload.message : 'Onbekende Ninox fout';
    throw new Error(`Tabel ${tableId} ophalen mislukt (${response.status}): ${message}`);
  }

  const payload = await response.json();
  return Array.isArray(payload) ? (payload as NinoxRecord[]) : [];
}

async function fetchTableRecordsWithQuery(
  tableId: string,
  queryParams: URLSearchParams,
  perPage = 500,
  maxPages = 1000
): Promise<NinoxRecord[]> {
  const baseParams = new URLSearchParams(queryParams);
  baseParams.set('perPage', String(perPage));

  const fetchBatch = async (pageParam: string, pageValue: string): Promise<NinoxRecord[]> => {
    const params = new URLSearchParams(baseParams);
    params.set(pageParam, pageValue);
    const response = await request(`/tables/${tableId}/records?${params.toString()}`);
    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      const message = typeof errorPayload?.message === 'string' ? errorPayload.message : 'Onbekende Ninox fout';
      throw new Error(`Tabel ${tableId} ophalen mislukt (${response.status}): ${message}`);
    }
    const payload = await response.json().catch(() => []);
    return Array.isArray(payload) ? (payload as NinoxRecord[]) : [];
  };

  const runStrategy = async (strategy: 'page' | 'offset' | 'skip'): Promise<NinoxRecord[]> => {
    const results: NinoxRecord[] = [];
    const seenIds = new Set<number>();
    for (let index = 0; index < maxPages; index += 1) {
      const pageParam = strategy === 'page' ? 'page' : strategy === 'offset' ? 'offset' : 'skip';
      const pageValue = strategy === 'page' ? String(index + 1) : String(index * perPage);
      const batch = await fetchBatch(pageParam, pageValue);
      if (batch.length === 0) {
        break;
      }
      let nieuweRecords = 0;
      for (const record of batch) {
        if (typeof record?.id !== 'number' || seenIds.has(record.id)) {
          continue;
        }
        seenIds.add(record.id);
        results.push(record);
        nieuweRecords += 1;
      }
      if (nieuweRecords === 0 || batch.length < perPage) {
        break;
      }
    }
    return results;
  };

  const withPage = await runStrategy('page');
  if (withPage.length > perPage) {
    return withPage;
  }
  const withOffset = await runStrategy('offset');
  if (withOffset.length >= withPage.length && withOffset.length > 0) {
    return withOffset;
  }
  const withSkip = await runStrategy('skip');
  if (withSkip.length >= withOffset.length && withSkip.length > 0) {
    return withSkip;
  }
  if (withPage.length > 0) {
    return withPage;
  }
  return fetchBatch('page', '1');
}

async function fetchTableRecordsAllPages(tableId: string, perPage = 500, maxPages = 1000): Promise<NinoxRecord[]> {
  const fetchBatch = async (query: string): Promise<NinoxRecord[]> => {
    const response = await request(`/tables/${tableId}/records?perPage=${perPage}&${query}`);
    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      const message = typeof errorPayload?.message === 'string' ? errorPayload.message : 'Onbekende Ninox fout';
      throw new Error(`Tabel ${tableId} ophalen mislukt (${response.status}): ${message}`);
    }
    const payload = await response.json().catch(() => []);
    return Array.isArray(payload) ? (payload as NinoxRecord[]) : [];
  };

  const runStrategy = async (strategy: 'page' | 'offset' | 'skip'): Promise<NinoxRecord[]> => {
    const results: NinoxRecord[] = [];
    const seenIds = new Set<number>();
    for (let index = 0; index < maxPages; index += 1) {
      const query =
        strategy === 'page'
          ? `page=${index + 1}`
          : strategy === 'offset'
          ? `offset=${index * perPage}`
          : `skip=${index * perPage}`;
      const batch = await fetchBatch(query);
      if (batch.length === 0) {
        break;
      }
      let nieuweRecords = 0;
      for (const record of batch) {
        if (typeof record?.id !== 'number') {
          continue;
        }
        if (seenIds.has(record.id)) {
          continue;
        }
        seenIds.add(record.id);
        results.push(record);
        nieuweRecords += 1;
      }
      if (nieuweRecords === 0) {
        break;
      }
      if (batch.length < perPage) {
        break;
      }
    }
    return results;
  };

  const withPage = await runStrategy('page');
  if (withPage.length > perPage) {
    return withPage;
  }
  const withOffset = await runStrategy('offset');
  if (withOffset.length >= withPage.length && withOffset.length > 0) {
    return withOffset;
  }
  const withSkip = await runStrategy('skip');
  if (withSkip.length >= withOffset.length && withSkip.length > 0) {
    return withSkip;
  }
  if (withPage.length > 0) {
    return withPage;
  }
  return fetchTableRecordsSinglePage(tableId, perPage);
}

export async function fetchTableRecords(tableId: string, perPage = 500): Promise<NinoxRecord[]> {
  return fetchTableRecordsAllPages(tableId, perPage);
}

async function fetchTableRecordsFiltered(tableId: string, filters: Record<string, unknown>, perPage = 500): Promise<NinoxRecord[]> {
  const queryParams = new URLSearchParams();
  queryParams.set('filters', JSON.stringify({ fields: filters }));
  queryParams.set('ids', 'true');
  return fetchTableRecordsWithQuery(tableId, queryParams, perPage);
}

export async function fetchNinoxLeden(): Promise<Lid[]> {
  const records = await fetchTableRecords(tableIds.leden);
  return records.map(mapLid).sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));
}

export async function fetchNinoxInstellingenOverzicht(): Promise<NinoxInstellingItem[]> {
  return fetchNinoxInstellingenOverzichtWithDeps(ninoxInstellingenDeps);
}

export async function updateNinoxInstellingAlgemeen(
  id: number,
  input: UpdateNinoxInstellingAlgemeenInput
): Promise<void> {
  await updateNinoxInstellingAlgemeenWithDeps(ninoxInstellingenDeps, id, input);
}

export async function uploadNinoxInstellingenDocument01(recordId: number, file: File): Promise<void> {
  await uploadNinoxInstellingenDocument01WithDeps(ninoxInstellingenDeps, recordId, file);
}

export async function uploadNinoxInstellingenDocument02(recordId: number, file: File): Promise<void> {
  await uploadNinoxInstellingenDocument02WithDeps(ninoxInstellingenDeps, recordId, file);
}

export async function clearNinoxInstellingenDocument01(recordId: number): Promise<void> {
  await clearNinoxInstellingenDocument01WithDeps(ninoxInstellingenDeps, recordId);
}

export async function clearNinoxInstellingenDocument02(recordId: number): Promise<void> {
  await clearNinoxInstellingenDocument02WithDeps(ninoxInstellingenDeps, recordId);
}

export async function fetchNinoxInstellingenDocument01(recordId: number): Promise<NinoxRecordDocument | null> {
  return fetchNinoxInstellingenDocument01WithDeps(ninoxInstellingenDeps, recordId);
}

export async function fetchNinoxInstellingenDocument02(recordId: number): Promise<NinoxRecordDocument | null> {
  return fetchNinoxInstellingenDocument02WithDeps(ninoxInstellingenDeps, recordId);
}

export async function fetchNinoxInformatie(): Promise<NinoxInformatieItem[]> {
  const tableId = await fetchTableIdByName('Informatie');
  if (!tableId) {
    throw new Error('Tabel Informatie niet gevonden.');
  }
  const records = await fetchTableRecords(tableId, 1000);
  return records
    .map((record) => {
      const fields = record.fields ?? {};
      const omschrijvingHtml =
        asRichTextHtml(fields.Omschrijving).trim() ||
        asRichTextHtml(fields.Inhoud).trim() ||
        asRichTextHtml(fields.Tekst).trim() ||
        '';
      const onderwerp =
        asString(fields.Onderwerp).trim() ||
        asString(fields.Titel).trim() ||
        asString(fields.Naam).trim() ||
        `Informatie ${record.id}`;
      const omschrijving = asRichTextString(omschrijvingHtml).trim();
      return {
        id: record.id,
        onderwerp,
        omschrijving,
        omschrijvingHtml,
      } satisfies NinoxInformatieItem;
    })
    .sort((a, b) => a.onderwerp.localeCompare(b.onderwerp, 'nl', { sensitivity: 'base', numeric: true }));
}

export async function createNinoxInformatie(input: { onderwerp: string; omschrijving: string }): Promise<void> {
  const tableId = await fetchTableIdByName('Informatie');
  if (!tableId) {
    throw new Error('Tabel Informatie niet gevonden.');
  }
  const tableFields = await fetchNinoxTableFields(tableId);
  const onderwerpField = findFieldName(tableFields, ['Onderwerp', 'Titel', 'Naam']) || 'Onderwerp';
  const omschrijvingField = findFieldName(tableFields, ['Omschrijving', 'Inhoud', 'Tekst']) || 'Omschrijving';
  await createNinoxRecord(tableId, {
    [onderwerpField]: input.onderwerp.trim(),
    [omschrijvingField]: input.omschrijving.trim(),
  });
}

export async function updateNinoxInformatie(id: number, input: { onderwerp: string; omschrijving: string }): Promise<void> {
  const tableId = await fetchTableIdByName('Informatie');
  if (!tableId) {
    throw new Error('Tabel Informatie niet gevonden.');
  }
  const tableFields = await fetchNinoxTableFields(tableId);
  const onderwerpField = findFieldName(tableFields, ['Onderwerp', 'Titel', 'Naam']) || 'Onderwerp';
  const omschrijvingField = findFieldName(tableFields, ['Omschrijving', 'Inhoud', 'Tekst']) || 'Omschrijving';
  await updateNinoxRecord(tableId, id, {
    [onderwerpField]: input.onderwerp.trim(),
    [omschrijvingField]: input.omschrijving.trim(),
  });
}

export async function deleteNinoxInformatie(id: number): Promise<void> {
  const tableId = await fetchTableIdByName('Informatie');
  if (!tableId) {
    throw new Error('Tabel Informatie niet gevonden.');
  }
  await deleteNinoxRecord(tableId, id);
}

export async function fetchNinoxRelaties(): Promise<Relatie[]> {
  const tableId = await fetchTableIdByName('Relaties');
  if (!tableId) {
    throw new Error('Tabel Relaties niet gevonden.');
  }

  const records = await fetchTableRecords(tableId, 500);
  return records
    .map((record) => {
      const fields = record.fields ?? {};
      const naam =
        asString(fields['Naam relatie']).trim() ||
        asString(fields.Naam).trim() ||
        asString(fields.Bedrijf).trim() ||
        asString(fields.Relatie).trim() ||
        asString(fields.Titel).trim() ||
        `Relatie ${record.id}`;
      const adres =
        asString(fields['Straat + Huisnummer']).trim() ||
        asString(fields.Adres).trim() ||
        '';
      const postcode = asString(fields.Postcode).trim() || '';
      const woonplaats = asString(fields.Woonplaats).trim() || '';
      const land = asString(fields.Land).trim() || '';
      const type =
        asString(fields.Type).trim() ||
        asString(fields['Relatie type']).trim() ||
        asString(fields.Soort).trim() ||
        '';
      const actief =
        extractComparableText(fields.Actief) ||
        asString(fields.Actief).trim() ||
        '';
      const nummerExact =
        extractComparableText(fields['Nummer Exact']) ||
        asString(fields['Nummer Exact']).trim() ||
        extractComparableText(fields['Debiteurennummer Exact']) ||
        asString(fields['Debiteurennummer Exact']).trim() ||
        '';
      const gestoptPer =
        asString(fields['Gestopt per']).trim() ||
        asString(fields.Gestopt).trim() ||
        asString(fields['Einddatum']).trim() ||
        '';
      const standaardGrootboekrekening =
        extractComparableText(fields['Standaard grootboekrekening']) ||
        extractComparableText(fields['Standaard Grootboekrekening']) ||
        asString(fields['Standaard grootboeknummer']).trim() ||
        asString(fields['Standaard Grootboeknummer']).trim() ||
        '';
      const opmerkingen =
        asString(fields.Opmerkingen).trim() ||
        asString(fields['Opmerking']).trim() ||
        asString(fields['Memo']).trim() ||
        '';
      const email = '';
      return {
        id: record.id,
        naam,
        email,
        type,
        actief,
        nummerExact,
        gestoptPer,
        adres,
        postcode,
        woonplaats,
        land,
        standaardGrootboekrekening,
        opmerkingen,
      } satisfies Relatie;
    })
    .sort((a, b) => a.naam.localeCompare(b.naam, 'nl', { sensitivity: 'base', numeric: true }));
}

export async function fetchNinoxContactpersonenVoorRelatie(relatieId: number): Promise<Contactpersoon[]> {
  if (!Number.isFinite(relatieId) || relatieId <= 0) {
    return [];
  }

  const tableId = await fetchTableIdByName('Contactpersonen');
  if (!tableId) {
    throw new Error('Tabel Contactpersonen niet gevonden.');
  }

  const tableFields = await fetchNinoxTableFields(tableId);
  const relatieField = findFieldName(tableFields, ['Relaties', 'Relatie']) || 'Relaties';
  const records = await fetchTableRecordsFiltered(tableId, { [relatieField]: relatieId }, 2000);
  const naamField = findFieldName(tableFields, ['Naam', 'Volledige naam', 'Contactpersoon', 'Roepnaam']) || 'Naam';
  const roepnaamField = findFieldName(tableFields, ['Roepnaam']) || 'Roepnaam';
  const functieField = findFieldName(tableFields, ['Functie']) || 'Functie';
  const afdelingField = findFieldName(tableFields, ['Afdeling']) || 'Afdeling';
  const mobielField = findFieldName(tableFields, ['Mobiel', 'Mobiel nummer', 'Mobiel zakelijk']) || 'Mobiel';
  const telefoonField = findFieldName(tableFields, ['Telefoon', 'Telefoon zakelijk', 'Tel zakelijk']) || 'Telefoon';
  const emailField = findFieldName(tableFields, ['Email', 'E-mail', 'Mail zakelijk', 'E-mail zakelijk', 'Email zakelijk']) || 'Email';
  return records
    .map((record) => {
      const fields = record.fields ?? {};
      return {
        id: record.id,
        naam: asString(fields[naamField]).trim() || `Contactpersoon ${record.id}`,
        roepnaam: asString(fields[roepnaamField]).trim() || '',
        functie: asString(fields[functieField]).trim() || '',
        afdeling: asString(fields[afdelingField]).trim() || '',
        mobiel: asString(fields[mobielField]).trim() || '',
        telefoon: asString(fields[telefoonField]).trim() || '',
        email: asString(fields[emailField]).trim() || '',
      } satisfies Contactpersoon;
    })
    .sort((a, b) => a.naam.localeCompare(b.naam, 'nl', { sensitivity: 'base', numeric: true }));
}

export async function fetchNinoxContactpersonen(): Promise<Contactpersoon[]> {
  const tableId = await fetchTableIdByName('Contactpersonen');
  if (!tableId) {
    throw new Error('Tabel Contactpersonen niet gevonden.');
  }

  const [records, tableFields] = await Promise.all([fetchTableRecords(tableId, 2000), fetchNinoxTableFields(tableId)]);
  const relatieField = findFieldName(tableFields, ['Relaties', 'Relatie']) || 'Relaties';
  const naamField = findFieldName(tableFields, ['Naam', 'Volledige naam', 'Contactpersoon', 'Roepnaam']) || 'Naam';
  const roepnaamField = findFieldName(tableFields, ['Roepnaam']) || 'Roepnaam';
  const functieField = findFieldName(tableFields, ['Functie']) || 'Functie';
  const afdelingField = findFieldName(tableFields, ['Afdeling']) || 'Afdeling';
  const mobielField = findFieldName(tableFields, ['Mobiel', 'Mobiel nummer', 'Mobiel zakelijk']) || 'Mobiel';
  const telefoonField = findFieldName(tableFields, ['Telefoon', 'Telefoon zakelijk', 'Tel zakelijk']) || 'Telefoon';
  const emailField = findFieldName(tableFields, ['Email', 'E-mail', 'Mail zakelijk', 'E-mail zakelijk', 'Email zakelijk']) || 'Email';

  return records
    .map((record) => {
      const fields = record.fields ?? {};
      const relatieValue = fields[relatieField];
      const relatieIds = Array.isArray(relatieValue)
        ? relatieValue.map((value) => extractLinkedRecordId(value)).filter((value): value is number => typeof value === 'number' && value > 0)
        : (() => {
            const linkedId = extractLinkedRecordId(relatieValue);
            return linkedId && linkedId > 0 ? [linkedId] : [];
          })();
      return {
        id: record.id,
        naam: asString(fields[naamField]).trim() || `Contactpersoon ${record.id}`,
        roepnaam: asString(fields[roepnaamField]).trim() || '',
        functie: asString(fields[functieField]).trim() || '',
        afdeling: asString(fields[afdelingField]).trim() || '',
        mobiel: asString(fields[mobielField]).trim() || '',
        telefoon: asString(fields[telefoonField]).trim() || '',
        email: asString(fields[emailField]).trim() || '',
        relatieIds,
      } satisfies Contactpersoon;
    })
    .sort((a, b) => a.naam.localeCompare(b.naam, 'nl', { sensitivity: 'base', numeric: true }));
}

export async function fetchNinoxMailContactpersonen(): Promise<ContactpersoonMailOptie[]> {
  const tableId = await fetchTableIdByName('Contactpersonen');
  if (!tableId) {
    throw new Error('Tabel Contactpersonen niet gevonden.');
  }

  const [records, tableFields] = await Promise.all([fetchTableRecords(tableId, 2000), fetchNinoxTableFields(tableId)]);
  const naamField = findFieldName(tableFields, ['Naam', 'Volledige naam', 'Contactpersoon', 'Roepnaam']) || 'Naam';
  const emailField = findFieldName(tableFields, ['Email', 'E-mail', 'Mail zakelijk', 'E-mail zakelijk', 'Email zakelijk']) || 'Email';
  const roepnaamField = findFieldName(tableFields, ['Roepnaam']) || 'Roepnaam';
  const bedrijfsnaamField = findFieldName(tableFields, ['Bedrijfsnaam', 'Bedrijf', 'Organisatie', 'Naam organisatie']) || 'Bedrijfsnaam';
  const logoField = findFieldName(tableFields, ['Logo', 'Logo mail', 'Logo-mail']) || 'Logo';

  return records
    .map((record) => {
      const fields = record.fields ?? {};
      return {
        id: record.id,
        naam: asString(fields[naamField]).trim() || `Contactpersoon ${record.id}`,
        email: asString(fields[emailField]).trim(),
        roepnaam: asString(fields[roepnaamField]).trim(),
        bedrijfsnaam: asString(fields[bedrijfsnaamField]).trim(),
        logo: asString(fields[logoField]).trim(),
      } satisfies ContactpersoonMailOptie;
    })
    .filter((item) => item.email.trim().length > 0)
    .sort((a, b) => a.naam.localeCompare(b.naam, 'nl', { sensitivity: 'base', numeric: true }));
}

async function resolveContactpersonenFieldNames(tableId: string): Promise<{
  naam: string;
  roepnaam: string;
  email: string;
}> {
  const tableFields = await fetchNinoxTableFields(tableId);
  return {
    naam: findFieldName(tableFields, ['Naam', 'Volledige naam', 'Contactpersoon', 'Roepnaam']) || 'Naam',
    roepnaam: findFieldName(tableFields, ['Roepnaam']) || 'Roepnaam',
    email: findFieldName(tableFields, ['Email', 'E-mail', 'Mail zakelijk', 'E-mail zakelijk', 'Email zakelijk']) || 'Email',
  };
}

export async function updateNinoxContactpersoon(id: number, input: { naam: string; roepnaam?: string; email?: string }): Promise<void> {
  const tableId = await fetchTableIdByName('Contactpersonen');
  if (!tableId) {
    throw new Error('Tabel Contactpersonen niet gevonden.');
  }
  const names = await resolveContactpersonenFieldNames(tableId);
  await updateNinoxRecord(tableId, id, {
    [names.naam]: String(input.naam || '').trim(),
    [names.roepnaam]: String(input.roepnaam || '').trim(),
    [names.email]: String(input.email || '').trim(),
  });
}

export async function createNinoxContactpersoon(input: {
  relatieId: number;
  naam: string;
  roepnaam?: string;
  email?: string;
}): Promise<number> {
  const tableId = await fetchTableIdByName('Contactpersonen');
  if (!tableId) {
    throw new Error('Tabel Contactpersonen niet gevonden.');
  }
  const tableFields = await fetchNinoxTableFields(tableId);
  const relatieField = findFieldName(tableFields, ['Relaties', 'Relatie']);
  if (!relatieField) {
    throw new Error('Linkveld Relaties niet gevonden in tabel Contactpersonen.');
  }
  const names = await resolveContactpersonenFieldNames(tableId);
  return createNinoxRecord(tableId, {
    [relatieField]: input.relatieId,
    [names.naam]: String(input.naam || '').trim(),
    [names.roepnaam]: String(input.roepnaam || '').trim(),
    [names.email]: String(input.email || '').trim(),
  });
}

export async function deleteNinoxContactpersoon(id: number): Promise<void> {
  const tableId = await fetchTableIdByName('Contactpersonen');
  if (!tableId) {
    throw new Error('Tabel Contactpersonen niet gevonden.');
  }
  await deleteNinoxRecord(tableId, id);
}

export async function fetchNinoxVerkoopfactuurAbonnementen(): Promise<VerkoopfactuurAbonnementItem[]> {
  const [abonnementenTableId, relatiesTableId, abonnementArtikelenTableId, artikelenTableId, contactpersonenTableId] = await Promise.all([
    fetchTableIdByName('Abonnementen'),
    fetchTableIdByName('Relaties'),
    fetchTableIdByName('Abonnementen - Artikelen'),
    fetchTableIdByName('Artikelen'),
    fetchTableIdByName('Contactpersonen'),
  ]);
  if (!abonnementenTableId) {
    throw new Error('Tabel Abonnementen niet gevonden.');
  }
  if (!relatiesTableId) {
    throw new Error('Tabel Relaties niet gevonden.');
  }
  if (!abonnementArtikelenTableId) {
    throw new Error('Tabel Abonnementen - Artikelen niet gevonden.');
  }
  if (!artikelenTableId) {
    throw new Error('Tabel Artikelen niet gevonden.');
  }

  const [
    abonnementenRecords,
    relatiesRecords,
    abonnementArtikelenRecords,
    artikelenRecords,
    contactpersonenRecords,
    abonnementenFields,
    relatiesFields,
    abonnementArtikelenFields,
    artikelenFields,
    contactpersonenFields,
  ] = await Promise.all([
    fetchTableRecords(abonnementenTableId, 500),
    fetchTableRecords(relatiesTableId, 500),
    fetchTableRecords(abonnementArtikelenTableId, 2000),
    fetchTableRecords(artikelenTableId, 2000),
    contactpersonenTableId ? fetchTableRecords(contactpersonenTableId, 1000) : Promise.resolve([] as NinoxRecord[]),
    fetchNinoxTableFields(abonnementenTableId).catch(() => []),
    fetchNinoxTableFields(relatiesTableId).catch(() => []),
    fetchNinoxTableFields(abonnementArtikelenTableId).catch(() => []),
    fetchNinoxTableFields(artikelenTableId).catch(() => []),
    contactpersonenTableId ? fetchNinoxTableFields(contactpersonenTableId).catch(() => []) : Promise.resolve([] as NinoxTableField[]),
  ]);

  const relatieNaamField =
    findFieldName(relatiesFields, ['Naam relatie', 'Naam', 'Bedrijf', 'Relatie', 'Titel']) || 'Naam relatie';
  const relatieTypeField = findFieldName(relatiesFields, ['Type', 'Relatie type', 'Soort']) || 'Type';
  const relatieFactuurContactpersoonExtraField =
    findFieldName(relatiesFields, ['Factuur contactpersoon extra', 'Factuurcontactpersoon extra']) ||
    'Factuur contactpersoon extra';
  const contactpersoonNaamField =
    findFieldName(contactpersonenFields, ['Naam', 'Volledige naam', 'Contactpersoon', 'Roepnaam']) || 'Naam';
  const abonnementRelatieField = findFieldName(abonnementenFields, ['Relatie', 'Relatie - 01', 'Klant']) || 'Relatie';
  const statusAbonnementField =
    findFieldName(abonnementenFields, ['Status abonnement', 'Abonnement status', 'Status']) || 'Status abonnement';
  const startAbonnementField =
    findFieldName(abonnementenFields, ['Start abonnement', 'Abonnement start', 'Startdatum abonnement']) ||
    'Start abonnement';
  const stopAbonnementField =
    findFieldName(abonnementenFields, ['Stop abonnement', 'Abonnement stop', 'Einddatum abonnement']) ||
    'Stop abonnement';
  const onderdeelField = findFieldName(abonnementenFields, ['Onderdeel']) || 'Onderdeel';
  const statusInfoField = findFieldName(abonnementenFields, ['Status info', 'Statusinformatie']) || 'Status info';
  const abonnementField = findFieldName(abonnementenFields, ['Abonnement']) || 'Abonnement';
  const poActieField = findFieldName(abonnementenFields, ['PO actie', 'PO-actie', 'Actie PO']) || 'PO actie';
  const poNummerField = findFieldName(abonnementenFields, ['PO nummer', 'PO-nummer', 'POnummer']) || 'PO nummer';
  const aparteFactuurField =
    findFieldName(abonnementenFields, ['Aparte factuur', 'Apart factuur', 'Apartefactuur']) || 'Aparte factuur';
  const poGeldigTmField =
    findFieldName(abonnementenFields, ['PO geldig t/m', 'PO geldig tm', 'PO geldig tot']) || 'PO geldig t/m';
  const factuurPeriodeField =
    findFieldName(abonnementenFields, ['Factuur periode', 'Factuurperiode', 'Periode factuur']) || 'Factuur periode';
  const artikelenVerdichtenTot1FactuurregelField =
    findFieldName(abonnementenFields, ['Artikelen verdichten tot 1 factuurregel', 'Artikelen verdichten', 'Verdichten tot 1 factuurregel']) ||
    'Artikelen verdichten tot 1 factuurregel';
  const factuurtekstField = findFieldName(abonnementenFields, ['Factuurtekst', 'Factuur tekst']) || 'Factuurtekst';
  const abonnementArtikelnummerField =
    findFieldName(abonnementenFields, ['Artikelnummer', 'Artikel nummer']) || 'Artikelnummer';
  const abonnementFactuurContactpersoonExtraField =
    findFieldName(abonnementenFields, ['Factuur contactpersoon extra', 'Factuurcontactpersoon extra']) ||
    'Factuur contactpersoon extra';
  const laatsteFactuurdatumField =
    findFieldName(abonnementenFields, ['Laatste factuurdatum', 'Laatst factuurdatum']) || 'Laatste factuurdatum';
  const laatsteFactuurperiodeField =
    findFieldName(abonnementenFields, ['Laatste factuurperiode', 'Laatst factuurperiode']) || 'Laatste factuurperiode';
  const facturenInDeMaandField =
    findFieldName(abonnementenFields, ['Facturen in de maand', 'Facturen in maand', 'Facturen per maand']) || 'Facturen in de maand';
  const tellingJanField = findFieldName(abonnementenFields, ['Telling jan', 'Telling januari']) || 'Telling jan';
  const tellingFebField =
    findFieldName(abonnementenFields, ['Tellegin feb', 'Telling fed', 'Telling feb', 'Telling februari']) || 'Tellegin feb';
  const tellingMrtField = findFieldName(abonnementenFields, ['Telling mrt', 'Telling maart']) || 'Telling mrt';
  const tellingAprField = findFieldName(abonnementenFields, ['Telling apr', 'Telling april']) || 'Telling apr';
  const tellingMeiField = findFieldName(abonnementenFields, ['Telling mei']) || 'Telling mei';
  const tellingJunField = findFieldName(abonnementenFields, ['Telling jun', 'Telling juni']) || 'Telling jun';
  const tellingJulField = findFieldName(abonnementenFields, ['Telling jul', 'Telling juli']) || 'Telling jul';
  const tellingAugField = findFieldName(abonnementenFields, ['Telling aug', 'Telling augustus']) || 'Telling aug';
  const tellingSepField = findFieldName(abonnementenFields, ['Telling sep', 'Telling september']) || 'Telling sep';
  const tellingOktField = findFieldName(abonnementenFields, ['Telling okt', 'Telling oktober']) || 'Telling okt';
  const tellingNovField = findFieldName(abonnementenFields, ['Telling nov', 'Telling november']) || 'Telling nov';
  const tellingDecField = findFieldName(abonnementenFields, ['Telling dec', 'Telling december']) || 'Telling dec';
  const abonnementArtikelAbonnementField =
    findFieldName(abonnementArtikelenFields, ['Abonnementen', 'Abonnement', 'Abonnement - 01']) || 'Abonnementen';
  const abonnementArtikelNummerField =
    findFieldName(abonnementArtikelenFields, ['Artikelnummer', 'Artikel nummer']) || 'Artikelnummer';
  const abonnementArtikelOmschrijvingField =
    findFieldName(abonnementArtikelenFields, ['Omschrijving']) || 'Omschrijving';
  const abonnementArtikelTellingField =
    findFieldName(abonnementArtikelenFields, ['Telling']) || 'Telling';
  const abonnementArtikelAantalField =
    findFieldName(abonnementArtikelenFields, ['Aantal']) || 'Aantal';
  const abonnementArtikelPrijsPerEenheidField =
    findFieldName(abonnementArtikelenFields, ['Prijs per eenheid', 'Prijs per eenhied']) || 'Prijs per eenheid';
  const abonnementArtikelEenmaligFacturerenField =
    findFieldName(abonnementArtikelenFields, ['Eenmalig factureren', 'EenmaligFactureren']) || 'Eenmalig factureren';
  const abonnementArtikelStartActiefField =
    findFieldName(abonnementArtikelenFields, ['Start actief', 'Start actief datum', 'Start actief (optie)', 'Start actief optie']) || 'Start actief';
  const abonnementArtikelStopActiefField =
    findFieldName(abonnementArtikelenFields, ['Stop actief', 'Stop actief datum', 'Stop actief (optie)', 'Stop actief optie']) || 'Stop actief';
  const artikelenNummerField =
    findFieldName(artikelenFields, ['Artikelnummer', 'Artikel nummer']) || 'Artikelnummer';
  const artikelenNummerExactField =
    findFieldName(artikelenFields, ['Artikelnummer Exact', 'Artikel nummer Exact', 'Exact artikelnummer']) || 'Artikelnummer Exact';

  const relatieById = new Map<
    number,
    {
      naam: string;
      factuurContactpersoonExtra: string;
      type: string;
      debiteurennummerExact: string;
    }
  >();
  const relatieByNaam = new Map<
    string,
    {
      naam: string;
      factuurContactpersoonExtra: string;
      type: string;
      debiteurennummerExact: string;
    }
  >();

  for (const record of relatiesRecords) {
    const fields = record.fields ?? {};
    const naam =
      asString(fields[relatieNaamField]).trim() ||
      asString(fields['Naam relatie']).trim() ||
      asString(fields.Naam).trim() ||
      asString(fields.Bedrijf).trim() ||
      asString(fields.Relatie).trim() ||
      `Relatie ${record.id}`;
    const type =
      extractComparableText(fields[relatieTypeField]) ||
      asString(fields.Type).trim() ||
      asString(fields['Relatie type']).trim() ||
      '';
    const debiteurennummerExact =
      extractComparableText(fields['Nummer Exact']) ||
      asString(fields['Nummer Exact']).trim() ||
      extractComparableText(fields['Debiteurennummer Exact']) ||
      asString(fields['Debiteurennummer Exact']).trim() ||
      asString(fields['Debiteur nummer Exact']).trim() ||
      '';
    const factuurContactpersoonExtra =
      extractComparableText(fields[relatieFactuurContactpersoonExtraField]) ||
      asString(fields['Factuur contactpersoon extra']).trim() ||
      asString(fields['Factuurcontactpersoon extra']).trim() ||
      '';
    const item = { naam, factuurContactpersoonExtra, type, debiteurennummerExact };
    relatieById.set(record.id, item);
    relatieByNaam.set(normalizeCompare(naam), item);
  }

  const contactpersoonNaamById = new Map<number, string>();
  const contactpersoonNaamByKey = new Map<string, string>();
  for (const record of contactpersonenRecords) {
    const fields = record.fields ?? {};
    const naam =
      asString(fields[contactpersoonNaamField]).trim() ||
      asString(fields.Naam).trim() ||
      asString(fields['Volledige naam']).trim() ||
      asString(fields.Contactpersoon).trim() ||
      asString(fields.Roepnaam).trim() ||
      `Contactpersoon ${record.id}`;
    contactpersoonNaamById.set(record.id, naam);
    contactpersoonNaamByKey.set(normalizeCompare(naam), naam);
  }

  const resolveContactpersoonNaam = (value: unknown): string => {
    const linkId = extractLinkedRecordId(value);
    if (typeof linkId === 'number') {
      const naamById = contactpersoonNaamById.get(linkId);
      if (naamById) {
        return naamById;
      }
    }

    const comparableText = extractComparableText(value) || asString(value).trim();
    if (!comparableText) {
      return '';
    }

    const naamByKey = contactpersoonNaamByKey.get(normalizeCompare(comparableText));
    return naamByKey || comparableText;
  };

  const artikelnummerExactByArtikelId = new Map<number, string>();
  const artikelnummerExactByArtikelKey = new Map<string, string>();
  for (const record of artikelenRecords) {
    const fields = record.fields ?? {};
    const artikelnummer =
      extractComparableText(fields[artikelenNummerField]) ||
      String(fields[artikelenNummerField] ?? '').trim() ||
      extractComparableText(fields['Artikelnummer']) ||
      String(fields['Artikelnummer'] ?? '').trim() ||
      '';
    const artikelnummerExact =
      extractComparableText(fields[artikelenNummerExactField]) ||
      String(fields[artikelenNummerExactField] ?? '').trim() ||
      extractComparableText(fields['Artikelnummer Exact']) ||
      String(fields['Artikelnummer Exact'] ?? '').trim() ||
      '';
    const artikelNaam =
      extractComparableText(fields.Artikel) ||
      extractComparableText(fields.Naam) ||
      extractComparableText(fields.Omschrijving) ||
      '';
    const extraArtikelKeys = [
      extractComparableText(fields['Artikel nummer']),
      extractComparableText(fields.Nummer),
      extractComparableText(fields.Code),
      asString(fields['Artikelnummer']).trim(),
      asString(fields['Artikel nummer']).trim(),
      asString(fields.Nummer).trim(),
      asString(fields.Code).trim(),
      String(record.id),
    ].filter((value) => Boolean(String(value || '').trim()));

    if (artikelnummerExact) {
      artikelnummerExactByArtikelId.set(record.id, artikelnummerExact);
      if (artikelnummer) {
        artikelnummerExactByArtikelKey.set(normalizeCompare(artikelnummer), artikelnummerExact);
      }
      if (artikelNaam) {
        artikelnummerExactByArtikelKey.set(normalizeCompare(artikelNaam), artikelnummerExact);
      }
      for (const key of extraArtikelKeys) {
        artikelnummerExactByArtikelKey.set(normalizeCompare(String(key)), artikelnummerExact);
      }
    }
  }

  const artikelregelsByAbonnementId = new Map<number, VerkoopfactuurAbonnementArtikelItem[]>();
  const artikelregelsByAbonnementKey = new Map<string, VerkoopfactuurAbonnementArtikelItem[]>();
  for (const record of abonnementArtikelenRecords) {
    const fields = record.fields ?? {};
    const abonnementLinkValue =
      fields[abonnementArtikelAbonnementField] ?? fields.Abonnementen ?? fields.Abonnement ?? fields['Abonnement - 01'];
    const abonnementId = extractLinkedRecordId(abonnementLinkValue);
    const abonnementKey = normalizeCompare(extractComparableText(abonnementLinkValue) || asString(abonnementLinkValue).trim());
    if (typeof abonnementId !== 'number') {
      if (!abonnementKey) {
        continue;
      }
    }

    const artikelNummerValue =
      fields[abonnementArtikelNummerField] ??
      fields.Artikelnummer ??
      fields['Artikel nummer'] ??
      fields.Nummer ??
      fields.Code;
    const artikelNummerRaw =
      extractComparableText(artikelNummerValue) ||
      String(artikelNummerValue ?? '').trim() ||
      extractComparableText(fields.Artikel) ||
      asString(fields.Artikel).trim();
    const artikelNummerKey = normalizeCompare(artikelNummerRaw);

    const artikelregel: VerkoopfactuurAbonnementArtikelItem = {
      id: record.id,
      artikelnummerExact:
        (artikelNummerKey ? artikelnummerExactByArtikelKey.get(artikelNummerKey) || '' : '') ||
        extractComparableText(fields['Artikelnummer Exact']) ||
        String(fields['Artikelnummer Exact'] ?? '').trim() ||
        artikelNummerRaw ||
        '',
      omschrijving:
        extractComparableText(fields[abonnementArtikelOmschrijvingField]) ||
        asString(fields.Omschrijving).trim() ||
        '',
      telling:
        extractComparableText(fields[abonnementArtikelTellingField]) ||
        asString(fields.Telling).trim() ||
        '',
      aantal: asNumber(fields[abonnementArtikelAantalField], 0),
      prijsPerEenheid: asNumber(fields[abonnementArtikelPrijsPerEenheidField], 0),
      eenmaligFactureren:
        extractComparableText(fields[abonnementArtikelEenmaligFacturerenField]) ||
        String(fields[abonnementArtikelEenmaligFacturerenField] ?? fields['Eenmalig factureren'] ?? '').trim() ||
        '',
      startActief:
        parseStrictDateToIso(fields[abonnementArtikelStartActiefField]) ||
        parseStrictDateToIso(fields['Start actief (optie)']) ||
        parseStrictDateToIso(fields['Start actief optie']) ||
        parseStrictDateToIso(fields['Start actief datum']) ||
        parseStrictDateToIso(fields['Start actief']) ||
        '',
      stopActief:
        parseStrictDateToIso(fields[abonnementArtikelStopActiefField]) ||
        parseStrictDateToIso(fields['Stop actief (optie)']) ||
        parseStrictDateToIso(fields['Stop actief optie']) ||
        parseStrictDateToIso(fields['Stop actief datum']) ||
        parseStrictDateToIso(fields['Stop actief']) ||
        '',
    };

    if (typeof abonnementId === 'number') {
      const current = artikelregelsByAbonnementId.get(abonnementId) || [];
      current.push(artikelregel);
      artikelregelsByAbonnementId.set(abonnementId, current);
    }
    if (abonnementKey) {
      const currentByKey = artikelregelsByAbonnementKey.get(abonnementKey) || [];
      currentByKey.push(artikelregel);
      artikelregelsByAbonnementKey.set(abonnementKey, currentByKey);
    }
  }

  return abonnementenRecords
    .flatMap((record) => {
      const fields = record.fields ?? {};
      const relatieValue = fields[abonnementRelatieField] ?? fields.Relatie ?? fields['Relatie - 01'];
      const relatieId = extractLinkedRecordId(relatieValue);
      const relatieNaamUitLink = extractComparableText(relatieValue) || asString(relatieValue).trim();
      const relatie =
        (typeof relatieId === 'number' ? relatieById.get(relatieId) : null) ||
        (relatieNaamUitLink ? relatieByNaam.get(normalizeCompare(relatieNaamUitLink)) : null) ||
        null;
      const statusAbonnement =
        extractComparableText(fields[statusAbonnementField]) ||
        asString(fields['Status abonnement']).trim() ||
        asString(fields.Status).trim();

      const startAbonnement =
        parseStrictDateToIso(fields[startAbonnementField]) || parseStrictDateToIso(fields['Start abonnement']);
      const stopAbonnement =
        parseStrictDateToIso(fields[stopAbonnementField]) || parseStrictDateToIso(fields['Stop abonnement']);
      const abonnementLabel =
        extractComparableText(fields[abonnementField]) ||
        asString(fields.Abonnement).trim() ||
        '';
      const artikelnummerVerdichtValue =
        fields[abonnementArtikelnummerField] ??
        fields.Artikelnummer ??
        fields['Artikel nummer'] ??
        fields.Artikel;
      const artikelnummerVerdichtLinkId = extractLinkedRecordId(artikelnummerVerdichtValue);
      const artikelnummerVerdichtRaw =
        extractComparableText(artikelnummerVerdichtValue) ||
        asString(artikelnummerVerdichtValue).trim() ||
        '';
      const artikelnummerVerdichtKey = normalizeCompare(artikelnummerVerdichtRaw);
      const abonnementBevatProforma = containsNormalizedText(fields[abonnementField] ?? fields.Abonnement, 'proforma');
      const artikelregels =
        artikelregelsByAbonnementId.get(record.id) ||
        artikelregelsByAbonnementKey.get(normalizeCompare(abonnementLabel)) ||
        [];

      const poGeldigTmIso = parseStrictDateToIso(fields[poGeldigTmField]) || parseStrictDateToIso(fields['PO geldig t/m']);
      const factuurContactpersoonExtra =
        resolveContactpersoonNaam(relatie?.factuurContactpersoonExtra) ||
        resolveContactpersoonNaam(fields[abonnementFactuurContactpersoonExtraField]) ||
        resolveContactpersoonNaam(fields['Factuur contactpersoon extra']) ||
        resolveContactpersoonNaam(fields['Factuurcontactpersoon extra']) ||
        relatie?.factuurContactpersoonExtra ||
        '';
      const status: VerkoopfactuurAbonnementItem['status'] = 'Niet factureren';
      const tellingJan = extractComparableNumber(fields[tellingJanField] ?? fields['Telling jan'] ?? fields['Telling januari'], 0);
      const tellingFeb = extractComparableNumber(
        fields[tellingFebField] ?? fields['Tellegin feb'] ?? fields['Telling fed'] ?? fields['Telling feb'] ?? fields['Telling februari'],
        0
      );
      const tellingMrt = extractComparableNumber(fields[tellingMrtField] ?? fields['Telling mrt'] ?? fields['Telling maart'], 0);
      const tellingApr = extractComparableNumber(fields[tellingAprField] ?? fields['Telling apr'] ?? fields['Telling april'], 0);
      const tellingMei = extractComparableNumber(fields[tellingMeiField] ?? fields['Telling mei'], 0);
      const tellingJun = extractComparableNumber(fields[tellingJunField] ?? fields['Telling jun'] ?? fields['Telling juni'], 0);
      const tellingJul = extractComparableNumber(fields[tellingJulField] ?? fields['Telling jul'] ?? fields['Telling juli'], 0);
      const tellingAug = extractComparableNumber(fields[tellingAugField] ?? fields['Telling aug'] ?? fields['Telling augustus'], 0);
      const tellingSep = extractComparableNumber(fields[tellingSepField] ?? fields['Telling sep'] ?? fields['Telling september'], 0);
      const tellingOkt = extractComparableNumber(fields[tellingOktField] ?? fields['Telling okt'] ?? fields['Telling oktober'], 0);
      const tellingNov = extractComparableNumber(fields[tellingNovField] ?? fields['Telling nov'] ?? fields['Telling november'], 0);
      const tellingDec = extractComparableNumber(fields[tellingDecField] ?? fields['Telling dec'] ?? fields['Telling december'], 0);
      const tellingPerMaand = [tellingJan, tellingFeb, tellingMrt, tellingApr, tellingMei, tellingJun, tellingJul, tellingAug, tellingSep, tellingOkt, tellingNov, tellingDec];
      const tellingPerCode = {
        jan: tellingJan,
        feb: tellingFeb,
        mrt: tellingMrt,
        apr: tellingApr,
        mei: tellingMei,
        jun: tellingJun,
        jul: tellingJul,
        aug: tellingAug,
        sep: tellingSep,
        okt: tellingOkt,
        nov: tellingNov,
        dec: tellingDec,
      };

      return [
        {
          id: record.id,
          relatie: relatie?.naam || relatieNaamUitLink || `Relatie ${relatieId ?? record.id}`,
          factuurContactpersoonExtra,
          relatieType: relatie?.type || '',
          debiteurennummerExact: relatie?.debiteurennummerExact || '',
          onderdeel:
            extractComparableText(fields[onderdeelField]) ||
            asString(fields.Onderdeel).trim() ||
            '',
          statusInfo:
            extractComparableText(fields[statusInfoField]) ||
            asString(fields['Status info']).trim() ||
            asString(fields.Statusinfo).trim() ||
            asString(fields['Statusinformatie']).trim() ||
            '',
          abonnement: abonnementLabel,
          abonnementBevatProforma,
          startAbonnement: startAbonnement ? formatIsoDateToDdMmYyyy(startAbonnement) : '',
          stopAbonnement: stopAbonnement ? formatIsoDateToDdMmYyyy(stopAbonnement) : '',
          statusAbonnement: statusAbonnement,
          poActie:
            extractComparableText(fields[poActieField]) ||
            asString(fields['PO actie']).trim() ||
            asString(fields['PO-actie']).trim() ||
            '',
          poNummer:
            extractComparableText(fields[poNummerField]) ||
            asString(fields['PO nummer']).trim() ||
            asString(fields['PO-nummer']).trim() ||
            '',
          aparteFactuur:
            extractComparableText(fields[aparteFactuurField]) ||
            asString(fields['Aparte factuur']).trim() ||
            '',
          poGeldigTm: poGeldigTmIso ? formatIsoDateToDdMmYyyy(poGeldigTmIso) : '',
          factuurPeriode:
            extractComparableText(fields[factuurPeriodeField]) ||
            asString(fields['Factuur periode']).trim() ||
            '',
          artikelenVerdichtenTot1Factuurregel: asBoolean(
            fields[artikelenVerdichtenTot1FactuurregelField] ??
              fields['Artikelen verdichten tot 1 factuurregel'] ??
              fields['Artikelen verdichten'] ??
              fields['Verdichten tot 1 factuurregel']
          ),
          factuurtekst:
            extractComparableText(fields[factuurtekstField]) ||
            asString(fields.Factuurtekst).trim() ||
            asString(fields['Factuur tekst']).trim() ||
            '',
          artikelnummerVerdichtExact:
            (typeof artikelnummerVerdichtLinkId === 'number'
              ? artikelnummerExactByArtikelId.get(artikelnummerVerdichtLinkId) || ''
              : '') ||
            (artikelnummerVerdichtKey ? artikelnummerExactByArtikelKey.get(artikelnummerVerdichtKey) || '' : '') ||
            extractComparableText(fields['Artikelnummer Exact']) ||
            asString(fields['Artikelnummer Exact']).trim() ||
            artikelnummerVerdichtRaw ||
            '',
          tellingPerMaand,
          tellingPerCode,
          laatsteFactuurdatum: (() => {
            const iso =
              parseStrictDateToIso(fields[laatsteFactuurdatumField]) || parseStrictDateToIso(fields['Laatste factuurdatum']);
            return iso ? formatIsoDateToDdMmYyyy(iso) : '';
          })(),
          laatsteFactuurperiode:
            extractComparableText(fields[laatsteFactuurperiodeField]) ||
            asString(fields['Laatste factuurperiode']).trim() ||
            '',
          facturenInDeMaand:
            resolveChoiceCaptionListValue(
              abonnementenFields,
              facturenInDeMaandField,
              fields[facturenInDeMaandField] ?? fields['Facturen in de maand']
            ) || '',
          status,
          artikelregels,
        } satisfies VerkoopfactuurAbonnementItem,
      ];
    })
    .sort((a, b) => {
      const relatieCompare = a.relatie.localeCompare(b.relatie, 'nl', { sensitivity: 'base', numeric: true });
      if (relatieCompare !== 0) {
        return relatieCompare;
      }
      return a.onderdeel.localeCompare(b.onderdeel, 'nl', { sensitivity: 'base', numeric: true });
    });
}

export async function updateNinoxVerkoopfactuurAbonnementFactuurStatus(
  abonnementIds: number[],
  laatsteFactuurdatum: string,
  laatsteFactuurperiode: string,
  factuurRecords: VerkoopfactuurAbonnementFactuurRecordInput[] = [],
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const [tableId, abonnementFacturenTableId] = await Promise.all([
    fetchTableIdByName('Abonnementen'),
    fetchTableIdByName('Abonnementen - Facturen'),
  ]);
  if (!tableId) {
    throw new Error('Tabel Abonnementen niet gevonden.');
  }
  if (!abonnementFacturenTableId) {
    throw new Error('Tabel Abonnementen - Facturen niet gevonden.');
  }

  const [tableFields, abonnementFacturenFields] = await Promise.all([
    fetchNinoxTableFields(tableId).catch(() => []),
    fetchNinoxTableFields(abonnementFacturenTableId).catch(() => []),
  ]);
  const laatsteFactuurdatumField =
    findFieldName(tableFields, ['Laatste factuurdatum', 'Laatst factuurdatum']) || 'Laatste factuurdatum';
  const laatsteFactuurperiodeField =
    findFieldName(tableFields, ['Laatste factuurperiode', 'Laatst factuurperiode']) || 'Laatste factuurperiode';
  const abonnementFacturenAbonnementField =
    findFieldName(abonnementFacturenFields, ['Abonnementen', 'Abonnement', 'Abonnement - 01']) || 'Abonnementen';
  const abonnementFacturenDatumField =
    findFieldName(abonnementFacturenFields, ['Factuurdatum', 'Datum']) || 'Factuurdatum';
  const abonnementFacturenPeriodeField =
    findFieldName(abonnementFacturenFields, ['Factuurperiode', 'Factuur periode', 'Periode']) || 'Factuurperiode';
  const abonnementFacturenBedragField =
    findFieldName(abonnementFacturenFields, ['Bedrag exclusief BTW', 'Bedrag excl. BTW', 'Bedrag excl BTW']) ||
    'Bedrag exclusief BTW';
  const abonnementFacturenTitelField =
    findFieldName(abonnementFacturenFields, ['Titel', 'Omschrijving', 'Titel of omschrijving']) || 'Titel';
  const total = abonnementIds.length + factuurRecords.length;
  let current = 0;

  for (const abonnementId of abonnementIds) {
    await updateNinoxRecord(tableId, abonnementId, {
      [laatsteFactuurdatumField]: laatsteFactuurdatum,
      [laatsteFactuurperiodeField]: laatsteFactuurperiode,
    });
    current += 1;
    onProgress?.(current, total);
  }

  for (const factuurRecord of factuurRecords) {
    await createNinoxRecord(abonnementFacturenTableId, {
      [abonnementFacturenAbonnementField]: factuurRecord.abonnementId,
      [abonnementFacturenDatumField]: factuurRecord.factuurdatum,
      [abonnementFacturenPeriodeField]: factuurRecord.factuurperiode,
      [abonnementFacturenBedragField]: factuurRecord.bedragExclusiefBtw,
      [abonnementFacturenTitelField]: factuurRecord.titel,
    });
    current += 1;
    onProgress?.(current, total);
  }
}

export async function deleteNinoxVerkoopfactuurAbonnementArtikelRegels(
  regelIds: number[],
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const tableId = await fetchTableIdByName('Abonnementen - Artikelen');
  if (!tableId) {
    throw new Error('Tabel Abonnementen - Artikelen niet gevonden.');
  }

  const total = regelIds.length;
  let current = 0;
  for (const regelId of regelIds) {
    await deleteNinoxRecord(tableId, regelId);
    current += 1;
    onProgress?.(current, total);
  }
}

export async function fetchNinoxPersoneel(): Promise<Personeel[]> {
  const tableId = await fetchTableIdByName('Personeel');
  if (!tableId) {
    throw new Error('Tabel Personeel niet gevonden.');
  }

  const records = await fetchTableRecords(tableId, 500);
  return records
    .map((record) => {
      const fields = record.fields ?? {};
      const naam =
        asString(fields.Naam).trim() ||
        asString(fields['Volledige naam']).trim() ||
        asString(fields['Naam medewerker']).trim() ||
        '';
      const mailZakelijk =
        asString(fields['Mail zakelijk']).trim() ||
        asString(fields['E-mail zakelijk']).trim() ||
        asString(fields['Email zakelijk']).trim() ||
        '';
      const roepnaam =
        asString(fields.Roepnaam).trim() ||
        (naam ? naam.split(/\s+/)[0].trim() : '');
      const telefoonZakelijk =
        asString(fields['Telefoon zakelijk']).trim() ||
        asString(fields['Tel zakelijk']).trim() ||
        asString(fields['Mobiel zakelijk']).trim() ||
        '';
      const startdatum =
        parseStrictDateToIso(fields['Datum in dienst']) ||
        parseStrictDateToIso(fields['In dienst']) ||
        parseStrictDateToIso(fields.Indienst) ||
        parseStrictDateToIso(fields.Startdatum) ||
        parseStrictDateToIso(fields['Start datum']) ||
        null;
      const einddatum =
        parseStrictDateToIso(fields['Datum uit dienst']) ||
        parseStrictDateToIso(fields['Uit dienst']) ||
        parseStrictDateToIso(fields.Uitdienst) ||
        parseStrictDateToIso(fields.Einddatum) ||
        parseStrictDateToIso(fields['Eind datum']) ||
        null;
      const werkurenRaw =
        extractComparableText(fields['Werkuren per week']).trim() ||
        extractComparableText(fields['Werkuren p/w']).trim() ||
        extractComparableText(fields['Uren per week']).trim() ||
        '';
      const verlofurenPerJaarRaw =
        extractComparableText(fields['Verlofuren per jaar']).trim() ||
        asString(fields['Verlofuren per jaar']).trim() ||
        '';
      const verlofurenOpgenomenRaw =
        extractComparableText(fields['Verlofuren opgenomen']).trim() ||
        asString(fields['Verlofuren opgenomen']).trim() ||
        '';
      const verlofurenResultaatRaw =
        extractComparableText(fields.Resultaat).trim() ||
        asString(fields.Resultaat).trim() ||
        '';
      const percentageWbsoRaw =
        extractComparableText(fields['Percentage WBSO']).trim() ||
        extractComparableText(fields['Percentage wbso']).trim() ||
        asString(fields['Percentage WBSO']).trim() ||
        '';
      const parseJaNee = (value: unknown): boolean => {
        if (asBoolean(value)) {
          return true;
        }
        const raw = (extractComparableText(value).trim() || asString(value).trim()).toLowerCase();
        return raw === 'ja' || raw === 'true' || raw === '1' || raw === 'yes';
      };
      const maandag = parseJaNee(fields.Maandag);
      const dinsdag = parseJaNee(fields.Dinsdag);
      const woensdag = parseJaNee(fields.Woensdag);
      const donderdag = parseJaNee(fields.Donderdag);
      const vrijdag = parseJaNee(fields.Vrijdag);
      const parsedWerkuren = werkurenRaw ? parseDutchNumber(werkurenRaw) : null;
      const parsedVerlofurenPerJaar = verlofurenPerJaarRaw ? parseDutchNumber(verlofurenPerJaarRaw) : null;
      const parsedVerlofurenOpgenomen = verlofurenOpgenomenRaw ? parseDutchNumber(verlofurenOpgenomenRaw) : null;
      const parsedVerlofurenResultaat = verlofurenResultaatRaw ? parseDutchNumber(verlofurenResultaatRaw) : null;
      const parsedPercentageWbso = percentageWbsoRaw ? parseDutchNumber(percentageWbsoRaw) : null;
      const werkurenPerWeek = parsedWerkuren === null ? werkurenRaw : formatDutchNumber(parsedWerkuren, 2);
      const verlofurenPerJaar =
        parsedVerlofurenPerJaar === null ? verlofurenPerJaarRaw : formatDutchNumber(parsedVerlofurenPerJaar, 2);
      const verlofurenOpgenomen =
        parsedVerlofurenOpgenomen === null ? verlofurenOpgenomenRaw : formatDutchNumber(parsedVerlofurenOpgenomen, 2);
      const verlofurenResultaat =
        parsedVerlofurenResultaat === null ? verlofurenResultaatRaw : formatDutchNumber(parsedVerlofurenResultaat, 2);
      const percentageWbso = parsedPercentageWbso === null ? percentageWbsoRaw : formatDutchNumber(parsedPercentageWbso, 0);

      return {
        id: Number(record.id ?? 0),
        naam,
        roepnaam,
        mailZakelijk,
        telefoonZakelijk,
        startdatum: startdatum || undefined,
        einddatum: einddatum || undefined,
        werkurenPerWeek,
        verlofurenPerJaar,
        verlofurenOpgenomen,
        verlofurenResultaat,
        percentageWbso,
        maandag,
        dinsdag,
        woensdag,
        donderdag,
        vrijdag,
      } satisfies Personeel;
    })
    .sort((a, b) => a.naam.localeCompare(b.naam, 'nl', { sensitivity: 'base', numeric: true }));
}

export async function fetchNinoxPlanRegels(): Promise<PlanRegel[]> {
  const tableId = await fetchTableIdByName('PlanRegels');
  if (!tableId) {
    throw new Error('Tabel PlanRegels niet gevonden.');
  }

  const [records, personeelIdsByPlanRegelId, tableFields] = await Promise.all([
    fetchTableRecords(tableId, 2000),
    fetchPlanRegelPersoneelIdsViaQuery().catch(() => new Map<number, number>()),
    fetchNinoxTableFields(tableId).catch(() => [] as NinoxTableField[]),
  ]);
  const titelField = 'Titel';
  const startField = 'Start datum';
  const stopField = 'Stop datum';
  const personeelField = 'Personeel';
  const kleurField = 'Kleur';
  const typeField = findFieldName(tableFields, ['Type']) || null;
  const aantalUrenField = findFieldName(tableFields, ['Aantal uren']) || null;

  return records
    .map((record) => {
      const fields = record.fields ?? {};
      const recordId = Number(record.id ?? 0);
      const personeelValue = fields[personeelField];
      const personeelIdRaw = personeelIdsByPlanRegelId.get(recordId) ?? extractLinkedRecordId(personeelValue);
      const startRaw = extractComparableText(fields[startField]).trim() || asString(fields[startField]).trim() || '';
      const stopRaw = extractComparableText(fields[stopField]).trim() || asString(fields[stopField]).trim() || '';
      return {
        id: recordId,
        titel: extractComparableText(fields[titelField]).trim() || asString(fields[titelField]).trim() || '',
        startDatumTijd: startRaw ? normalizeDateTimeToIso(startRaw) : '',
        stopDatumTijd: stopRaw ? normalizeDateTimeToIso(stopRaw) : '',
        type: resolveChoiceCaptionValue(tableFields, typeField, fields[typeField || '']) || undefined,
        aantalUren:
          aantalUrenField
            ? (() => {
                const raw =
                  extractComparableText(fields[aantalUrenField]).trim() ||
                  asString(fields[aantalUrenField]).trim() ||
                  '';
                const parsed = raw ? parseDutchNumber(raw) : null;
                return parsed === null ? raw || undefined : formatDutchNumber(parsed, 2);
              })()
            : undefined,
        kleur: normalizePlanRegelKleurValue(fields[kleurField]) || undefined,
        personeelId: typeof personeelIdRaw === 'number' && Number.isFinite(personeelIdRaw) ? personeelIdRaw : undefined,
      } satisfies PlanRegel;
    })
    .filter((item) => item.titel || item.startDatumTijd || item.stopDatumTijd)
    .sort((a, b) => a.startDatumTijd.localeCompare(b.startDatumTijd, 'nl', { sensitivity: 'base', numeric: true }));
}

async function resolvePlanRegelsFieldNames(): Promise<{
  titel: string;
  startDatumTijd: string;
  stopDatumTijd: string;
  personeelLink: string | null;
  type: string | null;
  aantalUren: string | null;
  kleur: string | null;
}> {
  const tableId = await fetchTableIdByName('PlanRegels');
  if (!tableId) {
    throw new Error('Tabel PlanRegels niet gevonden.');
  }
  const tableFields = await fetchNinoxTableFields(tableId).catch(() => []);
  return {
    titel: 'Titel',
    startDatumTijd: 'Start datum',
    stopDatumTijd: 'Stop datum',
    personeelLink: 'Personeel',
    type: findFieldName(tableFields, ['Type']) || null,
    aantalUren: findFieldName(tableFields, ['Aantal uren']) || null,
    kleur: findFieldName(tableFields, ['Kleur']) || null,
  };
}

export async function fetchNinoxPlanRegelTypeOpties(): Promise<string[]> {
  const tableId = await fetchTableIdByName('PlanRegels');
  if (!tableId) {
    throw new Error('Tabel PlanRegels niet gevonden.');
  }
  const fields = await fetchNinoxTableFields(tableId);
  const typeField = fields.find((field) => normalizeCompare(field.name) === normalizeCompare('Type'));
  if (!typeField || !Array.isArray(typeField.choices) || typeField.choices.length === 0) {
    return [];
  }
  return typeField.choices
    .map((choice) => asString(choice.caption).trim() || asString(choice.id).trim())
    .filter((value, index, all) => value.length > 0 && all.indexOf(value) === index)
    .sort((a, b) => a.localeCompare(b, 'nl', { sensitivity: 'base', numeric: true }));
}

export async function updateNinoxPlanRegel(
  id: number,
  input: {
    titel: string;
    startDatumTijd: string;
    stopDatumTijd: string;
    type?: string | null;
    aantalUren?: string;
    kleur?: string | null;
    personeelId?: number | null;
  }
): Promise<void> {
  const tableId = await fetchTableIdByName('PlanRegels');
  if (!tableId) {
    throw new Error('Tabel PlanRegels niet gevonden.');
  }

  const fieldNames = await resolvePlanRegelsFieldNames();
  const payload: Record<string, unknown> = {
    [fieldNames.titel]: String(input.titel || '').trim(),
    [fieldNames.startDatumTijd]: normalizeDateTimeToIso(String(input.startDatumTijd || '').trim()),
    [fieldNames.stopDatumTijd]: normalizeDateTimeToIso(String(input.stopDatumTijd || '').trim()),
  };

  if (fieldNames.personeelLink) {
    payload[fieldNames.personeelLink] = input.personeelId ? Number(input.personeelId) : null;
  }
  if (fieldNames.type) {
    payload[fieldNames.type] = String(input.type || '').trim();
  }
  if (fieldNames.aantalUren) {
    const parsedAantalUren = parseDutchNumber(String(input.aantalUren || '').trim());
    payload[fieldNames.aantalUren] = parsedAantalUren !== null ? parsedAantalUren : String(input.aantalUren || '').trim();
  }
  if (fieldNames.kleur) {
    payload[fieldNames.kleur] = normalizePlanRegelKleurValue(input.kleur) || null;
  }

  await updateNinoxRecord(tableId, id, payload);
}

export async function createNinoxPlanRegel(input: {
  titel: string;
  startDatumTijd: string;
  stopDatumTijd: string;
  type?: string | null;
  aantalUren?: string;
  kleur?: string | null;
  personeelId?: number | null;
}): Promise<number> {
  const tableId = await fetchTableIdByName('PlanRegels');
  if (!tableId) {
    throw new Error('Tabel PlanRegels niet gevonden.');
  }

  const fieldNames = await resolvePlanRegelsFieldNames();
  const payload: Record<string, unknown> = {
    [fieldNames.titel]: String(input.titel || '').trim(),
    [fieldNames.startDatumTijd]: normalizeDateTimeToIso(String(input.startDatumTijd || '').trim()),
    [fieldNames.stopDatumTijd]: normalizeDateTimeToIso(String(input.stopDatumTijd || '').trim()),
  };

  if (fieldNames.personeelLink) {
    payload[fieldNames.personeelLink] = input.personeelId ? Number(input.personeelId) : null;
  }
  if (fieldNames.type) {
    payload[fieldNames.type] = String(input.type || '').trim();
  }
  if (fieldNames.aantalUren) {
    const parsedAantalUren = parseDutchNumber(String(input.aantalUren || '').trim());
    payload[fieldNames.aantalUren] = parsedAantalUren !== null ? parsedAantalUren : String(input.aantalUren || '').trim();
  }
  if (fieldNames.kleur) {
    payload[fieldNames.kleur] = normalizePlanRegelKleurValue(input.kleur) || null;
  }

  return createNinoxRecord(tableId, payload);
}

export async function deleteNinoxPlanRegel(id: number): Promise<void> {
  const tableId = await fetchTableIdByName('PlanRegels');
  if (!tableId) {
    throw new Error('Tabel PlanRegels niet gevonden.');
  }
  await deleteNinoxRecord(tableId, id);
}

async function requireVerlofTableId(): Promise<string> {
  const tableId =
    (await fetchTableIdByName('Verlof')) ||
    (await fetchTableIdByName('Verlofuren')) ||
    (await fetchTableIdByName('Verlof uren'));
  if (!tableId) {
    throw new Error('Tabel Verlof niet gevonden.');
  }
  return tableId;
}

async function resolveVerlofFieldNames(tableId: string): Promise<{
  medewerkerLinkField: string;
  medewerkerTextField: string | null;
  datumField: string;
  omschrijvingField: string;
  aantalUurField: string;
}> {
  const tableFields = await fetchNinoxTableFields(tableId);
  const medewerkerLinkField = findFieldName(tableFields, ['Medewerker', 'Personeel']) || 'Medewerker';
  const medewerkerTextFieldRaw =
    findFieldName(tableFields, ['Naam medewerker', 'Medewerker naam', 'Personeelsnaam', 'Medewerker']) || null;
  const datumField = findFieldName(tableFields, ['Datum', 'Verlofdatum']) || 'Datum';
  const omschrijvingField = findFieldName(tableFields, ['Omschrijving', 'Soort verlof', 'Onderwerp', 'Titel']) || 'Omschrijving';
  const aantalUurField = findFieldName(tableFields, ['Aantal uur', 'Aantal uren', 'Uren']) || 'Aantal uur';

  return {
    medewerkerLinkField,
    medewerkerTextField: medewerkerTextFieldRaw === medewerkerLinkField ? null : medewerkerTextFieldRaw,
    datumField,
    omschrijvingField,
    aantalUurField,
  };
}

export async function fetchNinoxVerlofuren(): Promise<VerlofUur[]> {
  const tableId = await requireVerlofTableId();

  const records = await fetchTableRecords(tableId, 1000);
  return records
    .map((record) => {
      const fields = record.fields ?? {};
      const medewerkerId =
        extractComparableLinkValue(fields.Medewerker).trim() ||
        extractComparableLinkValue(fields.Personeel).trim() ||
        '';
      const medewerker =
        extractComparableText(fields['Naam medewerker']).trim() ||
        extractComparableText(fields['Medewerker naam']).trim() ||
        extractComparableText(fields.Personeelsnaam).trim() ||
        extractComparableText(fields.Medewerker).trim() ||
        extractComparableText(fields.Personeel).trim() ||
        extractComparableText(fields.Naam).trim() ||
        asString(fields['Naam medewerker']).trim() ||
        asString(fields['Medewerker naam']).trim() ||
        asString(fields.Personeelsnaam).trim() ||
        asString(fields.Medewerker).trim() ||
        asString(fields.Personeel).trim() ||
        asString(fields.Naam).trim() ||
        '';
      const datum =
        extractComparableText(fields.Datum).trim() ||
        extractComparableText(fields.Verlofdatum).trim() ||
        asString(fields.Datum).trim() ||
        asString(fields.Verlofdatum).trim() ||
        '';
      const omschrijving =
        asString(fields.Omschrijving).trim() ||
        asString(fields['Soort verlof']).trim() ||
        asString(fields.Onderwerp).trim() ||
        asString(fields.Titel).trim() ||
        '';
      const aantalUurRaw =
        extractComparableText(fields['Aantal uur']).trim() ||
        extractComparableText(fields['Aantal uren']).trim() ||
        extractComparableText(fields.Uren).trim() ||
        asString(fields['Aantal uur']).trim() ||
        asString(fields['Aantal uren']).trim() ||
        asString(fields.Uren).trim() ||
        '';
      const parsedAantalUur = aantalUurRaw ? parseDutchNumber(aantalUurRaw) : null;
      const aantalUur = parsedAantalUur === null ? aantalUurRaw : formatDutchNumber(parsedAantalUur, 2);

      return {
        id: Number(record.id ?? 0),
        medewerkerId,
        medewerker,
        datum,
        omschrijving,
        aantalUur,
      } satisfies VerlofUur;
    })
    .sort((a, b) => {
      const medewerkerCompare = a.medewerker.localeCompare(b.medewerker, 'nl', { sensitivity: 'base', numeric: true });
      if (medewerkerCompare !== 0) {
        return medewerkerCompare;
      }
      return a.datum.localeCompare(b.datum, 'nl', { sensitivity: 'base', numeric: true });
    });
}

export async function createNinoxVerlofuur(input: {
  medewerkerId: string;
  medewerkerNaam: string;
  datum: string;
  omschrijving: string;
  aantalUur: string;
}): Promise<void> {
  const tableId = await requireVerlofTableId();
  const names = await resolveVerlofFieldNames(tableId);
  const parsedAantalUur = parseDutchNumber(input.aantalUur || '');
  const payload: Record<string, unknown> = {
    [names.medewerkerLinkField]: input.medewerkerId.trim(),
    [names.datumField]: input.datum.trim() ? normalizeDateToIso(input.datum) : '',
    [names.omschrijvingField]: input.omschrijving.trim(),
    [names.aantalUurField]: parsedAantalUur !== null ? parsedAantalUur : input.aantalUur.trim(),
  };
  if (names.medewerkerTextField) {
    payload[names.medewerkerTextField] = input.medewerkerNaam.trim();
  }
  await createNinoxRecord(tableId, payload);
}

export async function deleteNinoxVerlofuur(id: number): Promise<void> {
  const tableId = await requireVerlofTableId();
  await deleteNinoxRecord(tableId, id);
}

export async function updateNinoxVerlofuur(
  id: number,
  input: {
    medewerkerId: string;
    medewerkerNaam: string;
    datum: string;
    omschrijving: string;
    aantalUur: string;
  }
): Promise<void> {
  const tableId = await requireVerlofTableId();
  const names = await resolveVerlofFieldNames(tableId);
  const parsedAantalUur = parseDutchNumber(input.aantalUur || '');
  const payload: Record<string, unknown> = {
    [names.medewerkerLinkField]: input.medewerkerId.trim(),
    [names.datumField]: input.datum.trim() ? normalizeDateToIso(input.datum) : '',
    [names.omschrijvingField]: input.omschrijving.trim(),
    [names.aantalUurField]: parsedAantalUur !== null ? parsedAantalUur : input.aantalUur.trim(),
  };
  if (names.medewerkerTextField) {
    payload[names.medewerkerTextField] = input.medewerkerNaam.trim();
  }
  await updateNinoxRecord(tableId, id, payload);
}

export async function deleteNinoxPersoneel(id: number): Promise<void> {
  const tableId = await fetchTableIdByName('Personeel');
  if (!tableId) {
    throw new Error('Tabel Personeel niet gevonden.');
  }
  await deleteNinoxRecord(tableId, id);
}

export async function updateNinoxPersoneel(
  id: number,
  input: {
    naam: string;
    mailZakelijk: string;
    telefoonZakelijk: string;
    startdatum?: string;
    einddatum?: string;
    werkurenPerWeek: string;
    verlofurenPerJaar: string;
    percentageWbso: string;
    maandag?: boolean;
    dinsdag?: boolean;
    woensdag?: boolean;
    donderdag?: boolean;
    vrijdag?: boolean
  }
): Promise<void> {
  const tableId = await fetchTableIdByName('Personeel');
  if (!tableId) {
    throw new Error('Tabel Personeel niet gevonden.');
  }

  const tableFields = await fetchNinoxTableFields(tableId);
  const naamField = findFieldName(tableFields, ['Naam', 'Volledige naam', 'Naam medewerker']) || 'Naam';
  const mailZakelijkField =
    findFieldName(tableFields, ['Mail zakelijk', 'E-mail zakelijk', 'Email zakelijk']) || 'Mail zakelijk';
  const telefoonZakelijkField =
    findFieldName(tableFields, ['Telefoon zakelijk', 'Tel zakelijk', 'Mobiel zakelijk']) || 'Telefoon zakelijk';
  const datumInDienstField =
    findFieldName(tableFields, ['Datum in dienst', 'In dienst', 'Indienst', 'Startdatum', 'Start datum']) || 'Datum in dienst';
  const datumUitDienstField =
    findFieldName(tableFields, ['Datum uit dienst', 'Uit dienst', 'Uitdienst', 'Einddatum', 'Eind datum']) || 'Datum uit dienst';
  const werkurenPerWeekField =
    findFieldName(tableFields, ['Werkuren per week', 'Werkuren p/w', 'Uren per week']) || 'Werkuren per week';
  const verlofurenPerJaarField = findFieldName(tableFields, ['Verlofuren per jaar']) || 'Verlofuren per jaar';
  const percentageWbsoField =
    findFieldName(tableFields, ['Percentage WBSO', 'Percentage wbso']) || 'Percentage WBSO';
  const maandagField = findFieldName(tableFields, ['Maandag']) || 'Maandag';
  const dinsdagField = findFieldName(tableFields, ['Dinsdag']) || 'Dinsdag';
  const woensdagField = findFieldName(tableFields, ['Woensdag']) || 'Woensdag';
  const donderdagField = findFieldName(tableFields, ['Donderdag']) || 'Donderdag';
  const vrijdagField = findFieldName(tableFields, ['Vrijdag']) || 'Vrijdag';

  const parsedWerkuren = parseDutchNumber(input.werkurenPerWeek || '');
  const parsedVerlofurenPerJaar = parseDutchNumber(input.verlofurenPerJaar || '');
  const parsedPercentageWbso = parseDutchNumber(input.percentageWbso || '');
  const werkurenValue: number | string = parsedWerkuren !== null ? parsedWerkuren : input.werkurenPerWeek.trim();
  const verlofurenPerJaarValue: number | string =
    parsedVerlofurenPerJaar !== null ? parsedVerlofurenPerJaar : input.verlofurenPerJaar.trim();
  const percentageWbsoValue: number | string = parsedPercentageWbso !== null ? parsedPercentageWbso : input.percentageWbso.trim();

  await updateNinoxRecord(tableId, id, {
    [naamField]: input.naam.trim(),
    [mailZakelijkField]: input.mailZakelijk.trim(),
    [telefoonZakelijkField]: input.telefoonZakelijk.trim(),
    [datumInDienstField]: input.startdatum?.trim() ? normalizeDateToIso(input.startdatum) : '',
    [datumUitDienstField]: input.einddatum?.trim() ? normalizeDateToIso(input.einddatum) : '',
    [werkurenPerWeekField]: werkurenValue,
    [verlofurenPerJaarField]: verlofurenPerJaarValue,
    [percentageWbsoField]: percentageWbsoValue,
    [maandagField]: input.maandag ?? false,
    [dinsdagField]: input.dinsdag ?? false,
    [woensdagField]: input.woensdag ?? false,
    [donderdagField]: input.donderdag ?? false,
    [vrijdagField]: input.vrijdag ?? false,
  });
}

export async function fetchNinoxWbsoStatusAanvragen(): Promise<WbsoStatusAanvraag[]> {
  const tableId = await fetchTableIdByName('Status');
  if (!tableId) {
    throw new Error('Tabel Status niet gevonden.');
  }

  const records = await fetchTableRecords(tableId, 500);
  return records
    .map((record) => {
      const fields = record.fields ?? {};
      const jaar = extractComparableText(fields.Jaar).trim() || asString(fields.Jaar).trim() || '';
      const status = extractComparableText(fields.Status).trim() || asString(fields.Status).trim() || '';
      const periodeVan =
        extractComparableText(fields['Periode van']).trim() ||
        extractComparableText(fields['Periode vanaf']).trim() ||
        asString(fields['Periode van']).trim() ||
        '';
      const periodeTm =
        extractComparableText(fields['Periode t/m']).trim() ||
        extractComparableText(fields['Periode tm']).trim() ||
        extractComparableText(fields['Periode tot']).trim() ||
        asString(fields['Periode t/m']).trim() ||
        '';
      const referentie =
        extractComparableText(fields.Referentie).trim() ||
        extractComparableText(fields.Kenmerk).trim() ||
        asString(fields.Referentie).trim() ||
        '';
      const percentageDekkingRaw =
        extractComparableText(fields['Percentage dekking']).trim() ||
        extractComparableText(fields['Percentage Dekking']).trim() ||
        asString(fields['Percentage dekking']).trim() ||
        '';
      const omschrijving =
        extractComparableText(fields.Omschrijving).trim() ||
        asString(fields.Omschrijving).trim() ||
        '';
      const urenToegekendRaw =
        extractComparableText(fields['Uren toegekend']).trim() ||
        extractComparableText(fields['Uren Toegekend']).trim() ||
        asString(fields['Uren toegekend']).trim() ||
        '';
      const urenGewerktRaw =
        extractComparableText(fields['Uren gewerkt']).trim() ||
        extractComparableText(fields['Uren Gewerkt']).trim() ||
        asString(fields['Uren gewerkt']).trim() ||
        '';
      const parsedPercentageDekking = percentageDekkingRaw ? parseDutchNumber(percentageDekkingRaw) : null;
      const parsedToegekend = urenToegekendRaw ? parseDutchNumber(urenToegekendRaw) : null;
      const parsedGewerkt = urenGewerktRaw ? parseDutchNumber(urenGewerktRaw) : null;
      const vervallenRaw =
        extractComparableText(fields.Vervallen).trim() ||
        extractComparableText(fields.Inactief).trim() ||
        extractComparableText(fields['Record status']).trim() ||
        '';
      const actiefRaw = extractComparableText(fields.Actief).trim();
      const isVervallen =
        normalizeCompare(status) === normalizeCompare('Vervallen') ||
        normalizeCompare(vervallenRaw) === normalizeCompare('Vervallen') ||
        normalizeCompare(vervallenRaw) === normalizeCompare('Ja') ||
        normalizeCompare(vervallenRaw) === normalizeCompare('True') ||
        normalizeCompare(actiefRaw) === normalizeCompare('Nee') ||
        normalizeCompare(actiefRaw) === normalizeCompare('False');

      if (isVervallen) {
        return null;
      }

      return {
        id: Number(record.id ?? 0),
        jaar,
        status,
        periodeVan,
        periodeTm,
        referentie,
        percentageDekking: parsedPercentageDekking === null ? percentageDekkingRaw : formatDutchNumber(parsedPercentageDekking, 0),
        omschrijving,
        urenToegekend: parsedToegekend === null ? urenToegekendRaw : formatDutchNumber(parsedToegekend, 2),
        urenGewerkt: parsedGewerkt === null ? urenGewerktRaw : formatDutchNumber(parsedGewerkt, 2),
      } satisfies WbsoStatusAanvraag;
    })
    .filter((item): item is WbsoStatusAanvraag => item !== null)
    .sort((a, b) => a.jaar.localeCompare(b.jaar, 'nl', { sensitivity: 'base', numeric: true }));
}
export async function createNinoxWbsoStatusAanvraagLeeg(): Promise<number> {
  const tableId = await fetchTableIdByName('Status');
  if (!tableId) {
    throw new Error('Tabel Status niet gevonden.');
  }

  const tableFields = await fetchNinoxTableFields(tableId);
  const payload: Record<string, unknown> = {};

  const jaarField = findFieldName(tableFields, ['Jaar']);
  const statusField = findFieldName(tableFields, ['Status']);
  const periodeVanField = findFieldName(tableFields, ['Periode van', 'Periode vanaf']);
  const periodeTmField = findFieldName(tableFields, ['Periode t/m', 'Periode tm', 'Periode tot']);
  const referentieField = findFieldName(tableFields, ['Referentie', 'Kenmerk']);
  const percentageDekkingField = findFieldName(tableFields, ['Percentage dekking', 'Percentage Dekking']);
  const omschrijvingField = findFieldName(tableFields, ['Omschrijving']);
  const urenToegekendField = findFieldName(tableFields, ['Uren toegekend', 'Uren Toegekend']);
  const urenGewerktField = findFieldName(tableFields, ['Uren gewerkt', 'Uren Gewerkt']);

  if (jaarField) payload[jaarField] = '';
  if (statusField) payload[statusField] = '';
  if (periodeVanField) payload[periodeVanField] = '';
  if (periodeTmField) payload[periodeTmField] = '';
  if (referentieField) payload[referentieField] = '';
  if (percentageDekkingField) payload[percentageDekkingField] = '';
  if (omschrijvingField) payload[omschrijvingField] = '';
  if (urenToegekendField) payload[urenToegekendField] = '';
  if (urenGewerktField) payload[urenGewerktField] = '';

  return createNinoxRecord(tableId, payload);
}

type WbsoDocumentField = 'Aanvraag' | 'Beschikking';

export async function uploadNinoxWbsoDocument(recordId: number, file: File, fieldName: WbsoDocumentField): Promise<void> {
  const tableId = await fetchTableIdByName('Status');
  if (!tableId) {
    throw new Error('Tabel Status niet gevonden.');
  }
  await uploadNinoxRecordDocument(tableId, recordId, file, fieldName);
}

export async function clearNinoxWbsoDocument(recordId: number, fieldName: WbsoDocumentField): Promise<void> {
  const tableId = await fetchTableIdByName('Status');
  if (!tableId) {
    throw new Error('Tabel Status niet gevonden.');
  }

  const listNames = await fetchRecordFileNames(tableId, recordId);
  const linkedName = await resolveLinkedFileNameForField(tableId, recordId, fieldName, listNames);

  const clearAttempts: Array<Record<string, unknown>> = [
    { [fieldName]: '' },
    { [fieldName]: null },
    { [fieldName]: [] },
  ];
  let cleared = false;
  let lastError: unknown = null;
  for (const fields of clearAttempts) {
    try {
      await updateNinoxRecord(tableId, recordId, fields);
      cleared = true;
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!cleared) {
    throw lastError instanceof Error ? lastError : new Error(`Veld "${fieldName}" leegmaken mislukt.`);
  }

  if (!linkedName) {
    return;
  }

  const deleteResponse = await request(`/tables/${tableId}/records/${recordId}/files/${encodeURIComponent(linkedName)}`, { method: 'DELETE' });
  if (!deleteResponse.ok && deleteResponse.status !== 404) {
    const errorPayload = await deleteResponse.json().catch(() => ({}));
    const message = typeof errorPayload?.message === 'string' ? errorPayload.message : 'Onbekende Ninox fout';
    throw new Error(`PDF verwijderen mislukt (${deleteResponse.status}): ${message}`);
  }
}

export async function fetchNinoxWbsoDocument(recordId: number, fieldName: WbsoDocumentField): Promise<NinoxRecordDocument | null> {
  const tableId = await fetchTableIdByName('Status');
  if (!tableId) {
    throw new Error('Tabel Status niet gevonden.');
  }

  const listResponse = await request(`/tables/${tableId}/records/${recordId}/files`);
  if (!listResponse.ok) {
    return null;
  }
  const payload = await listResponse.json().catch(() => []);
  if (!Array.isArray(payload) || payload.length === 0) {
    return null;
  }

  const names = payload
    .map((item) => asString((item as { name?: unknown })?.name).trim())
    .filter((name) => Boolean(name));
  if (names.length === 0) {
    return null;
  }

  const candidateName = await resolveLinkedFileNameForField(tableId, recordId, fieldName, names);
  if (!candidateName) {
    return null;
  }

  const response = await request(`/tables/${tableId}/records/${recordId}/files/${encodeURIComponent(candidateName)}`, {
    headers: { Accept: 'application/pdf,application/octet-stream,*/*' },
  });
  if (!response.ok) {
    return null;
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  let blob: Blob | null = null;
  if (contentType.includes('application/pdf') || contentType.includes('application/octet-stream')) {
    blob = await response.blob();
  } else {
    const wrapped = await response.json().catch(() => null);
    const wrappedBase64 =
      typeof wrapped?.bodyBase64 === 'string' ? wrapped.bodyBase64 : typeof wrapped?.base64 === 'string' ? wrapped.base64 : '';
    const wrappedContentType =
      typeof wrapped?.contentType === 'string' && wrapped.contentType.trim() ? wrapped.contentType : 'application/pdf';
    if (wrappedBase64) {
      blob = base64ToBlob(wrappedBase64, wrappedContentType);
    }
  }

  if (!blob || blob.size === 0) {
    return null;
  }

  return { naam: candidateName, blob };
}
export async function updateNinoxWbsoStatusAanvraag(
  id: number,
  input: {
    jaar: string;
    status: string;
    periodeVan: string;
    periodeTm: string;
    referentie: string;
    percentageDekking: string;
    omschrijving: string;
    urenToegekend: string;
    urenGewerkt: string;
  }
): Promise<void> {
  const tableId = await fetchTableIdByName('Status');
  if (!tableId) {
    throw new Error('Tabel Status niet gevonden.');
  }

  const tableFields = await fetchNinoxTableFields(tableId);
  const jaarField = findFieldName(tableFields, ['Jaar']) || 'Jaar';
  const statusField = findFieldName(tableFields, ['Status']) || 'Status';
  const periodeVanField = findFieldName(tableFields, ['Periode van', 'Periode vanaf']) || 'Periode van';
  const periodeTmField = findFieldName(tableFields, ['Periode t/m', 'Periode tm', 'Periode tot']) || 'Periode t/m';
  const referentieField = findFieldName(tableFields, ['Referentie', 'Kenmerk']) || 'Referentie';
  const percentageDekkingField = findFieldName(tableFields, ['Percentage dekking', 'Percentage Dekking']) || 'Percentage dekking';
  const omschrijvingField = findFieldName(tableFields, ['Omschrijving']) || 'Omschrijving';
  const urenToegekendField = findFieldName(tableFields, ['Uren toegekend', 'Uren Toegekend']) || 'Uren toegekend';
  const urenGewerktField = findFieldName(tableFields, ['Uren gewerkt', 'Uren Gewerkt']) || 'Uren gewerkt';

  const parsedPercentageDekking = parseDutchNumber(input.percentageDekking || '');
  const parsedUrenToegekend = parseDutchNumber(input.urenToegekend || '');
  const parsedUrenGewerkt = parseDutchNumber(input.urenGewerkt || '');

  await updateNinoxRecord(tableId, id, {
    [jaarField]: input.jaar.trim(),
    [statusField]: input.status.trim(),
    [periodeVanField]: input.periodeVan.trim(),
    [periodeTmField]: input.periodeTm.trim(),
    [referentieField]: input.referentie.trim(),
    [percentageDekkingField]: parsedPercentageDekking !== null ? parsedPercentageDekking : input.percentageDekking.trim(),
    [omschrijvingField]: input.omschrijving.trim(),
    [urenToegekendField]: parsedUrenToegekend !== null ? parsedUrenToegekend : input.urenToegekend.trim(),
    [urenGewerktField]: parsedUrenGewerkt !== null ? parsedUrenGewerkt : input.urenGewerkt.trim(),
  });
}

export async function vervalNinoxWbsoStatusAanvraag(id: number): Promise<void> {
  const tableId = await fetchTableIdByName('Status');
  if (!tableId) {
    throw new Error('Tabel Status niet gevonden.');
  }

  await deleteNinoxRecord(tableId, id);
}

async function resolveRelatiesFieldNames(tableId: string): Promise<{
  naam: string;
  type: string | null;
  actief: string | null;
  gestoptPer: string | null;
  adres: string;
  postcode: string;
  woonplaats: string;
  land: string;
  standaardGrootboekrekening: string | null;
  opmerkingen: string;
}> {
  const tableFields = await fetchNinoxTableFields(tableId);
  return {
    naam: findFieldName(tableFields, ['Naam relatie', 'Naam', 'Bedrijf', 'Relatie', 'Titel']) || 'Naam relatie',
    type: findFieldName(tableFields, ['Type', 'Relatie type', 'Soort']),
    actief: findFieldName(tableFields, ['Actief']),
    gestoptPer: findFieldName(tableFields, ['Gestopt per', 'Gestopt', 'Einddatum']),
    adres: findFieldName(tableFields, ['Straat + Huisnummer', 'Adres']) || 'Straat + Huisnummer',
    postcode: findFieldName(tableFields, ['Postcode']) || 'Postcode',
    woonplaats: findFieldName(tableFields, ['Woonplaats']) || 'Woonplaats',
    land: findFieldName(tableFields, ['Land']) || 'Land',
    standaardGrootboekrekening: findFieldName(tableFields, ['Standaard grootboekrekening', 'Standaard Grootboekrekening']),
    opmerkingen: findFieldName(tableFields, ['Opmerkingen', 'Opmerking', 'Memo']) || 'Opmerkingen',
  };
}

export async function fetchNinoxRelatieTypeOpties(): Promise<string[]> {
  const tableId = await fetchTableIdByName('Relaties');
  if (!tableId) {
    throw new Error('Tabel Relaties niet gevonden.');
  }
  const fields = await fetchNinoxTableFields(tableId);
  const typeField = fields.find((field) =>
    ['Type', 'Relatie type', 'Soort'].some((alias) => normalizeCompare(field.name) === normalizeCompare(alias))
  );
  if (!typeField || !Array.isArray(typeField.choices) || typeField.choices.length === 0) {
    return [];
  }
  return typeField.choices
    .map((choice) => asString(choice.caption).trim() || asString(choice.id).trim())
    .filter((value, index, all) => value.length > 0 && all.indexOf(value) === index)
    .sort((a, b) => a.localeCompare(b, 'nl', { sensitivity: 'base', numeric: true }));
}

export async function fetchNinoxRelatieActiefOpties(): Promise<string[]> {
  const tableId = await fetchTableIdByName('Relaties');
  if (!tableId) {
    throw new Error('Tabel Relaties niet gevonden.');
  }
  const fields = await fetchNinoxTableFields(tableId);
  const actiefField = fields.find((field) => normalizeCompare(field.name) === normalizeCompare('Actief'));
  if (!actiefField || !Array.isArray(actiefField.choices) || actiefField.choices.length === 0) {
    return [];
  }
  return actiefField.choices
    .map((choice) => asString(choice.caption).trim() || asString(choice.id).trim())
    .filter((value, index, all) => value.length > 0 && all.indexOf(value) === index)
    .sort((a, b) => a.localeCompare(b, 'nl', { sensitivity: 'base', numeric: true }));
}

export async function createNinoxRelatie(input: NieuweRelatieInput): Promise<void> {
  const tableId = await fetchTableIdByName('Relaties');
  if (!tableId) {
    throw new Error('Tabel Relaties niet gevonden.');
  }
  const names = await resolveRelatiesFieldNames(tableId);
  const grootboekRef = String(input.standaardGrootboekrekening || '').trim();
  const grootboekRecordId = grootboekRef ? await findGrootboekRecordIdByRef(grootboekRef) : null;
  await createNinoxRecord(tableId, {
    [names.naam]: input.naamRelatie.trim(),
    ...(names.type ? { [names.type]: String(input.type || '').trim() } : {}),
    ...(names.actief ? { [names.actief]: String(input.actief || '').trim() } : {}),
    ...(names.gestoptPer ? { [names.gestoptPer]: String(input.gestoptPer || '').trim() } : {}),
    [names.adres]: String(input.adres || '').trim(),
    [names.postcode]: String(input.postcode || '').trim(),
    [names.woonplaats]: String(input.woonplaats || '').trim(),
    [names.land]: String(input.land || '').trim(),
    ...(names.standaardGrootboekrekening
      ? {
          [names.standaardGrootboekrekening]:
            typeof grootboekRecordId === 'number' ? grootboekRecordId : String(input.standaardGrootboekrekening || '').trim(),
        }
      : {}),
    [names.opmerkingen]: String(input.opmerkingen || '').trim(),
  });
}

export async function updateNinoxRelatie(id: number, input: NieuweRelatieInput): Promise<void> {
  const tableId = await fetchTableIdByName('Relaties');
  if (!tableId) {
    throw new Error('Tabel Relaties niet gevonden.');
  }
  const names = await resolveRelatiesFieldNames(tableId);
  const grootboekRef = String(input.standaardGrootboekrekening || '').trim();
  const grootboekRecordId = grootboekRef ? await findGrootboekRecordIdByRef(grootboekRef) : null;
  await updateNinoxRecord(tableId, id, {
    [names.naam]: input.naamRelatie.trim(),
    ...(names.type ? { [names.type]: String(input.type || '').trim() } : {}),
    ...(names.actief ? { [names.actief]: String(input.actief || '').trim() } : {}),
    ...(names.gestoptPer ? { [names.gestoptPer]: String(input.gestoptPer || '').trim() } : {}),
    [names.adres]: String(input.adres || '').trim(),
    [names.postcode]: String(input.postcode || '').trim(),
    [names.woonplaats]: String(input.woonplaats || '').trim(),
    [names.land]: String(input.land || '').trim(),
    ...(names.standaardGrootboekrekening
      ? {
          [names.standaardGrootboekrekening]:
            typeof grootboekRecordId === 'number' ? grootboekRecordId : String(input.standaardGrootboekrekening || '').trim(),
        }
      : {}),
    [names.opmerkingen]: String(input.opmerkingen || '').trim(),
  });
}

export async function deleteNinoxRelatie(id: number): Promise<void> {
  const tableId = await fetchTableIdByName('Relaties');
  if (!tableId) {
    throw new Error('Tabel Relaties niet gevonden.');
  }
  await deleteNinoxRecord(tableId, id);
}

export async function createNinoxLid(input: NieuwLidInput): Promise<void> {
  await createNinoxRecord(tableIds.leden, {
    Naam: input.naam,
    Roepnaam: input.roepnaam,
    'E-mail': input.email,
    'Mobiel nummer': input.mobiel,
    'Hoogste brevet': input.brevet,
    'Lid van groep - 01': lidmaatschapToGroep(input.lidmaatschap),
    'Lid vanaf': input.startdatum,
  });
}

export async function updateNinoxLid(id: number, input: UpdateLidInput): Promise<void> {
  await updateNinoxRecord(tableIds.leden, id, {
    Naam: input.naam,
    Roepnaam: input.roepnaam,
    'E-mail': input.email,
    'Mobiel nummer': input.mobiel,
    'Hoogste brevet': input.brevet,
    'Lid van groep - 01': lidmaatschapToGroep(input.lidmaatschap),
    'Lid vanaf': input.startdatum,
  });
}

export async function deleteNinoxLid(id: number): Promise<void> {
  await deleteNinoxRecord(tableIds.leden, id);
}

export async function uploadNinoxLidDocument(
  recordId: number,
  file: File,
  fieldName: 'Inschrijfformulier' | 'Vog' | 'Document'
): Promise<void> {
  await uploadNinoxRecordDocument(tableIds.leden, recordId, file, fieldName);
}

export async function clearNinoxLidDocument(
  recordId: number,
  fieldName: 'Inschrijfformulier' | 'Vog' | 'Document'
): Promise<void> {
  const listNames = await fetchRecordFileNames(tableIds.leden, recordId);
  const linkedName = await resolveLinkedFileNameForField(tableIds.leden, recordId, fieldName, listNames);

  const clearAttempts: Array<Record<string, unknown>> = [
    { [fieldName]: '' },
    { [fieldName]: null },
    { [fieldName]: [] },
  ];
  let cleared = false;
  let lastError: unknown = null;
  for (const fields of clearAttempts) {
    try {
      await updateNinoxRecord(tableIds.leden, recordId, fields);
      cleared = true;
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!cleared) {
    throw lastError instanceof Error ? lastError : new Error(`Veld "${fieldName}" leegmaken mislukt.`);
  }

  if (!linkedName) {
    return;
  }
  const deleteResponse = await request(
    `/tables/${tableIds.leden}/records/${recordId}/files/${encodeURIComponent(linkedName)}`,
    { method: 'DELETE' }
  );
  if (!deleteResponse.ok && deleteResponse.status !== 404) {
    const errorPayload = await deleteResponse.json().catch(() => ({}));
    const message = typeof errorPayload?.message === 'string' ? errorPayload.message : 'Onbekende Ninox fout';
    throw new Error(`PDF verwijderen mislukt (${deleteResponse.status}): ${message}`);
  }
}

export async function fetchNinoxMateriaal(): Promise<Materiaal[]> {
  const records = await fetchTableRecords(tableIds.materiaal);
  return records.map(mapMateriaal).sort((a, b) => a.labelnummer.localeCompare(b.labelnummer, 'nl'));
}

export async function fetchNinoxMateriaalUitleen(): Promise<NinoxMateriaalUitleen[]> {
  const tableId = await fetchTableIdByName('Uitleen');
  if (!tableId) {
    throw new Error('Tabel Uitleen niet gevonden.');
  }
  const records = await fetchTableRecords(tableId, 1000);
  return records
    .map((record) => {
      const fields = record.fields ?? {};
      return {
        id: record.id,
        lid: extractComparableLinkValue(fields.Lid) || asString(fields.Lid),
        voorOpleiding:
          extractComparableLinkValue(fields['Voor opleiding']) ||
          extractComparableLinkValue(fields['Voor opleiding (?)']) ||
          asString(fields['Voor opleiding']) ||
          asString(fields['Voor opleiding (?)']),
        uitgeleend: asString(fields.Uitgeleend) || asString(fields['Datum uitgeleend']),
        retour: asString(fields.Retour) || asString(fields['Datum retour']),
        mailVerzonden: asString(fields['Mail verzonden']) || asString(fields.Mailverzonden),
        opmerkingen: asString(fields.Opmerkingen) || asString(fields.Opmerking) || asString(fields.Memo),
        materiaal1: extractComparableLinkValue(fields['Materiaal - 1']) || asString(fields['Materiaal - 1']),
        materiaal2: extractComparableLinkValue(fields['Materiaal - 2']) || asString(fields['Materiaal - 2']),
        materiaal3: extractComparableLinkValue(fields['Materiaal - 3']) || asString(fields['Materiaal - 3']),
        materiaal4: extractComparableLinkValue(fields['Materiaal - 4']) || asString(fields['Materiaal - 4']),
        materiaal5: extractComparableLinkValue(fields['Materiaal - 5']) || asString(fields['Materiaal - 5']),
        materiaal6: extractComparableLinkValue(fields['Materiaal - 6']) || asString(fields['Materiaal - 6']),
      } satisfies NinoxMateriaalUitleen;
    })
    .sort((a, b) => b.uitgeleend.localeCompare(a.uitgeleend, 'nl', { sensitivity: 'base', numeric: true }));
}

export async function deleteNinoxMateriaalUitleen(id: number): Promise<void> {
  const tableId = await fetchTableIdByName('Uitleen');
  if (!tableId) {
    throw new Error('Tabel Uitleen niet gevonden.');
  }
  await deleteNinoxRecord(tableId, id);
}

type SaveNinoxMateriaalUitleenInput = {
  lid: string;
  voorOpleiding: string;
  uitgeleend: string;
  retour: string;
  opmerkingen?: string;
  materiaal1: string;
  materiaal2: string;
  materiaal3: string;
  materiaal4: string;
  materiaal5: string;
  materiaal6: string;
  mailVerzonden?: string;
};

function parseLinkId(value: string): number | null {
  const raw = String(value || '').trim();
  if (!raw || !/^\d+$/.test(raw)) {
    return null;
  }
  const id = Number(raw);
  return Number.isFinite(id) ? id : null;
}

async function buildNinoxMateriaalUitleenPayload(input: SaveNinoxMateriaalUitleenInput): Promise<Record<string, unknown>> {
  const tableId = await fetchTableIdByName('Uitleen');
  if (!tableId) {
    throw new Error('Tabel Uitleen niet gevonden.');
  }
  const tableFields = await fetchNinoxTableFields(tableId);
  const findFieldNames = (candidates: string[]): string[] => {
    const wanted = candidates.map((candidate) => normalizeCompare(candidate));
    const matches = tableFields
      .filter((field) => wanted.includes(normalizeCompare(field.name)))
      .map((field) => field.name);
    return matches.filter((name, index) => matches.indexOf(name) === index);
  };
  const lidField = findFieldName(tableFields, ['Lid']) || 'Lid';
  const voorOpleidingField = findFieldName(tableFields, ['Voor opleiding', 'Voor opleiding (?)']) || 'Voor opleiding';
  const uitgeleendFields =
    findFieldNames(['Datum uitgeleend', 'Uitgeleend', 'Uitgeleend op', 'Datum uitlenen']) || ['Uitgeleend'];
  const retourFields =
    findFieldNames(['Datum retour', 'Retour', 'Retour op', 'Datum inleveren']) || ['Retour'];
  const opmerkingenField = findFieldName(tableFields, ['Opmerkingen', 'Opmerking', 'Memo']) || 'Opmerkingen';
  const materiaal1Field = findFieldName(tableFields, ['Materiaal - 1', 'Materiaal 1']) || 'Materiaal - 1';
  const materiaal2Field = findFieldName(tableFields, ['Materiaal - 2', 'Materiaal 2']) || 'Materiaal - 2';
  const materiaal3Field = findFieldName(tableFields, ['Materiaal - 3', 'Materiaal 3']) || 'Materiaal - 3';
  const materiaal4Field = findFieldName(tableFields, ['Materiaal - 4', 'Materiaal 4']) || 'Materiaal - 4';
  const materiaal5Field = findFieldName(tableFields, ['Materiaal - 5', 'Materiaal 5']) || 'Materiaal - 5';
  const materiaal6Field = findFieldName(tableFields, ['Materiaal - 6', 'Materiaal 6']) || 'Materiaal - 6';
  const mailVerzondenField =
    findFieldName(tableFields, ['Mail verzonden', 'Mailverzonden', 'Mail verzonden op', 'Maildatum']) || 'Mail verzonden';

  const lidId = parseLinkId(input.lid);
  const brevetId = parseLinkId(input.voorOpleiding);
  const materiaalId1 = parseLinkId(input.materiaal1);
  const materiaalId2 = parseLinkId(input.materiaal2);
  const materiaalId3 = parseLinkId(input.materiaal3);
  const materiaalId4 = parseLinkId(input.materiaal4);
  const materiaalId5 = parseLinkId(input.materiaal5);
  const materiaalId6 = parseLinkId(input.materiaal6);
  const toNinoxDate = (value: string): string => {
    const raw = String(value || '').trim();
    if (!raw) {
      return '';
    }
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
      return `${iso[1]}-${iso[2]}-${iso[3]}`;
    }
    const nl = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (nl) {
      return `${nl[3]}-${nl[2]}-${nl[1]}`;
    }
    return raw;
  };
  const uitgeleendValue = toNinoxDate(input.uitgeleend);
  const retourValue = toNinoxDate(input.retour);

  const payload: Record<string, unknown> = {
    [lidField]: lidId ?? String(input.lid || '').trim(),
    [voorOpleidingField]: brevetId ?? String(input.voorOpleiding || '').trim(),
    [opmerkingenField]: String(input.opmerkingen || '').trim(),
    [materiaal1Field]: materiaalId1 ?? String(input.materiaal1 || '').trim(),
    [materiaal2Field]: materiaalId2 ?? String(input.materiaal2 || '').trim(),
    [materiaal3Field]: materiaalId3 ?? String(input.materiaal3 || '').trim(),
    [materiaal4Field]: materiaalId4 ?? String(input.materiaal4 || '').trim(),
    [materiaal5Field]: materiaalId5 ?? String(input.materiaal5 || '').trim(),
    [materiaal6Field]: materiaalId6 ?? String(input.materiaal6 || '').trim(),
  };
  for (const fieldName of uitgeleendFields.length > 0 ? uitgeleendFields : ['Uitgeleend']) {
    payload[fieldName] = uitgeleendValue;
  }
  for (const fieldName of retourFields.length > 0 ? retourFields : ['Retour']) {
    payload[fieldName] = retourValue;
  }
  if (typeof input.mailVerzonden === 'string') {
    payload[mailVerzondenField] = normalizeDateTimeToIso(input.mailVerzonden.trim());
  }
  return payload;
}

export async function createNinoxMateriaalUitleen(input: SaveNinoxMateriaalUitleenInput): Promise<number> {
  const tableId = await fetchTableIdByName('Uitleen');
  if (!tableId) {
    throw new Error('Tabel Uitleen niet gevonden.');
  }
  const payload = await buildNinoxMateriaalUitleenPayload(input);
  return createNinoxRecord(tableId, payload);
}

export async function updateNinoxMateriaalUitleen(id: number, input: SaveNinoxMateriaalUitleenInput): Promise<void> {
  const tableId = await fetchTableIdByName('Uitleen');
  if (!tableId) {
    throw new Error('Tabel Uitleen niet gevonden.');
  }
  const payload = await buildNinoxMateriaalUitleenPayload(input);
  await updateNinoxRecord(tableId, id, payload);
}

export async function fetchNinoxMateriaalLocatieOpties(): Promise<string[]> {
  const fields = await fetchNinoxTableFields(tableIds.materiaal);
  const locatieField = fields.find((field) => normalizeCompare(field.name) === normalizeCompare('Locatie'));
  if (!locatieField || !Array.isArray(locatieField.choices) || locatieField.choices.length === 0) {
    return [];
  }
  return locatieField.choices
    .map((choice) => asString(choice.caption).trim() || asString(choice.id).trim())
    .filter((value, index, all) => value.length > 0 && all.indexOf(value) === index)
    .sort((a, b) => a.localeCompare(b, 'nl', { sensitivity: 'base', numeric: true }));
}

export async function fetchNinoxMateriaalTypeSerienummerOpties(): Promise<string[]> {
  const fields = await fetchNinoxTableFields(tableIds.materiaal);
  const target =
    fields.find((field) => normalizeCompare(field.name) === normalizeCompare('Type serienummer 1')) ||
    fields.find((field) => normalizeCompare(field.name) === normalizeCompare('Type serienummer 2')) ||
    fields.find((field) => normalizeCompare(field.name) === normalizeCompare('Type serienummer 3'));
  if (!target || !Array.isArray(target.choices) || target.choices.length === 0) {
    return [];
  }
  return target.choices
    .map((choice) => asString(choice.caption).trim() || asString(choice.id).trim())
    .filter((value, index, all) => value.length > 0 && all.indexOf(value) === index)
    .sort((a, b) => a.localeCompare(b, 'nl', { sensitivity: 'base', numeric: true }));
}

export async function fetchNinoxMateriaalStatusFysiekeControleOpties(): Promise<string[]> {
  const fields = await fetchNinoxTableFields(tableIds.materiaal);
  const target =
    fields.find((field) => normalizeCompare(field.name) === normalizeCompare('Status fysieke controle')) ||
    fields.find((field) => normalizeCompare(field.name) === normalizeCompare('Status laatste keuring'));
  if (!target || !Array.isArray(target.choices) || target.choices.length === 0) {
    return [];
  }
  return target.choices
    .map((choice) => asString(choice.caption).trim() || asString(choice.id).trim())
    .filter((value, index, all) => value.length > 0 && all.indexOf(value) === index)
    .sort((a, b) => a.localeCompare(b, 'nl', { sensitivity: 'base', numeric: true }));
}

export async function fetchNinoxMateriaalStatusLaatsteKeuringOpties(): Promise<string[]> {
  const fields = await fetchNinoxTableFields(tableIds.materiaal);
  const target =
    fields.find((field) => normalizeCompare(field.name) === normalizeCompare('Status laatste keuring')) ||
    fields.find((field) => normalizeCompare(field.name) === normalizeCompare('Status fysieke controle'));
  if (!target || !Array.isArray(target.choices) || target.choices.length === 0) {
    return [];
  }
  return target.choices
    .map((choice) => asString(choice.caption).trim() || asString(choice.id).trim())
    .filter((value, index, all) => value.length > 0 && all.indexOf(value) === index)
    .sort((a, b) => a.localeCompare(b, 'nl', { sensitivity: 'base', numeric: true }));
}

type SaveNinoxMateriaalInput = {
  groep: string;
  labelnummer: string;
  maat: string;
  opmerkingen: string;
  datumAanschaf: string;
  aanschafprijs: number;
  datumLaatsteOnderhoud: string;
  kostenOnderhoud: number;
  datumLaatsteFysiekeControle: string;
  statusFysiekeControle: string;
  datumLaatsteKeuring: string;
  statusLaatsteKeuring: string;
  typeSerienummer1: string;
  typeSerienummer2: string;
  typeSerienummer3: string;
  serienummer1: string;
  serienummer2: string;
  serienummer3: string;
  merk: string;
  type: string;
  locatie: string;
};

async function buildNinoxMateriaalPayload(input: SaveNinoxMateriaalInput): Promise<Record<string, unknown>> {
  const tableFields = await fetchNinoxTableFields(tableIds.materiaal);
  const groepField = findFieldName(tableFields, ['Groep']) || 'Groep';
  const labelField = findFieldName(tableFields, ['Labelnummer', 'Label nummer']) || 'Labelnummer';
  const maatField = findFieldName(tableFields, ['Maat']) || 'Maat';
  const opmerkingenField = findFieldName(tableFields, ['Opmerkingen', 'Opmerking', 'Memo']) || 'Opmerkingen';
  const datumAanschafField = findFieldName(tableFields, ['Datum aanschaf']) || 'Datum aanschaf';
  const aanschafprijsField = findFieldName(tableFields, ['Aanschafprijs', 'Aanschaf prijs']) || 'Aanschafprijs';
  const datumLaatsteOnderhoudField = findFieldName(tableFields, ['Datum laatste onderhoud']) || 'Datum laatste onderhoud';
  const kostenOnderhoudField = findFieldName(tableFields, ['Kosten onderhoud']) || 'Kosten onderhoud';
  const datumLaatsteFysiekeControleField = findFieldName(tableFields, ['Datum laatste fysieke controle']) || 'Datum laatste fysieke controle';
  const statusFysiekeControleField =
    findFieldName(tableFields, ['Status fysieke controle', 'Status laatste keuring']) || 'Status fysieke controle';
  const datumLaatsteKeuringField = findFieldName(tableFields, ['Datum laatste keuring']) || 'Datum laatste keuring';
  const statusLaatsteKeuringField =
    findFieldName(tableFields, ['Status laatste keuring', 'Status fysieke controle']) || 'Status laatste keuring';
  const typeSerienummer1Field = findFieldName(tableFields, ['Type serienummer 1', 'Type Serienummer 1']) || 'Type serienummer 1';
  const typeSerienummer2Field = findFieldName(tableFields, ['Type serienummer 2', 'Type Serienummer 2']) || 'Type serienummer 2';
  const typeSerienummer3Field = findFieldName(tableFields, ['Type serienummer 3', 'Type Serienummer 3']) || 'Type serienummer 3';
  const serienummer1Field = findFieldName(tableFields, ['Serienummer 1']) || 'Serienummer 1';
  const serienummer2Field = findFieldName(tableFields, ['Serienummer 2']) || 'Serienummer 2';
  const serienummer3Field = findFieldName(tableFields, ['Serienummer 3']) || 'Serienummer 3';
  const merkField = findFieldName(tableFields, ['Merk']) || 'Merk';
  const typeField = findFieldName(tableFields, ['Type']) || 'Type';
  const locatieField = findFieldName(tableFields, ['Locatie']) || 'Locatie';
  const groepTekstField = findFieldName(tableFields, ['Groep naam', 'Groepnaam', 'Omschrijving groep']);
  const merkTekstField = findFieldName(tableFields, ['Merknaam', 'Merk naam', 'Omschrijving merk']);
  const typeTekstField = findFieldName(tableFields, ['Typenaam', 'Type naam', 'Omschrijving type']);
  const groepRaw = String(input.groep || '').trim();
  const groepRecordId = /^\d+$/.test(groepRaw) ? Number(groepRaw) : null;
  const merkRaw = String(input.merk || '').trim();
  const merkRecordId = /^\d+$/.test(merkRaw) ? Number(merkRaw) : null;
  const typeRaw = String(input.type || '').trim();
  const typeRecordId = /^\d+$/.test(typeRaw) ? Number(typeRaw) : null;
  let groepCaption = '';
  let merkCaption = '';
  let typeCaption = '';
  if (groepRecordId) {
    const groepen = await fetchNinoxMateriaalGroepen().catch(() => []);
    groepCaption = groepen.find((g) => g.id === groepRecordId)?.omschrijving || '';
  } else {
    groepCaption = groepRaw;
  }
  if (merkRecordId) {
    const merken = await fetchNinoxMateriaalMerken().catch(() => []);
    merkCaption = merken.find((m) => m.id === merkRecordId)?.omschrijving || '';
  } else {
    merkCaption = merkRaw;
  }
  if (typeRecordId) {
    const typen = await fetchNinoxMateriaalTypen().catch(() => []);
    typeCaption = typen.find((t) => t.id === typeRecordId)?.omschrijving || '';
  } else {
    typeCaption = typeRaw;
  }

  const payload: Record<string, unknown> = {
    [groepField]: groepRecordId ?? groepRaw,
    [labelField]: input.labelnummer.trim(),
    [maatField]: input.maat.trim(),
    [opmerkingenField]: input.opmerkingen.trim(),
    [datumAanschafField]: input.datumAanschaf.trim(),
    [aanschafprijsField]: input.aanschafprijs,
    [datumLaatsteOnderhoudField]: input.datumLaatsteOnderhoud.trim(),
    [kostenOnderhoudField]: input.kostenOnderhoud,
    [datumLaatsteFysiekeControleField]: input.datumLaatsteFysiekeControle.trim(),
    [statusFysiekeControleField]: input.statusFysiekeControle.trim(),
    [datumLaatsteKeuringField]: input.datumLaatsteKeuring.trim(),
    [statusLaatsteKeuringField]: input.statusLaatsteKeuring.trim(),
    [typeSerienummer1Field]: input.typeSerienummer1.trim(),
    [typeSerienummer2Field]: input.typeSerienummer2.trim(),
    [typeSerienummer3Field]: input.typeSerienummer3.trim(),
    [serienummer1Field]: input.serienummer1.trim(),
    [serienummer2Field]: input.serienummer2.trim(),
    [serienummer3Field]: input.serienummer3.trim(),
    [merkField]: merkRecordId ?? merkRaw,
    [typeField]: typeRecordId ?? typeRaw,
    [locatieField]: input.locatie.trim(),
  };
  if (groepTekstField) {
    payload[groepTekstField] = groepCaption;
  }
  if (merkTekstField) {
    payload[merkTekstField] = merkCaption;
  }
  if (typeTekstField) {
    payload[typeTekstField] = typeCaption;
  }
  return payload;
}

export async function createNinoxMateriaal(input: SaveNinoxMateriaalInput): Promise<number> {
  const payload = await buildNinoxMateriaalPayload(input);
  return createNinoxRecord(tableIds.materiaal, payload);
}

export async function updateNinoxMateriaal(
  id: number,
  input: SaveNinoxMateriaalInput
): Promise<void> {
  const payload = await buildNinoxMateriaalPayload(input);
  await updateNinoxRecord(tableIds.materiaal, id, payload);
}

export async function deleteNinoxMateriaal(id: number): Promise<void> {
  await deleteNinoxRecord(tableIds.materiaal, id);
}

export async function uploadNinoxMateriaalDocument(recordId: number, file: File): Promise<void> {
  await uploadNinoxRecordDocument(tableIds.materiaal, recordId, file, 'Document');
}

export async function clearNinoxMateriaalDocument(recordId: number): Promise<void> {
  const listNames = await fetchRecordFileNames(tableIds.materiaal, recordId);
  const linkedName = await resolveLinkedFileNameForField(tableIds.materiaal, recordId, 'Document', listNames);

  const clearAttempts: Array<Record<string, unknown>> = [{ Document: '' }, { Document: null }, { Document: [] }];
  let cleared = false;
  let lastError: unknown = null;
  for (const fields of clearAttempts) {
    try {
      await updateNinoxRecord(tableIds.materiaal, recordId, fields);
      cleared = true;
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!cleared) {
    throw lastError instanceof Error ? lastError : new Error('Veld "Document" leegmaken mislukt.');
  }

  if (!linkedName) {
    return;
  }
  const deleteResponse = await request(`/tables/${tableIds.materiaal}/records/${recordId}/files/${encodeURIComponent(linkedName)}`, {
    method: 'DELETE',
  });
  if (!deleteResponse.ok && deleteResponse.status !== 404) {
    const errorPayload = await deleteResponse.json().catch(() => ({}));
    const message = typeof errorPayload?.message === 'string' ? errorPayload.message : 'Onbekende Ninox fout';
    throw new Error(`PDF verwijderen mislukt (${deleteResponse.status}): ${message}`);
  }
}

export async function fetchNinoxMateriaalDocument(recordId: number): Promise<NinoxRecordDocument | null> {
  const listResponse = await request(`/tables/${tableIds.materiaal}/records/${recordId}/files`);
  if (!listResponse.ok) {
    return null;
  }
  const payload = await listResponse.json().catch(() => []);
  if (!Array.isArray(payload) || payload.length === 0) {
    return null;
  }

  const names = payload
    .map((item) => asString((item as { name?: unknown })?.name).trim())
    .filter((name) => Boolean(name));
  if (names.length === 0) {
    return null;
  }

  const candidateName = await resolveLinkedFileNameForField(tableIds.materiaal, recordId, 'Document', names);
  if (!candidateName) {
    return null;
  }
  const response = await request(`/tables/${tableIds.materiaal}/records/${recordId}/files/${encodeURIComponent(candidateName)}`, {
    headers: {
      Accept: 'application/pdf,application/octet-stream,*/*',
    },
  });
  if (!response.ok) {
    return null;
  }
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  let blob: Blob | null = null;
  if (contentType.includes('application/pdf') || contentType.includes('application/octet-stream')) {
    blob = await response.blob();
  } else {
    const wrapped = await response.json().catch(() => null);
    const wrappedBase64 =
      typeof wrapped?.bodyBase64 === 'string'
        ? wrapped.bodyBase64
        : typeof wrapped?.base64 === 'string'
        ? wrapped.base64
        : '';
    const wrappedContentType =
      typeof wrapped?.contentType === 'string' && wrapped.contentType.trim()
        ? wrapped.contentType
        : 'application/pdf';
    if (wrappedBase64) {
      blob = base64ToBlob(wrappedBase64, wrappedContentType);
    }
  }
  if (!blob || blob.size === 0) {
    return null;
  }
  return {
    naam: candidateName,
    blob,
  };
}

export async function fetchNinoxMateriaalGroepen(): Promise<NinoxMateriaalGroep[]> {
  const tableId = await fetchTableIdByName('Groepen');
  if (!tableId) {
    throw new Error('Tabel Groepen niet gevonden.');
  }

  const records = await fetchTableRecords(tableId, 1000);
  return records
    .map((record) => {
      const fields = record.fields ?? {};
      return {
        id: record.id,
        omschrijving:
          asString(fields.Omschrijving).trim() ||
          asString(fields.Naam).trim() ||
          asString(fields.Titel).trim() ||
          `Groep ${record.id}`,
        aantalJarenAfschrijven: asNumber(fields['Aantal jaren afschrijven'], 0),
        kostenOnderhoudPerJaar: asNumber(fields['Kosten onderhoud per jaar'], 0),
        keuren: asIntegerNumber(fields.Keuren, 0),
      } satisfies NinoxMateriaalGroep;
    })
    .sort((a, b) => a.omschrijving.localeCompare(b.omschrijving, 'nl', { sensitivity: 'base', numeric: true }));
}

export async function fetchNinoxMateriaalGroepKeurenOpties(): Promise<string[]> {
  const tableId = await fetchTableIdByName('Groepen');
  if (!tableId) {
    throw new Error('Tabel Groepen niet gevonden.');
  }
  const fields = await fetchNinoxTableFields(tableId);
  const keurenField = fields.find((field) => normalizeCompare(field.name) === normalizeCompare('Keuren'));
  if (!keurenField || !Array.isArray(keurenField.choices) || keurenField.choices.length === 0) {
    return [];
  }
  return keurenField.choices
    .map((choice) => asString(choice.caption).trim() || asString(choice.id).trim())
    .filter((value, index, all) => value.length > 0 && all.indexOf(value) === index)
    .sort((a, b) => a.localeCompare(b, 'nl', { sensitivity: 'base', numeric: true }));
}

export async function deleteNinoxMateriaalGroep(id: number): Promise<void> {
  const tableId = await fetchTableIdByName('Groepen');
  if (!tableId) {
    throw new Error('Tabel Groepen niet gevonden.');
  }
  await deleteNinoxRecord(tableId, id);
}

export async function fetchNinoxMateriaalMerken(): Promise<NinoxMateriaalMerk[]> {
  const tableId = await fetchTableIdByName('Merken');
  if (!tableId) {
    throw new Error('Tabel Merken niet gevonden.');
  }
  const records = await fetchTableRecords(tableId, 1000);
  return records
    .map((record) => {
      const fields = record.fields ?? {};
      return {
        id: record.id,
        omschrijving:
          asString(fields.Omschrijving).trim() ||
          asString(fields.Naam).trim() ||
          asString(fields.Titel).trim() ||
          `Merk ${record.id}`,
        opmerkingen:
          asString(fields.Opmerkingen).trim() ||
          asString(fields.Opmerking).trim() ||
          asString(fields.Memo).trim() ||
          '',
      } satisfies NinoxMateriaalMerk;
    })
    .sort((a, b) => a.omschrijving.localeCompare(b.omschrijving, 'nl', { sensitivity: 'base', numeric: true }));
}

export async function createNinoxMateriaalMerk(omschrijving: string, opmerkingen = ''): Promise<void> {
  const tableId = await fetchTableIdByName('Merken');
  if (!tableId) {
    throw new Error('Tabel Merken niet gevonden.');
  }
  const tableFields = await fetchNinoxTableFields(tableId);
  const omschrijvingField = findFieldName(tableFields, ['Omschrijving', 'Naam', 'Titel']) || 'Omschrijving';
  const opmerkingenField = findFieldName(tableFields, ['Opmerkingen', 'Opmerking', 'Memo']) || 'Opmerkingen';
  await createNinoxRecord(tableId, {
    [omschrijvingField]: omschrijving.trim(),
    [opmerkingenField]: opmerkingen.trim(),
  });
}

export async function updateNinoxMateriaalMerk(id: number, omschrijving: string, opmerkingen = ''): Promise<void> {
  const tableId = await fetchTableIdByName('Merken');
  if (!tableId) {
    throw new Error('Tabel Merken niet gevonden.');
  }
  const tableFields = await fetchNinoxTableFields(tableId);
  const omschrijvingField = findFieldName(tableFields, ['Omschrijving', 'Naam', 'Titel']) || 'Omschrijving';
  const opmerkingenField = findFieldName(tableFields, ['Opmerkingen', 'Opmerking', 'Memo']) || 'Opmerkingen';
  await updateNinoxRecord(tableId, id, {
    [omschrijvingField]: omschrijving.trim(),
    [opmerkingenField]: opmerkingen.trim(),
  });
}

export async function deleteNinoxMateriaalMerk(id: number): Promise<void> {
  const tableId = await fetchTableIdByName('Merken');
  if (!tableId) {
    throw new Error('Tabel Merken niet gevonden.');
  }
  await deleteNinoxRecord(tableId, id);
}

export async function fetchNinoxMateriaalTypen(): Promise<NinoxMateriaalType[]> {
  const tableId = await fetchTableIdByName('Typen');
  if (!tableId) {
    throw new Error('Tabel Typen niet gevonden.');
  }
  const records = await fetchTableRecords(tableId, 1000);
  return records
    .map((record) => {
      const fields = record.fields ?? {};
      return {
        id: record.id,
        omschrijving:
          asString(fields.Omschrijving).trim() ||
          asString(fields.Naam).trim() ||
          asString(fields.Titel).trim() ||
          `Type ${record.id}`,
        opmerkingen:
          asString(fields.Opmerkingen).trim() ||
          asString(fields.Opmerking).trim() ||
          asString(fields.Memo).trim() ||
          '',
      } satisfies NinoxMateriaalType;
    })
    .sort((a, b) => a.omschrijving.localeCompare(b.omschrijving, 'nl', { sensitivity: 'base', numeric: true }));
}

export async function createNinoxMateriaalType(omschrijving: string, opmerkingen = ''): Promise<void> {
  const tableId = await fetchTableIdByName('Typen');
  if (!tableId) {
    throw new Error('Tabel Typen niet gevonden.');
  }
  const tableFields = await fetchNinoxTableFields(tableId);
  const omschrijvingField = findFieldName(tableFields, ['Omschrijving', 'Naam', 'Titel']) || 'Omschrijving';
  const opmerkingenField = findFieldName(tableFields, ['Opmerkingen', 'Opmerking', 'Memo']) || 'Opmerkingen';
  await createNinoxRecord(tableId, {
    [omschrijvingField]: omschrijving.trim(),
    [opmerkingenField]: opmerkingen.trim(),
  });
}

export async function updateNinoxMateriaalType(id: number, omschrijving: string, opmerkingen = ''): Promise<void> {
  const tableId = await fetchTableIdByName('Typen');
  if (!tableId) {
    throw new Error('Tabel Typen niet gevonden.');
  }
  const tableFields = await fetchNinoxTableFields(tableId);
  const omschrijvingField = findFieldName(tableFields, ['Omschrijving', 'Naam', 'Titel']) || 'Omschrijving';
  const opmerkingenField = findFieldName(tableFields, ['Opmerkingen', 'Opmerking', 'Memo']) || 'Opmerkingen';
  await updateNinoxRecord(tableId, id, {
    [omschrijvingField]: omschrijving.trim(),
    [opmerkingenField]: opmerkingen.trim(),
  });
}

export async function deleteNinoxMateriaalType(id: number): Promise<void> {
  const tableId = await fetchTableIdByName('Typen');
  if (!tableId) {
    throw new Error('Tabel Typen niet gevonden.');
  }
  await deleteNinoxRecord(tableId, id);
}

export async function fetchNinoxMateriaalDocumentatie(): Promise<NinoxMateriaalDocumentatie[]> {
  const tableId = await fetchTableIdByName('Documentatie');
  if (!tableId) {
    throw new Error('Tabel Documentatie niet gevonden.');
  }
  const records = await fetchTableRecords(tableId, 1000);
  return records
    .map((record) => {
      const fields = record.fields ?? {};
      return {
        id: record.id,
        omschrijving:
          asString(fields.Titel).trim() ||
          asString(fields.Omschrijving).trim() ||
          asString(fields.Naam).trim() ||
          `Documentatie ${record.id}`,
        opmerkingen:
          asString(fields.Opmerkingen).trim() ||
          asString(fields.Opmerking).trim() ||
          asString(fields.Memo).trim() ||
          '',
        hasDocument: hasDocumentValue(fields.Document),
      } satisfies NinoxMateriaalDocumentatie;
    })
    .sort((a, b) => a.omschrijving.localeCompare(b.omschrijving, 'nl', { sensitivity: 'base', numeric: true }));
}

export async function createNinoxMateriaalDocumentatie(omschrijving: string, opmerkingen = ''): Promise<number> {
  const tableId = await fetchTableIdByName('Documentatie');
  if (!tableId) {
    throw new Error('Tabel Documentatie niet gevonden.');
  }
  const tableFields = await fetchNinoxTableFields(tableId);
  const omschrijvingField = findFieldName(tableFields, ['Titel', 'Omschrijving', 'Naam']) || 'Titel';
  const opmerkingenField = findFieldName(tableFields, ['Opmerkingen', 'Opmerking', 'Memo']) || 'Opmerkingen';
  return createNinoxRecord(tableId, {
    [omschrijvingField]: omschrijving.trim(),
    [opmerkingenField]: opmerkingen.trim(),
  });
}

export async function updateNinoxMateriaalDocumentatie(id: number, omschrijving: string, opmerkingen = ''): Promise<void> {
  const tableId = await fetchTableIdByName('Documentatie');
  if (!tableId) {
    throw new Error('Tabel Documentatie niet gevonden.');
  }
  const tableFields = await fetchNinoxTableFields(tableId);
  const omschrijvingField = findFieldName(tableFields, ['Titel', 'Omschrijving', 'Naam']) || 'Titel';
  const opmerkingenField = findFieldName(tableFields, ['Opmerkingen', 'Opmerking', 'Memo']) || 'Opmerkingen';
  await updateNinoxRecord(tableId, id, {
    [omschrijvingField]: omschrijving.trim(),
    [opmerkingenField]: opmerkingen.trim(),
  });
}

export async function deleteNinoxMateriaalDocumentatie(id: number): Promise<void> {
  const tableId = await fetchTableIdByName('Documentatie');
  if (!tableId) {
    throw new Error('Tabel Documentatie niet gevonden.');
  }
  await deleteNinoxRecord(tableId, id);
}

export async function uploadNinoxMateriaalDocumentatieDocument(recordId: number, file: File): Promise<void> {
  const tableId = await fetchTableIdByName('Documentatie');
  if (!tableId) {
    throw new Error('Tabel Documentatie niet gevonden.');
  }
  await uploadNinoxRecordDocument(tableId, recordId, file, 'Document');
}

export async function clearNinoxMateriaalDocumentatieDocument(recordId: number): Promise<void> {
  const tableId = await fetchTableIdByName('Documentatie');
  if (!tableId) {
    throw new Error('Tabel Documentatie niet gevonden.');
  }
  const listNames = await fetchRecordFileNames(tableId, recordId);
  const linkedName = await resolveLinkedFileNameForField(tableId, recordId, 'Document', listNames);

  const clearAttempts: Array<Record<string, unknown>> = [
    { Document: '' },
    { Document: null },
    { Document: [] },
  ];
  let cleared = false;
  let lastError: unknown = null;
  for (const fields of clearAttempts) {
    try {
      await updateNinoxRecord(tableId, recordId, fields);
      cleared = true;
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!cleared) {
    throw lastError instanceof Error ? lastError : new Error('Veld "Document" leegmaken mislukt.');
  }

  if (!linkedName) {
    return;
  }
  const deleteResponse = await request(`/tables/${tableId}/records/${recordId}/files/${encodeURIComponent(linkedName)}`, {
    method: 'DELETE',
  });
  if (!deleteResponse.ok && deleteResponse.status !== 404) {
    const errorPayload = await deleteResponse.json().catch(() => ({}));
    const message = typeof errorPayload?.message === 'string' ? errorPayload.message : 'Onbekende Ninox fout';
    throw new Error(`PDF verwijderen mislukt (${deleteResponse.status}): ${message}`);
  }
}

export async function fetchNinoxMateriaalDocumentatieDocument(recordId: number): Promise<NinoxRecordDocument | null> {
  const tableId = await fetchTableIdByName('Documentatie');
  if (!tableId) {
    throw new Error('Tabel Documentatie niet gevonden.');
  }
  const listResponse = await request(`/tables/${tableId}/records/${recordId}/files`);
  if (!listResponse.ok) {
    return null;
  }
  const payload = await listResponse.json().catch(() => []);
  if (!Array.isArray(payload) || payload.length === 0) {
    return null;
  }

  const names = payload
    .map((item) => asString((item as { name?: unknown })?.name).trim())
    .filter((name) => Boolean(name));
  if (names.length === 0) {
    return null;
  }

  const candidateName = await resolveLinkedFileNameForField(tableId, recordId, 'Document', names);
  if (!candidateName) {
    return null;
  }
  const response = await request(`/tables/${tableId}/records/${recordId}/files/${encodeURIComponent(candidateName)}`, {
    headers: {
      Accept: 'application/pdf,application/octet-stream,*/*',
    },
  });
  if (!response.ok) {
    return null;
  }
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  let blob: Blob | null = null;
  if (contentType.includes('application/pdf') || contentType.includes('application/octet-stream')) {
    blob = await response.blob();
  } else {
    const wrapped = await response.json().catch(() => null);
    const wrappedBase64 =
      typeof wrapped?.bodyBase64 === 'string'
        ? wrapped.bodyBase64
        : typeof wrapped?.base64 === 'string'
        ? wrapped.base64
        : '';
    const wrappedContentType =
      typeof wrapped?.contentType === 'string' && wrapped.contentType.trim()
        ? wrapped.contentType
        : 'application/pdf';
    if (wrappedBase64) {
      blob = base64ToBlob(wrappedBase64, wrappedContentType);
    }
  }
  if (!blob || blob.size === 0) {
    return null;
  }
  return {
    naam: candidateName,
    blob,
  };
}

export async function createNinoxMateriaalGroep(input: {
  omschrijving: string;
  aantalJarenAfschrijven: number;
  kostenOnderhoudPerJaar: number;
  keuren: number;
}): Promise<void> {
  const tableId = await fetchTableIdByName('Groepen');
  if (!tableId) {
    throw new Error('Tabel Groepen niet gevonden.');
  }
  const tableFields = await fetchNinoxTableFields(tableId);
  const omschrijvingField = findFieldName(tableFields, ['Omschrijving', 'Naam', 'Titel']) || 'Omschrijving';
  const afschrijvenField = findFieldName(tableFields, ['Aantal jaren afschrijven']) || 'Aantal jaren afschrijven';
  const onderhoudField = findFieldName(tableFields, ['Kosten onderhoud per jaar']) || 'Kosten onderhoud per jaar';
  const keurenField = findFieldName(tableFields, ['Keuren']) || 'Keuren';
  await createNinoxRecord(tableId, {
    [omschrijvingField]: input.omschrijving.trim(),
    [afschrijvenField]: Math.trunc(input.aantalJarenAfschrijven),
    [onderhoudField]: input.kostenOnderhoudPerJaar,
    [keurenField]: Math.trunc(input.keuren),
  });
}

export async function updateNinoxMateriaalGroep(
  id: number,
  input: {
    omschrijving: string;
    aantalJarenAfschrijven: number;
    kostenOnderhoudPerJaar: number;
    keuren: number;
  }
): Promise<void> {
  const tableId = await fetchTableIdByName('Groepen');
  if (!tableId) {
    throw new Error('Tabel Groepen niet gevonden.');
  }
  const tableFields = await fetchNinoxTableFields(tableId);
  const omschrijvingField = findFieldName(tableFields, ['Omschrijving', 'Naam', 'Titel']) || 'Omschrijving';
  const afschrijvenField = findFieldName(tableFields, ['Aantal jaren afschrijven']) || 'Aantal jaren afschrijven';
  const onderhoudField = findFieldName(tableFields, ['Kosten onderhoud per jaar']) || 'Kosten onderhoud per jaar';
  const keurenField = findFieldName(tableFields, ['Keuren']) || 'Keuren';
  await updateNinoxRecord(tableId, id, {
    [omschrijvingField]: input.omschrijving.trim(),
    [afschrijvenField]: Math.trunc(input.aantalJarenAfschrijven),
    [onderhoudField]: input.kostenOnderhoudPerJaar,
    [keurenField]: Math.trunc(input.keuren),
  });
}

export async function fetchNinoxGebruikers(): Promise<Gebruiker[]> {
  const tableId = await requireGebruikersTableId();
  const records = await fetchTableRecords(tableId, 200);
  const tableFields = await fetchNinoxTableFields(tableId).catch(() => []);
  const naamField = findFieldName(tableFields, ['Naam']) || 'Naam';
  const gebruikersnaamField = findFieldName(tableFields, ['Gebruikersnaam']) || 'Gebruikersnaam';
  const wachtwoordField = findFieldName(tableFields, ['Wachtwoord']) || 'Wachtwoord';
  const emailField = findFieldName(tableFields, ['E-mail', 'Email']) || 'E-mail';
  const functieField = findFieldName(tableFields, ['Functie']);
  const meldingField = findFieldName(tableFields, ['Melding']) || 'Melding';
  const beheerderField = findFieldName(tableFields, ['Beheerder']) || 'Beheerder';
  const toegangField = findFieldName(tableFields, ['Toegang']) || 'Toegang';
  const laatsteLoginField = findFieldName(tableFields, ['Laatst gebruikt', 'Laatst Gebruikt']) || 'Laatst gebruikt';
  const relatiesField = findFieldName(tableFields, ['Relaties']) || 'Relaties';
  const afsprakenEnContractenField =
    findFieldName(tableFields, ['Afspraken en Contracten', 'Afspraken & Contracten']) || 'Afspraken en Contracten';
  const verkoopkansenField = findFieldName(tableFields, ['Verkoopkansen']) || 'Verkoopkansen';
  const abonnementenField = findFieldName(tableFields, ['Abonnementen']) || 'Abonnementen';
  const koppelingenField = findFieldName(tableFields, ['Koppelingen']) || 'Koppelingen';
  const tabellenField = findFieldName(tableFields, ['Tabellen']) || 'Tabellen';
  const personeelField = findFieldName(tableFields, ['Personeel']) || 'Personeel';
  const administratieField = findFieldName(tableFields, ['Administratie']) || 'Administratie';
  const materiaalbeheerField = findFieldName(tableFields, ['Materiaalbeheer']) || 'Materiaalbeheer';
  const planningField = findFieldName(tableFields, ['Planning']) || 'Planning';
  const mailenField = findFieldName(tableFields, ['Mailen']) || 'Mailen';
  const googleAgendaField = findFieldName(tableFields, ['Google Agenda', 'Google agenda']) || 'Google Agenda';
  const googleDriveField = findFieldName(tableFields, ['Google Drive', 'Google drive']) || 'Google Drive';

  return records.map((record) => {
    const fields = record.fields ?? {};
    const modifiedAt = asString(record.modifiedAt).slice(0, 10);

    return {
      id: Number(record.id ?? 0),
      naam: asString(fields[naamField]) || asString(fields[gebruikersnaamField], `Gebruiker ${record.id}`),
      gebruikersnaam: asString(fields[gebruikersnaamField]) || asString(fields[naamField], `gebruiker-${record.id}`).toLowerCase(),
      wachtwoord: asString(fields[wachtwoordField]),
      email: asString(fields[emailField]) || asString(fields['E-mail']) || asString(fields.Email),
      functie: functieField ? asString(fields[functieField]) : '',
      melding: asString(fields[meldingField]),
      beheerder: asBoolean(fields[beheerderField]),
      toegang: asBoolean(fields[toegangField]),
      rol: asRole(fields),
      laatsteLogin: asString(fields[laatsteLoginField]) || modifiedAt || todayIsoDate(),
      actief: asBoolean(fields[toegangField]),
      relaties: asBoolean(fields[relatiesField]),
      afsprakenEnContracten: asBoolean(fields[afsprakenEnContractenField]),
      verkoopkansen: asBoolean(fields[verkoopkansenField]),
      abonnementen: asBoolean(fields[abonnementenField]),
      koppelingen: asBoolean(fields[koppelingenField]),
      tabellen: asBoolean(fields[tabellenField]),
      personeel: asBoolean(fields[personeelField]),
      administratie: asBoolean(fields[administratieField]),
      materiaalbeheer: asBoolean(fields[materiaalbeheerField]),
      planning: asBoolean(fields[planningField]),
      mailen: asBoolean(fields[mailenField]),
      googleAgenda: asBoolean(fields[googleAgendaField]),
      googleDrive: asBoolean(fields[googleDriveField]),
    } satisfies Gebruiker;
  });
}

export async function createNinoxGebruiker(input: NieuweGebruikerInput): Promise<void> {
  const tableId = await requireGebruikersTableId();
  const tableFields = await fetchNinoxTableFields(tableId).catch(() => []);
  const naamField = findFieldName(tableFields, ['Naam']) || 'Naam';
  const gebruikersnaamField = findFieldName(tableFields, ['Gebruikersnaam']) || 'Gebruikersnaam';
  const wachtwoordField = findFieldName(tableFields, ['Wachtwoord']) || 'Wachtwoord';
  const emailField = findFieldName(tableFields, ['E-mail', 'Email']) || 'E-mail';
  const functieField = findFieldName(tableFields, ['Functie']);
  const beheerderField = findFieldName(tableFields, ['Beheerder']) || 'Beheerder';
  const toegangField = findFieldName(tableFields, ['Toegang']) || 'Toegang';
  const meldingField = findFieldName(tableFields, ['Melding']);
  const relatiesField = findFieldName(tableFields, ['Relaties']);
  const afsprakenEnContractenField = findFieldName(tableFields, ['Afspraken en Contracten', 'Afspraken & Contracten']);
  const verkoopkansenField = findFieldName(tableFields, ['Verkoopkansen']);
  const abonnementenField = findFieldName(tableFields, ['Abonnementen']);
  const koppelingenField = findFieldName(tableFields, ['Koppelingen']);
  const tabellenField = findFieldName(tableFields, ['Tabellen']);
  const planningField = findFieldName(tableFields, ['Planning']);
  const mailenField = findFieldName(tableFields, ['Mailen']);
  const personeelField = findFieldName(tableFields, ['Personeel']);
  const administratieField = findFieldName(tableFields, ['Administratie']);

  const fields: Record<string, unknown> = {
    [naamField]: input.naam,
    [gebruikersnaamField]: input.gebruikersnaam,
    [wachtwoordField]: input.wachtwoord,
    [emailField]: input.email,
    [beheerderField]: resolveNinoxJaNeeValue(tableFields, beheerderField, input.beheerder),
    [toegangField]: resolveNinoxJaNeeValue(tableFields, toegangField, input.toegang),
  };

  if (functieField) fields[functieField] = input.functie ?? '';
  if (meldingField) fields[meldingField] = input.melding;
  if (relatiesField) fields[relatiesField] = resolveNinoxJaNeeValue(tableFields, relatiesField, input.relaties ?? false);
  if (afsprakenEnContractenField) {
    fields[afsprakenEnContractenField] = resolveNinoxJaNeeValue(
      tableFields,
      afsprakenEnContractenField,
      input.afsprakenEnContracten ?? false
    );
  }
  if (verkoopkansenField) fields[verkoopkansenField] = resolveNinoxJaNeeValue(tableFields, verkoopkansenField, input.verkoopkansen ?? false);
  if (abonnementenField) fields[abonnementenField] = resolveNinoxJaNeeValue(tableFields, abonnementenField, input.abonnementen ?? false);
  if (koppelingenField) fields[koppelingenField] = resolveNinoxJaNeeValue(tableFields, koppelingenField, input.koppelingen ?? false);
  if (tabellenField) fields[tabellenField] = resolveNinoxJaNeeValue(tableFields, tabellenField, input.tabellen ?? false);
  if (planningField) fields[planningField] = resolveNinoxJaNeeValue(tableFields, planningField, input.planning ?? false);
  if (mailenField) fields[mailenField] = resolveNinoxJaNeeValue(tableFields, mailenField, input.mailen ?? false);
  if (personeelField) fields[personeelField] = resolveNinoxJaNeeValue(tableFields, personeelField, input.personeel ?? false);
  if (administratieField) fields[administratieField] = resolveNinoxJaNeeValue(tableFields, administratieField, input.administratie ?? false);

  await createNinoxRecord(tableId, fields);
}

export async function fetchNinoxStandaardDocumenten(): Promise<StandaardDocument[]> {
  const tableId = await fetchTableIdByName('Standaard documenten');
  if (!tableId) {
    throw new Error('Tabel Standaard documenten niet gevonden.');
  }

  const [records, tableFields] = await Promise.all([fetchTableRecords(tableId, 1000), fetchNinoxTableFields(tableId)]);
  const titelField = findFieldName(tableFields, ['Titel', 'Naam', 'Omschrijving']) || 'Titel';

  return records
    .map((record) => {
      const fields = record.fields ?? {};
      return {
        id: Number(record.id ?? 0),
        titel: asString(fields[titelField]).trim() || `Standaard document ${record.id}`,
      } satisfies StandaardDocument;
    })
    .sort((a, b) => a.titel.localeCompare(b.titel, 'nl', { sensitivity: 'base', numeric: true }));
}

async function requireStandaardDocumentenTableId(): Promise<string> {
  const tableId = await fetchTableIdByName('Standaard documenten');
  if (!tableId) {
    throw new Error('Tabel Standaard documenten niet gevonden.');
  }
  return tableId;
}

async function resolveStandaardDocumentTitelField(tableId: string): Promise<string> {
  const tableFields = await fetchNinoxTableFields(tableId).catch(() => []);
  return findFieldName(tableFields, ['Titel', 'Naam', 'Omschrijving']) || 'Titel';
}

export async function createNinoxStandaardDocument(input: { titel: string }): Promise<number> {
  const tableId = await requireStandaardDocumentenTableId();
  const titelField = await resolveStandaardDocumentTitelField(tableId);
  return createNinoxRecord(tableId, {
    [titelField]: input.titel.trim(),
  });
}

export async function updateNinoxStandaardDocument(id: number, input: { titel: string }): Promise<void> {
  const tableId = await requireStandaardDocumentenTableId();
  const titelField = await resolveStandaardDocumentTitelField(tableId);
  await updateNinoxRecord(tableId, id, {
    [titelField]: input.titel.trim(),
  });
}

export async function uploadNinoxStandaardDocumentBestand(recordId: number, file: File): Promise<void> {
  const tableId = await requireStandaardDocumentenTableId();
  await uploadNinoxRecordDocument(tableId, recordId, file, 'Document');
}

export async function clearNinoxStandaardDocumentBestand(recordId: number): Promise<void> {
  const tableId = await requireStandaardDocumentenTableId();
  const listNames = await fetchRecordFileNames(tableId, recordId);
  const linkedName = await resolveLinkedFileNameForField(tableId, recordId, 'Document', listNames);

  const clearAttempts: Array<Record<string, unknown>> = [{ Document: '' }, { Document: null }, { Document: [] }];
  let cleared = false;
  let lastError: unknown = null;
  for (const fields of clearAttempts) {
    try {
      await updateNinoxRecord(tableId, recordId, fields);
      cleared = true;
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!cleared) {
    throw lastError instanceof Error ? lastError : new Error('Veld "Document" leegmaken mislukt.');
  }

  if (!linkedName) {
    return;
  }

  const deleteResponse = await request(`/tables/${tableId}/records/${recordId}/files/${encodeURIComponent(linkedName)}`, {
    method: 'DELETE',
  });
  if (!deleteResponse.ok && deleteResponse.status !== 404) {
    const errorPayload = await deleteResponse.json().catch(() => ({}));
    const message = typeof errorPayload?.message === 'string' ? errorPayload.message : 'Onbekende Ninox fout';
    throw new Error(`PDF verwijderen mislukt (${deleteResponse.status}): ${message}`);
  }
}

export async function fetchNinoxStandaardDocumentBestand(recordId: number): Promise<NinoxRecordDocument | null> {
  const tableId = await requireStandaardDocumentenTableId();
  const listResponse = await request(`/tables/${tableId}/records/${recordId}/files`);
  if (!listResponse.ok) {
    return null;
  }
  const payload = await listResponse.json().catch(() => []);
  if (!Array.isArray(payload) || payload.length === 0) {
    return null;
  }

  const fileNames = payload
    .map((item) => asString((item as { name?: unknown })?.name).trim())
    .filter((name) => Boolean(name));
  if (fileNames.length === 0) {
    return null;
  }

  const candidateName = await resolveLinkedFileNameForField(tableId, recordId, 'Document', fileNames);
  if (!candidateName) {
    return null;
  }

  const response = await request(`/tables/${tableId}/records/${recordId}/files/${encodeURIComponent(candidateName)}`, {
    headers: {
      Accept: 'application/pdf,application/octet-stream,*/*',
    },
  });
  if (!response.ok) {
    return null;
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  let blob: Blob | null = null;
  if (contentType.includes('application/pdf') || contentType.includes('application/octet-stream')) {
    blob = await response.blob();
  } else {
    const wrapped = await response.json().catch(() => null);
    const wrappedBase64 =
      typeof wrapped?.bodyBase64 === 'string'
        ? wrapped.bodyBase64
        : typeof wrapped?.base64 === 'string'
        ? wrapped.base64
        : '';
    const wrappedContentType =
      typeof wrapped?.contentType === 'string' && wrapped.contentType.trim() ? wrapped.contentType : 'application/pdf';
    blob = wrappedBase64 ? base64ToBlob(wrappedBase64, wrappedContentType) : null;
  }

  if (!blob || blob.size === 0) {
    return null;
  }

  return { naam: candidateName, blob };
}

export async function deleteNinoxStandaardDocument(id: number): Promise<void> {
  const tableId = await requireStandaardDocumentenTableId();
  await deleteNinoxRecord(tableId, id);
}

export async function updateNinoxGebruiker(id: number, input: UpdateGebruikerInput): Promise<void> {
  const tableId = await requireGebruikersTableId();
  const tableFields = await fetchNinoxTableFields(tableId).catch(() => []);
  const naamField = findFieldName(tableFields, ['Naam']) || 'Naam';
  const gebruikersnaamField = findFieldName(tableFields, ['Gebruikersnaam']) || 'Gebruikersnaam';
  const wachtwoordField = findFieldName(tableFields, ['Wachtwoord']) || 'Wachtwoord';
  const emailField = findFieldName(tableFields, ['E-mail', 'Email']) || 'E-mail';
  const functieField = findFieldName(tableFields, ['Functie']);
  const beheerderField = findFieldName(tableFields, ['Beheerder']) || 'Beheerder';
  const toegangField = findFieldName(tableFields, ['Toegang']) || 'Toegang';
  const meldingField = findFieldName(tableFields, ['Melding']);
  const relatiesField = findFieldName(tableFields, ['Relaties']);
  const afsprakenEnContractenField = findFieldName(tableFields, ['Afspraken en Contracten', 'Afspraken & Contracten']);
  const verkoopkansenField = findFieldName(tableFields, ['Verkoopkansen']);
  const abonnementenField = findFieldName(tableFields, ['Abonnementen']);
  const koppelingenField = findFieldName(tableFields, ['Koppelingen']);
  const tabellenField = findFieldName(tableFields, ['Tabellen']);
  const planningField = findFieldName(tableFields, ['Planning']);
  const mailenField = findFieldName(tableFields, ['Mailen']);
  const personeelField = findFieldName(tableFields, ['Personeel']);
  const administratieField = findFieldName(tableFields, ['Administratie']);
  const fields: Record<string, unknown> = {
    [naamField]: input.naam,
    [gebruikersnaamField]: input.gebruikersnaam,
    [emailField]: input.email,
    [beheerderField]: resolveNinoxJaNeeValue(tableFields, beheerderField, input.beheerder),
    [toegangField]: resolveNinoxJaNeeValue(tableFields, toegangField, input.toegang),
  };

  if (functieField) fields[functieField] = input.functie ?? '';
  if (meldingField) fields[meldingField] = input.melding;
  if (relatiesField) fields[relatiesField] = resolveNinoxJaNeeValue(tableFields, relatiesField, input.relaties ?? false);
  if (afsprakenEnContractenField) {
    fields[afsprakenEnContractenField] = resolveNinoxJaNeeValue(
      tableFields,
      afsprakenEnContractenField,
      input.afsprakenEnContracten ?? false
    );
  }
  if (verkoopkansenField) fields[verkoopkansenField] = resolveNinoxJaNeeValue(tableFields, verkoopkansenField, input.verkoopkansen ?? false);
  if (abonnementenField) fields[abonnementenField] = resolveNinoxJaNeeValue(tableFields, abonnementenField, input.abonnementen ?? false);
  if (koppelingenField) fields[koppelingenField] = resolveNinoxJaNeeValue(tableFields, koppelingenField, input.koppelingen ?? false);
  if (tabellenField) fields[tabellenField] = resolveNinoxJaNeeValue(tableFields, tabellenField, input.tabellen ?? false);
  if (planningField) fields[planningField] = resolveNinoxJaNeeValue(tableFields, planningField, input.planning ?? false);
  if (mailenField) fields[mailenField] = resolveNinoxJaNeeValue(tableFields, mailenField, input.mailen ?? false);
  if (personeelField) fields[personeelField] = resolveNinoxJaNeeValue(tableFields, personeelField, input.personeel ?? false);
  if (administratieField) fields[administratieField] = resolveNinoxJaNeeValue(tableFields, administratieField, input.administratie ?? false);

  if (input.wachtwoord && input.wachtwoord.trim()) {
    fields[wachtwoordField] = input.wachtwoord.trim();
  }

  await updateNinoxRecord(tableId, id, fields);
}

export async function deleteNinoxGebruiker(id: number): Promise<void> {
  const tableId = await requireGebruikersTableId();
  await deleteNinoxRecord(tableId, id);
}

export async function fetchNinoxToezichtdiensten(): Promise<ToezichtDienst[]> {
  const records = await fetchTableRecords(tableIds.leden);
  const lidById = new Map<number, Lid>(records.map((record) => [record.id, mapLid(record)]));

  const byDate = new Map<string, { zwemmend: Set<number>; kant: Set<number> }>();
  const slots = [1, 2, 3, 4];

  for (const record of records) {
    const fields = record.fields ?? {};

    for (const slot of slots) {
      const suffix = `0${slot}`;
      const datum = asString(fields[`Gepland-${suffix}`]);
      const status = asString(fields[`Status-${suffix}`]);
      if (!datum || !status || status === 'Geen') {
        continue;
      }

      if (!byDate.has(datum)) {
        byDate.set(datum, { zwemmend: new Set<number>(), kant: new Set<number>() });
      }

      const bucket = byDate.get(datum);
      if (!bucket) {
        continue;
      }

      if (status.includes('(1+2)')) {
        bucket.zwemmend.add(record.id);
        bucket.kant.add(record.id);
      } else if (status.toLowerCase().includes('kant')) {
        bucket.kant.add(record.id);
      } else {
        bucket.zwemmend.add(record.id);
      }
    }
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([datum, bucket], index) => {
      const zwemmend = Array.from(bucket.zwemmend)
        .map((id) => lidById.get(id))
        .filter((lid): lid is Lid => Boolean(lid));
      const kant = Array.from(bucket.kant)
        .map((id) => lidById.get(id))
        .filter((lid): lid is Lid => Boolean(lid));

      let status: ToezichtDienst['status'] = 'Gepland';
      if (datum < todayIsoDate()) {
        status = 'Voltooid';
      } else if (zwemmend.length === 0 || kant.length === 0) {
        status = 'Open';
      }

      return {
        id: index + 1,
        datum,
        weeknummer: getWeekNumber(datum),
        zwemmend,
        kant,
        status,
      } satisfies ToezichtDienst;
    });
}

export async function fetchNinoxBoekhouding(): Promise<NinoxBoekhouding> {
  const [grootboekRecords, verkoopRecords, inkoopRecords] = await Promise.all([
    fetchTableRecords(tableIds.grootboek, 500),
    fetchTableRecords(tableIds.facturenVerkoop, 500),
    fetchTableRecords(tableIds.facturenInkoop, 500),
  ]);

  const grootboekrekeningen: Grootboekrekening[] = grootboekRecords.map((record) => {
    const fields = record.fields ?? {};
    const nummer = asString(fields.Nummer, String(record.id));
    const categorieRaw = asString(fields.Categorie);
    const balansRaw = extractComparableText(fields.Balans) || asString(fields.Balans);
    const categorieOpNummer = mapCategorieFromRekeningNummer(nummer);

    return {
      id: record.id,
      nummer,
      naam: asString(fields.Omschrijving, `Rekening ${record.id}`),
      categorie: categorieOpNummer || mapCategorie(categorieRaw),
      categorieBron: categorieRaw,
      balans: asString(balansRaw).trim(),
      // Bij herberekening van het rekeningschema altijd vanaf nul starten.
      saldo: 0,
    };
  });

  const verkoopFacturen: Factuur[] = verkoopRecords.map((record) => {
    const fields = record.fields ?? {};
    const bedrag = Math.abs(asNumber(fields.Totaalbedrag));
    const bedrag2 = Math.abs(asNumber(fields['Bedrag - 02']));
    const datum = asString(fields.Factuurdatum) || asString(fields.Datum) || todayIsoDate();
    const betaald = Math.abs(asNumber(fields.Betaald));
    const factuurnummerRaw = asString(fields.Factuurnummer).trim();
    const lidValue = fields.Lid ?? fields['Lid - 01'];
    const lidId = extractLinkedRecordId(lidValue) ?? undefined;
    const lidNaam = extractComparableText(lidValue) || undefined;
    const grootboek1 = extractComparableText(fields['Grootboekrekening - 01']) || asString(fields['Grootboeknummer - 01']);
    const grootboek2 = extractComparableText(fields['Grootboekrekening - 02']) || asString(fields['Grootboeknummer - 02']);
    const betaaldatum = asString(fields.Betaaldatum) || asString(fields['Datum betaald']) || '';
    const doorGemaild = asString(fields['Door gemaild']) || '';
    const datumGemaildRaw = asString(fields['Datum gemaild']) || '';
    const datumGemaild = datumGemaildRaw ? formatDateTimeDdMmYyyyHhMm(datumGemaildRaw) : '';
    const doorNaarING = asString(fields['Door naar ING']) || '';
    const datumNaarINGRaw = asString(fields['Datum naar ING']) || '';
    const datumNaarING = datumNaarINGRaw ? formatDateTimeDdMmYyyyHhMm(datumNaarINGRaw) : '';

    return {
      id: 100000 + record.id,
      bronRecordId: record.id,
      factuurnummer: factuurnummerRaw || `VER-${record.id}`,
      factuurnummerBekend: factuurnummerRaw.length > 0,
      datum,
      titel: asString(fields['Omschrijving - 01']) || asString(fields.Titel),
      lidId,
      lidNaam,
      omschrijving: asString(fields['Omschrijving - 01']) || asString(fields.Titel, 'Verkoopfactuur'),
      omschrijving2: asString(fields['Omschrijving - 02']),
      bedrag,
      bedrag2,
      grootboek: grootboek1,
      grootboek2,
      betaald,
      betaaldatum,
      doorGemaild,
      datumGemaild,
      doorNaarING,
      datumNaarING,
      status: mapFactuurStatus(datum, bedrag, betaald),
    };
  });

  const inkoopFacturen: Factuur[] = inkoopRecords.map((record) => {
    const fields = record.fields ?? {};
    const bedrag = -Math.abs(asNumber(fields.Totaalbedrag));
    const datum = asString(fields.Factuurdatum) || asString(fields.Datum) || todayIsoDate();
    const betaald = Math.abs(asNumber(fields.Betaald));
    const factuurnummerRaw = asString(fields.Factuurnummer).trim();
    const lidValue = fields.Relatie ?? fields.Lid ?? fields['Lid - 01'];
    const lidId = extractLinkedRecordId(lidValue) ?? undefined;
    const lidNaam = extractComparableText(lidValue) || undefined;
    const grootboek1 = extractComparableText(fields.Grootboekrekening) || asString(fields.Grootboeknummer);
    const betaaldatum = asString(fields.Betaaldatum) || asString(fields['Datum betaald']) || '';
    const hasDocument = hasDocumentValue(fields.Document);

    return {
      id: 200000 + record.id,
      bronRecordId: record.id,
      factuurnummer: factuurnummerRaw || `INK-${record.id}`,
      factuurnummerBekend: factuurnummerRaw.length > 0,
      datum,
      titel: asString(fields.Omschrijving) || asString(fields.Titel),
      lidId,
      lidNaam,
      omschrijving: asString(fields.Omschrijving, 'Inkoopfactuur'),
      omschrijving2: '',
      bedrag,
      bedrag2: 0,
      grootboek: grootboek1,
      grootboek2: '',
      betaald,
      betaaldatum,
      hasDocument,
      status: mapFactuurStatus(datum, bedrag, betaald),
    };
  });

  return {
    grootboekrekeningen,
    inkoopFacturen,
    verkoopFacturen,
    facturen: [...verkoopFacturen, ...inkoopFacturen].sort((a, b) => b.datum.localeCompare(a.datum)),
  };
}

function extractYearFromDateText(value: unknown): number | null {
  const fromDate = (date: Date): number | null => {
    const year = date.getFullYear();
    return Number.isFinite(year) && year >= 1900 && year <= 2500 ? year : null;
  };

  const fromNumericLike = (num: number): number | null => {
    if (!Number.isFinite(num)) {
      return null;
    }
    // Ninox date fields can be unix-like timestamps (seconds or milliseconds).
    if (Math.abs(num) >= 1_000_000_000_000) {
      return fromDate(new Date(num));
    }
    if (Math.abs(num) >= 1_000_000_000) {
      return fromDate(new Date(num * 1000));
    }
    return null;
  };

  if (typeof value === 'number') {
    const year = fromNumericLike(value);
    if (year !== null) {
      return year;
    }
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const year = extractYearFromDateText(item);
      if (year !== null) {
        return year;
      }
    }
    return null;
  }

  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    const objectCandidates = [obj.value, obj.timestamp, obj.ts, obj.date, obj.datetime, obj.text, obj.label, obj.caption];
    for (const candidate of objectCandidates) {
      const year = extractYearFromDateText(candidate);
      if (year !== null) {
        return year;
      }
    }
  }

  const raw = asString(value).trim();
  if (!raw) {
    return null;
  }
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return Number(iso[1]);
  }
  const isoDateTime = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ]\d{2}:\d{2}/);
  if (isoDateTime) {
    return Number(isoDateTime[1]);
  }
  const dutch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dutch) {
    return Number(dutch[3]);
  }
  const looseYear = raw.match(/(?:^|[^\d])(19\d{2}|20\d{2}|21\d{2})(?:[^\d]|$)/);
  if (looseYear) {
    return Number(looseYear[1]);
  }
  const rawNumeric = Number(raw);
  if (Number.isFinite(rawNumeric)) {
    return fromNumericLike(rawNumeric);
  }
  return null;
}

export async function fetchNinoxVerkoopContributieFactuurnummers(jaar: number, periode: string): Promise<Record<number, string>> {
  const result = await fetchNinoxVerkoopContributieFactuurnummersMetDebug(jaar, periode);
  return result.byLidId;
}

export interface NinoxContributieFactuurDebugSample {
  recordId: number;
  factuurnummer: string;
  factuurdatum: string;
  periode: string;
  lidRaw: string;
  lidId: number | null;
}

export interface NinoxContributieFactuurDebugInfo {
  targetJaar: number;
  targetPeriode: string;
  totaalVerkoopfacturen: number;
  matchJaar: number;
  matchPeriode: number;
  matchLid: number;
  uniekeLidHits: number;
  samples: NinoxContributieFactuurDebugSample[];
}

export async function fetchNinoxVerkoopContributieFactuurnummersMetDebug(
  jaar: number,
  periode: string
): Promise<{ byLidId: Record<number, string>; debug: NinoxContributieFactuurDebugInfo }> {
  const normalizePeriode = (value: string): string =>
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  const targetPeriode = normalizePeriode(periode);
  const [records, ledenRecords] = await Promise.all([
    fetchTableRecordsAllPages(tableIds.facturenVerkoop, 500, 200),
    fetchTableRecordsAllPages(tableIds.leden, 500, 80),
  ]);
  const lidIdByNaamKey = new Map<string, number>();
  for (const lidRecord of ledenRecords) {
    const fields = lidRecord.fields ?? {};
    const naam = asString(fields.Naam).trim().toLowerCase();
    if (naam && !lidIdByNaamKey.has(naam)) {
      lidIdByNaamKey.set(naam, lidRecord.id);
    }
  }
  const byLidId: Record<number, string> = {};
  let matchJaar = 0;
  let matchPeriode = 0;
  let matchLid = 0;
  const samples: NinoxContributieFactuurDebugSample[] = [];
  for (const record of records) {
    const fields = record.fields ?? {};
    const factuurJaar = extractYearFromDateText(fields.Factuurdatum);
    if (factuurJaar !== jaar) {
      continue;
    }
    matchJaar += 1;
    const periodeValue = normalizePeriode(extractComparableText(fields.Periode).trim() || asString(fields.Periode).trim());
    if (!periodeValue || periodeValue !== targetPeriode) {
      continue;
    }
    matchPeriode += 1;
    const lidRaw = fields.Lid;
    const lidIdDirect = extractLinkedRecordId(lidRaw);
    const lidNaam = extractComparableText(lidRaw).trim().toLowerCase();
    const lidIdFromNaam = lidNaam ? lidIdByNaamKey.get(lidNaam) : undefined;
    const lidId = typeof lidIdDirect === 'number' ? lidIdDirect : typeof lidIdFromNaam === 'number' ? lidIdFromNaam : null;
    if (typeof lidId !== 'number') {
      continue;
    }
    matchLid += 1;
    const factuurnummer = asString(fields.Factuurnummer).trim() || `VER-${record.id}`;
    if (!byLidId[lidId]) {
      byLidId[lidId] = factuurnummer;
    }
    if (samples.length < 8) {
      samples.push({
        recordId: record.id,
        factuurnummer,
        factuurdatum: asString(fields.Factuurdatum).trim(),
        periode: asString(fields.Periode).trim(),
        lidRaw: extractComparableText(lidRaw).trim() || asString(lidRaw).trim(),
        lidId,
      });
    }
  }
  return {
    byLidId,
    debug: {
      targetJaar: jaar,
      targetPeriode: String(periode || '').trim(),
      totaalVerkoopfacturen: records.length,
      matchJaar,
      matchPeriode,
      matchLid,
      uniekeLidHits: Object.keys(byLidId).length,
      samples,
    },
  };
}

export interface NinoxContributieFactuurMailItem {
  recordId: number;
  lidId: number;
  lidNaam: string;
  factuurnummer: string;
  factuurdatum: string;
  periode: string;
  titel: string;
  omschrijvingRegel: string;
  bedragRegel: number;
}

export interface NinoxContributieIngIncassoItem {
  recordId: number;
  lidId: number;
  naam: string;
  roepnaam: string;
  email: string;
  factuurnummer: string;
  factuurbedrag: number;
  iban: string;
  mandaatId: string;
  mandaatDatum: string;
}

export async function fetchNinoxOpenstaandeContributieFacturenVoorMail(
  jaar: number,
  periode: string
): Promise<NinoxContributieFactuurMailItem[]> {
  const normalizePeriode = (value: string): string =>
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  const targetPeriode = normalizePeriode(periode);
  const [records, ledenRecords] = await Promise.all([
    fetchTableRecordsAllPages(tableIds.facturenVerkoop, 500, 200),
    fetchTableRecordsAllPages(tableIds.leden, 500, 80),
  ]);
  const lidIdByNaamKey = new Map<string, number>();
  for (const lidRecord of ledenRecords) {
    const fields = lidRecord.fields ?? {};
    const naam = asString(fields.Naam).trim().toLowerCase();
    if (naam && !lidIdByNaamKey.has(naam)) {
      lidIdByNaamKey.set(naam, lidRecord.id);
    }
  }
  const result: NinoxContributieFactuurMailItem[] = [];

  for (const record of records) {
    const fields = record.fields ?? {};
    const factuurnummer =
      extractComparableText(fields.Factuurnummer).trim() ||
      (typeof fields.Factuurnummer === 'number' && Number.isFinite(fields.Factuurnummer)
        ? String(fields.Factuurnummer)
        : asString(fields.Factuurnummer).trim()) ||
      `VER-${record.id}`;
    if (!factuurnummer) {
      continue;
    }
    const factuurJaar = extractYearFromDateText(fields.Factuurdatum);
    if (factuurJaar !== jaar) {
      continue;
    }
    const periodeValue = normalizePeriode(extractComparableText(fields.Periode).trim() || asString(fields.Periode).trim());
    if (!periodeValue || periodeValue !== targetPeriode) {
      continue;
    }
    const datumGemaild = extractComparableText(fields['Datum gemaild']).trim() || asString(fields['Datum gemaild']).trim();
    if (datumGemaild) {
      continue;
    }
    const lidRaw = fields.Lid;
    const lidIdDirect = extractLinkedRecordId(lidRaw);
    const lidNaamRaw = extractComparableText(lidRaw).trim();
    const lidIdFromNaam = lidNaamRaw ? lidIdByNaamKey.get(lidNaamRaw.toLowerCase()) : undefined;
    const lidId = typeof lidIdDirect === 'number' ? lidIdDirect : typeof lidIdFromNaam === 'number' ? lidIdFromNaam : null;
    if (typeof lidId !== 'number') {
      continue;
    }
    result.push({
      recordId: record.id,
      lidId,
      lidNaam: lidNaamRaw,
      factuurnummer,
      factuurdatum: asString(fields.Factuurdatum).trim() || asString(fields.Datum).trim(),
      periode: asString(fields.Periode).trim(),
      titel: asString(fields.Titel).trim() || asString(fields['Omschrijving - 01']).trim() || 'Contributie',
      omschrijvingRegel: asString(fields['Omschrijving - 01']).trim() || asString(fields.Titel).trim() || 'Contributie',
      bedragRegel: asNumber(fields['Bedrag - 01']),
    });
  }

  return result.sort((a, b) => {
    const aNum = Number(a.factuurnummer);
    const bNum = Number(b.factuurnummer);
    if (Number.isFinite(aNum) && Number.isFinite(bNum)) {
      return aNum - bNum;
    }
    return a.factuurnummer.localeCompare(b.factuurnummer, 'nl', { sensitivity: 'base', numeric: true });
  });
}

export async function fetchNinoxOpenstaandeContributieFacturenVoorIng(): Promise<NinoxContributieIngIncassoItem[]> {
  const [verkoopRecords, ledenRecords, verkoopFields] = await Promise.all([
    fetchTableRecordsAllPages(tableIds.facturenVerkoop, 500, 200),
    fetchTableRecordsAllPages(tableIds.leden, 500, 80),
    fetchNinoxTableFields(tableIds.facturenVerkoop).catch(() => []),
  ]);

  const normalizeLoose = (value: string): string => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const findByAliases = (fields: Record<string, unknown>, aliases: string[]): unknown => {
    const entries = Object.entries(fields || {});
    for (const alias of aliases) {
      const normalizedAlias = normalizeLoose(alias);
      const exact = entries.find(([key]) => normalizeLoose(key) === normalizedAlias);
      if (exact) {
        return exact[1];
      }
    }
    for (const alias of aliases) {
      const normalizedAlias = normalizeLoose(alias);
      const includes = entries.find(([key]) => {
        const normalizedKey = normalizeLoose(key);
        return normalizedKey.includes(normalizedAlias) || normalizedAlias.includes(normalizedKey);
      });
      if (includes) {
        return includes[1];
      }
    }
    return undefined;
  };
  const asYesNoBoolean = (value: unknown): boolean => {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      return value !== 0;
    }
    const text = (extractComparableText(value).trim() || asString(value).trim()).toLowerCase();
    if (!text) {
      return false;
    }
    if (['ja', 'j', 'yes', 'y', 'true', '1', 'aan', 'on'].includes(text)) {
      return true;
    }
    if (['nee', 'n', 'no', 'false', '0', 'uit', 'off', '-'].includes(text)) {
      return false;
    }
    return Boolean(text);
  };
  const hasDateTimeValue = (value: unknown): boolean => {
    if (value === null || value === undefined) {
      return false;
    }
    if (typeof value === 'string') {
      return value.trim().length > 0;
    }
    if (typeof value === 'number') {
      return Number.isFinite(value);
    }
    if (Array.isArray(value)) {
      return value.some((item) => hasDateTimeValue(item));
    }
    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      const candidates = [obj.value, obj.text, obj.caption, obj.label, obj.formatted, obj.datetime, obj.date, obj.timestamp];
      return candidates.some((candidate) => hasDateTimeValue(candidate));
    }
    return false;
  };
  const datumNaarIngFieldName =
    findFieldName(verkoopFields, ['Datum naar ING', 'Datum naar ing', 'Datum naar ING (datum+tijd)', 'Naar ING']) ||
    null;

  const lidMetaById = new Map<
    number,
    {
      naam: string;
      roepnaam: string;
      email: string;
      iban: string;
      mandaatId: string;
      mandaatDatum: string;
      sepa: boolean;
    }
  >();
  const lidIdByNaamKey = new Map<string, number>();
  for (const lidRecord of ledenRecords) {
    const fields = lidRecord.fields ?? {};
    const naam =
      asString(fields.Naam).trim() ||
      asString(fields['Achternaam, Voorletters']).trim() ||
      extractComparableText(fields.Naam).trim() ||
      `Lid ${lidRecord.id}`;
    const roepnaam = asString(fields.Roepnaam).trim() || extractComparableText(fields.Roepnaam).trim();
    const email = asString(fields['E-mail']).trim() || asString(fields.Email).trim() || extractComparableText(fields['E-mail']).trim();
    const ibanRaw = findByAliases(fields, ['IBAN']);
    const iban =
      (typeof ibanRaw === 'string' ? ibanRaw.trim() : asString(ibanRaw).trim()) || extractComparableText(ibanRaw).trim();
    const mandaatIdRaw = findByAliases(fields, ['Kenmerk machtiging (ID)', 'Kenmerk machtiging', 'Mandaat ID', 'MandaatID']);
    const mandaatId =
      (typeof mandaatIdRaw === 'string' ? mandaatIdRaw.trim() : asString(mandaatIdRaw).trim()) || extractComparableText(mandaatIdRaw).trim();
    const mandaatDatumRaw = findByAliases(fields, ['Datum ondertekening', 'SEPA tekendatum', 'SEPA-tekendatum', 'Mandaat datum']);
    const mandaatDatum =
      (typeof mandaatDatumRaw === 'string' ? mandaatDatumRaw.trim() : asString(mandaatDatumRaw).trim()) || extractComparableText(mandaatDatumRaw).trim();
    const sepaRaw = findByAliases(fields, ['SEPA-machtiging', 'SEPA machtiging', 'SEPA']);
    const sepa = asYesNoBoolean(sepaRaw);
    lidMetaById.set(lidRecord.id, { naam, roepnaam, email, iban, mandaatId, mandaatDatum, sepa });
    const naamKey = String(naam || '').trim().toLowerCase();
    if (naamKey && !lidIdByNaamKey.has(naamKey)) {
      lidIdByNaamKey.set(naamKey, lidRecord.id);
    }
  }

  const rows: NinoxContributieIngIncassoItem[] = [];
  for (const record of verkoopRecords) {
    const fields = record.fields ?? {};
    const datumNaarIngRaw = datumNaarIngFieldName ? fields[datumNaarIngFieldName] : findByAliases(fields, ['Datum naar ING', 'Datum naar ing', 'Naar ING']);
    if (hasDateTimeValue(datumNaarIngRaw)) {
      continue;
    }
    const lidRaw = fields.Lid;
    const lidIdDirect = extractLinkedRecordId(lidRaw);
    const lidNaamRaw = extractComparableText(lidRaw).trim();
    const lidIdFromNaam = lidNaamRaw ? lidIdByNaamKey.get(lidNaamRaw.toLowerCase()) : undefined;
    const lidId = typeof lidIdDirect === 'number' ? lidIdDirect : typeof lidIdFromNaam === 'number' ? lidIdFromNaam : null;
    if (typeof lidId !== 'number') {
      continue;
    }
    const lidMeta = lidMetaById.get(lidId);
    if (!lidMeta || !lidMeta.sepa) {
      continue;
    }
    const factuurnummer =
      extractComparableText(fields.Factuurnummer).trim() ||
      (typeof fields.Factuurnummer === 'number' && Number.isFinite(fields.Factuurnummer)
        ? String(fields.Factuurnummer)
        : asString(fields.Factuurnummer).trim()) ||
      `VER-${record.id}`;
    const factuurbedragRaw = asNumber(fields.Totaalbedrag, NaN);
    const factuurbedrag =
      Number.isFinite(factuurbedragRaw) && !Number.isNaN(factuurbedragRaw)
        ? Math.abs(factuurbedragRaw)
        : Math.abs(asNumber(fields['Bedrag - 01']));
    rows.push({
      recordId: record.id,
      lidId,
      naam: lidMeta.naam,
      roepnaam: lidMeta.roepnaam,
      email: lidMeta.email,
      factuurnummer,
      factuurbedrag,
      iban: lidMeta.iban,
      mandaatId: lidMeta.mandaatId,
      mandaatDatum: lidMeta.mandaatDatum,
    });
  }

  return rows.sort((a, b) => {
    const aNum = Number(a.factuurnummer);
    const bNum = Number(b.factuurnummer);
    if (Number.isFinite(aNum) && Number.isFinite(bNum)) {
      return aNum - bNum;
    }
    return a.factuurnummer.localeCompare(b.factuurnummer, 'nl', { sensitivity: 'base', numeric: true });
  });
}

export async function generateSepaIncassoXml(
  transactions: NinoxContributieIngIncassoItem[],
  incassantId: string,
  creditorName: string,
  creditorIban: string,
  creditorBic: string
): Promise<string> {
  const now = new Date();
  const msgId = `AD-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  const creationDateTime = now.toISOString().slice(0, 19);
  const nbOfTxs = transactions.length;
  const ctrlSum = transactions.reduce((sum, t) => sum + t.factuurbedrag, 0).toFixed(2);
  
  // Collection date: 7 days from now
  const collectionDate = new Date(now);
  collectionDate.setDate(collectionDate.getDate() + 7);
  const reqdColltnDt = collectionDate.toISOString().slice(0, 10);
  
  const pmtInfId = `AD-SEPA-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

  let xml = `<?xml version="1.0" encoding="UTF-8"?>`;
  xml += `<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.08" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">`;
  xml += `<CstmrDrctDbtInitn>`;
  xml += `<GrpHdr>`;
  xml += `<MsgId>${msgId}</MsgId>`;
  xml += `<CreDtTm>${creationDateTime}</CreDtTm>`;
  xml += `<NbOfTxs>${nbOfTxs}</NbOfTxs>`;
  xml += `<CtrlSum>${ctrlSum}</CtrlSum>`;
  xml += `<InitgPty><Nm>${creditorName}</Nm></InitgPty>`;
  xml += `</GrpHdr>`;
  xml += `<PmtInf>`;
  xml += `<PmtInfId>${pmtInfId}</PmtInfId>`;
  xml += `<PmtMtd>DD</PmtMtd>`;
  xml += `<BtchBookg>true</BtchBookg>`;
  xml += `<NbOfTxs>${nbOfTxs}</NbOfTxs>`;
  xml += `<CtrlSum>${ctrlSum}</CtrlSum>`;
  xml += `<PmtTpInf>`;
  xml += `<SvcLvl><Cd>SEPA</Cd></SvcLvl>`;
  xml += `<LclInstrm><Cd>CORE</Cd></LclInstrm>`;
  xml += `<SeqTp>RCUR</SeqTp>`;
  xml += `</PmtTpInf>`;
  xml += `<ReqdColltnDt>${reqdColltnDt}</ReqdColltnDt>`;
  xml += `<Cdtr><Nm>${creditorName}</Nm></Cdtr>`;
  xml += `<CdtrAcct><Id><IBAN>${creditorIban.replace(/\s/g, '')}</IBAN></Id></CdtrAcct>`;
  xml += `<CdtrAgt><FinInstnId><BICFI>${creditorBic}</BICFI></FinInstnId></CdtrAgt>`;
  xml += `<ChrgBr>SLEV</ChrgBr>`;
  xml += `<CdtrSchmeId>`;
  xml += `<Id><PrvtId><Othr>`;
  xml += `<Id>${incassantId}</Id>`;
  xml += `<SchmeNm><Prtry>SEPA</Prtry></SchmeNm>`;
  xml += `</Othr></PrvtId></Id>`;
  xml += `</CdtrSchmeId>`;

  transactions.forEach((tx, idx) => {
    const endToEndId = `AD${String(now.getDate()).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}${now.getFullYear()}${String(idx + 1)}`;
    const amount = tx.factuurbedrag.toFixed(2);
    const mandaatId = tx.mandaatId || `AD-${tx.lidId}`;
    const mandaatDatum = tx.mandaatDatum || now.toISOString().slice(0, 10);
    
    xml += `<DrctDbtTxInf>`;
    xml += `<PmtId><EndToEndId>${endToEndId}</EndToEndId></PmtId>`;
    xml += `<InstdAmt Ccy="EUR">${amount}</InstdAmt>`;
    xml += `<DrctDbtTx>`;
    xml += `<MndtRltdInf>`;
    xml += `<MndtId>${mandaatId}</MndtId>`;
    xml += `<DtOfSgntr>${mandaatDatum}</DtOfSgntr>`;
    xml += `</MndtRltdInf>`;
    xml += `</DrctDbtTx>`;
    xml += `<Dbtr><Nm>${tx.naam}</Nm></Dbtr>`;
    xml += `<DbtrAcct><Id><IBAN>${tx.iban.replace(/\s/g, '')}</IBAN></Id></DbtrAcct>`;
    xml += `<RmtInf><Ustrd>Factuur: ${tx.factuurnummer}</Ustrd></RmtInf>`;
    xml += `</DrctDbtTxInf>`;
  });

  xml += `</PmtInf>`;
  xml += `</CstmrDrctDbtInitn>`;
  xml += `</Document>`;

  return xml;
}

export async function markeerNinoxVerkoopFactuurAlsGemaild(
  recordId: number,
  input: { datumTijd: string; doorGemaild: string }
): Promise<void> {
  const tableFields = await fetchNinoxTableFields(tableIds.facturenVerkoop);
  const datumGemaildField = findFieldName(tableFields, ['Datum gemaild', 'Datum+tijd gemaild', 'Datum tijd gemaild']);
  const doorGemaildField = findFieldName(tableFields, ['Door gemaild', 'Gemaild door']);
  if (!datumGemaildField && !doorGemaildField) {
    throw new Error('Velden voor mailregistratie niet gevonden in Verkoopfacturen (Datum gemaild / Door gemaild).');
  }
  const fields: Record<string, unknown> = {};
  if (datumGemaildField && input.datumTijd.trim()) {
    fields[datumGemaildField] = normalizeDateTimeToIso(input.datumTijd.trim());
  }
  if (doorGemaildField && input.doorGemaild.trim()) {
    fields[doorGemaildField] = input.doorGemaild.trim();
  }
  if (Object.keys(fields).length === 0) {
    return;
  }
  await updateNinoxRecord(tableIds.facturenVerkoop, recordId, fields);
}

export async function markeerNinoxVerkoopFactuurNaarIng(
  recordId: number,
  input: { datumTijd: string; doorNaarIng: string }
): Promise<void> {
  const tableFields = await fetchNinoxTableFields(tableIds.facturenVerkoop);
  const datumNaarIngField = findFieldName(tableFields, [
    'Datum naar ING',
    'Datum naar ing',
    'Datum naar ING (datum+tijd)',
    'Naar ING datum',
  ]);
  const doorNaarIngField = findFieldName(tableFields, ['Door naar ING', 'Door naar ing', 'Naar ING door']);
  if (!datumNaarIngField && !doorNaarIngField) {
    throw new Error('Velden voor ING-registratie niet gevonden in Verkoopfacturen (Datum naar ING / Door naar ING).');
  }
  const fields: Record<string, unknown> = {};
  if (datumNaarIngField && input.datumTijd.trim()) {
    fields[datumNaarIngField] = normalizeDateTimeToIso(input.datumTijd.trim());
  }
  if (doorNaarIngField && input.doorNaarIng.trim()) {
    fields[doorNaarIngField] = input.doorNaarIng.trim();
  }
  if (Object.keys(fields).length === 0) {
    return;
  }
  await updateNinoxRecord(tableIds.facturenVerkoop, recordId, fields);
}

export async function markeerNinoxLidDoorDatumTijd(
  lidId: number,
  input: { datumTijd: string; door: string }
): Promise<void> {
  const tableFields = await fetchNinoxTableFields(tableIds.leden);
  const datumTijdField = findFieldName(tableFields, [
    'Datum+tijd',
    'Datum tijd',
    'Aangemaakt op',
    'Datum gemaild',
    'Datum+tijd gemaild',
    'Datum tijd gemaild',
  ]);
  const doorField = findFieldName(tableFields, [
    'Door',
    'Gebruiker',
    'Aangemaakt door',
    'Door gemaild',
    'Gemaild door',
  ]);
  // Niet blokkeren als de velden in deze omgeving/tabel niet bestaan.
  if (!datumTijdField && !doorField) {
    return;
  }
  const fields: Record<string, unknown> = {};
  if (datumTijdField && input.datumTijd.trim()) {
    fields[datumTijdField] = normalizeDateTimeToIso(input.datumTijd.trim());
  }
  if (doorField && input.door.trim()) {
    fields[doorField] = input.door.trim();
  }
  if (Object.keys(fields).length === 0) {
    return;
  }
  await updateNinoxRecord(tableIds.leden, lidId, fields);
}

async function requireBoekingenTableId(): Promise<string> {
  const tableId = await fetchTableIdByName('Boekingen');
  if (!tableId) {
    throw new Error('Tabel Boekingen niet gevonden.');
  }
  return tableId;
}

export async function fetchNinoxMemoriaalBoekingen(): Promise<MemoriaalBoeking[]> {
  const tableId = await requireBoekingenTableId();
  const records = await fetchTableRecords(tableId, 1000);

  return records
    .map((record) => {
      const fields = record.fields ?? {};
      const datum = asString(fields.Datum) || asString(fields.Boekingsdatum) || todayIsoDate();
      const omschrijving = asString(fields.Omschrijving) || asString(fields.Titel) || asString(fields.Beschrijving);
      const vanLink = fields['Van grootboekrekening'] ?? fields['Van Grootboekrekening'] ?? fields['Grootboekrekening van'] ?? fields['Grootboekrekening - van'];
      const naarLink =
        fields['Naar grootboekrekening'] ?? fields['Naar Grootboekrekening'] ?? fields['Grootboekrekening naar'] ?? fields['Grootboekrekening - naar'];
      const vanNummer =
        asString(fields['Van grootboeknummer']) ||
        asString(fields['Van Grootboeknummer']) ||
        asString(fields['Grootboeknummer van']) ||
        extractComparableText(vanLink);
      const naarNummer =
        asString(fields['Naar grootboeknummer']) ||
        asString(fields['Naar Grootboeknummer']) ||
        asString(fields['Grootboeknummer naar']) ||
        extractComparableText(naarLink);
      const bedrag = Math.abs(asNumber(fields.Bedrag));
      const datumTijd = asString(fields['Datum+tijd']) || asString(fields['Datum tijd']) || asString(fields.Datum) || '';
      const door = asString(fields.Door) || asString(fields.Gebruiker) || asString(fields['Aangemaakt door']) || '';

      return {
        id: 300000 + record.id,
        bronRecordId: record.id,
        datum,
        datumTijd,
        door,
        omschrijving: omschrijving || `Boeking ${record.id}`,
        vanGrootboek: vanNummer,
        naarGrootboek: naarNummer,
        bedrag,
      } satisfies MemoriaalBoeking;
    })
    .sort((a, b) => b.datum.localeCompare(a.datum));
}

export async function createNinoxMemoriaalBoeking(input: NieuwMemoriaalBoekingInput): Promise<void> {
  const tableId = await requireBoekingenTableId();
  const tableFields = await fetchNinoxTableFields(tableId);
  const datumTijdField = findFieldName(tableFields, ['Datum+tijd', 'Datum tijd']);
  const datumField = findFieldName(tableFields, ['Datum', 'Boekingsdatum']);
  const omschrijvingField = findFieldName(tableFields, ['Omschrijving', 'Titel', 'Beschrijving']);
  const doorField = findFieldName(tableFields, ['Door', 'Gebruiker', 'Aangemaakt door']);
  const vanRekeningField = findFieldName(tableFields, ['Van grootboekrekening', 'Van Grootboekrekening', 'Grootboekrekening van', 'Grootboekrekening - van']);
  const naarRekeningField = findFieldName(tableFields, ['Naar grootboekrekening', 'Naar Grootboekrekening', 'Grootboekrekening naar', 'Grootboekrekening - naar']);
  const vanNummerField = findFieldName(tableFields, ['Van grootboeknummer', 'Van Grootboeknummer', 'Grootboeknummer van']);
  const naarNummerField = findFieldName(tableFields, ['Naar grootboeknummer', 'Naar Grootboeknummer', 'Grootboeknummer naar']);
  const bedragField = findFieldName(tableFields, ['Bedrag']);

  const vanRef = input.vanGrootboek.trim();
  const naarRef = input.naarGrootboek.trim();
  const vanRecordId = vanRef ? await findGrootboekRecordIdByRef(vanRef) : null;
  const naarRecordId = naarRef ? await findGrootboekRecordIdByRef(naarRef) : null;

  const fields: Record<string, unknown> = {};
  if (datumTijdField && input.datumTijd?.trim()) {
    fields[datumTijdField] = normalizeDateTimeToIso(input.datumTijd.trim());
  }
  if (datumField) {
    fields[datumField] = normalizeDateToIso(input.datum);
  }
  if (omschrijvingField) {
    fields[omschrijvingField] = input.omschrijving.trim();
  }
  if (doorField && input.door?.trim()) {
    fields[doorField] = input.door.trim();
  }
  if (vanRekeningField && vanRef) {
    fields[vanRekeningField] = typeof vanRecordId === 'number' ? vanRecordId : vanRef;
  }
  if (naarRekeningField && naarRef) {
    fields[naarRekeningField] = typeof naarRecordId === 'number' ? naarRecordId : naarRef;
  }
  if (vanNummerField && vanRef) {
    fields[vanNummerField] = vanRef;
  }
  if (naarNummerField && naarRef) {
    fields[naarNummerField] = naarRef;
  }
  if (bedragField) {
    fields[bedragField] = input.bedrag;
  }

  await createNinoxRecord(tableId, fields);
}

export async function updateNinoxMemoriaalBoeking(id: number, input: NieuwMemoriaalBoekingInput): Promise<void> {
  const tableId = await requireBoekingenTableId();
  const tableFields = await fetchNinoxTableFields(tableId);
  const datumTijdField = findFieldName(tableFields, ['Datum+tijd', 'Datum tijd']);
  const datumField = findFieldName(tableFields, ['Datum', 'Boekingsdatum']);
  const omschrijvingField = findFieldName(tableFields, ['Omschrijving', 'Titel', 'Beschrijving']);
  const doorField = findFieldName(tableFields, ['Door', 'Gebruiker', 'Aangemaakt door']);
  const vanRekeningField = findFieldName(tableFields, ['Van grootboekrekening', 'Van Grootboekrekening', 'Grootboekrekening van', 'Grootboekrekening - van']);
  const naarRekeningField = findFieldName(tableFields, ['Naar grootboekrekening', 'Naar Grootboekrekening', 'Grootboekrekening naar', 'Grootboekrekening - naar']);
  const vanNummerField = findFieldName(tableFields, ['Van grootboeknummer', 'Van Grootboeknummer', 'Grootboeknummer van']);
  const naarNummerField = findFieldName(tableFields, ['Naar grootboeknummer', 'Naar Grootboeknummer', 'Grootboeknummer naar']);
  const bedragField = findFieldName(tableFields, ['Bedrag']);

  const vanRef = input.vanGrootboek.trim();
  const naarRef = input.naarGrootboek.trim();
  const vanRecordId = vanRef ? await findGrootboekRecordIdByRef(vanRef) : null;
  const naarRecordId = naarRef ? await findGrootboekRecordIdByRef(naarRef) : null;

  const fields: Record<string, unknown> = {};
  if (datumTijdField && input.datumTijd?.trim()) {
    fields[datumTijdField] = normalizeDateTimeToIso(input.datumTijd.trim());
  }
  if (datumField) {
    fields[datumField] = normalizeDateToIso(input.datum);
  }
  if (omschrijvingField) {
    fields[omschrijvingField] = input.omschrijving.trim();
  }
  if (doorField && input.door?.trim()) {
    fields[doorField] = input.door.trim();
  }
  if (vanRekeningField && vanRef) {
    fields[vanRekeningField] = typeof vanRecordId === 'number' ? vanRecordId : vanRef;
  }
  if (naarRekeningField && naarRef) {
    fields[naarRekeningField] = typeof naarRecordId === 'number' ? naarRecordId : naarRef;
  }
  if (vanNummerField && vanRef) {
    fields[vanNummerField] = vanRef;
  }
  if (naarNummerField && naarRef) {
    fields[naarNummerField] = naarRef;
  }
  if (bedragField) {
    fields[bedragField] = input.bedrag;
  }

  await updateNinoxRecord(tableId, id, fields);
}

export async function deleteNinoxMemoriaalBoeking(id: number): Promise<void> {
  const tableId = await requireBoekingenTableId();
  await deleteNinoxRecord(tableId, id);
}

export async function createNinoxVerkoopFactuur(input: NieuwFactuurInput): Promise<void> {
  const datum = normalizeDateToIso(input.datum);
  const periode = (input.periode || '').trim();
  const betaaldatum = input.betaaldatum ? normalizeDateToIso(input.betaaldatum) : '';
  const titel = (input.titel || '').trim();
  const grootboek = (input.grootboek || '').trim();
  const grootboekNummerTekst = (input.grootboekNummerTekst || grootboek).trim();
  const grootboek2 = (input.grootboek2 || '').trim();
  const grootboekRecordId = grootboek ? await findGrootboekRecordIdByRef(grootboek) : null;
  const grootboekRecordId2 = grootboek2 ? await findGrootboekRecordIdByRef(grootboek2) : null;
  const omschrijving2 = (input.omschrijving2 || '').trim();
  const bedrag2 = typeof input.bedrag2 === 'number' ? input.bedrag2 : 0;
  const totaal = input.bedrag + bedrag2;
  const tableFields = await fetchNinoxTableFields(tableIds.facturenVerkoop);
  const lidField = findFieldName(tableFields, ['Lid', 'Lid - 01']);
  const periodeField = findFieldName(tableFields, ['Periode', 'Periode contributie', 'Contributie periode']);
  const titelField = findFieldName(tableFields, ['Titel', 'Omschrijving', 'Onderwerp']);
  const betaaldatumField = findFieldName(tableFields, ['Betaaldatum', 'Datum betaald']);
  const doorField = findFieldName(tableFields, ['Door', 'Gebruiker', 'Aangemaakt door']);
  const datumTijdField = findFieldName(tableFields, ['Datum+tijd', 'Datum tijd', 'Aangemaakt op']);
  const fields: Record<string, unknown> = {
    Factuurnummer: input.factuurnummer.trim(),
    Factuurdatum: datum,
    Datum: datum,
    'Omschrijving - 01': input.omschrijving.trim(),
    'Omschrijving - 02': omschrijving2,
    Totaalbedrag: totaal,
    'Bedrag - 01': input.bedrag,
    'Bedrag - 02': bedrag2,
    ...(grootboek
      ? {
          'Grootboekrekening - 01': typeof grootboekRecordId === 'number' ? grootboekRecordId : grootboek,
          'Grootboeknummer - 01': grootboekNummerTekst,
        }
      : {}),
    ...(grootboek2
      ? {
          'Grootboekrekening - 02': typeof grootboekRecordId2 === 'number' ? grootboekRecordId2 : grootboek2,
          'Grootboeknummer - 02': grootboek2,
        }
      : {}),
    Betaald: input.betaald,
  };
  if (titelField && titel) {
    fields[titelField] = titel;
  }
  if (periodeField && periode) {
    fields[periodeField] = periode;
  }
  if (betaaldatumField && betaaldatum) {
    fields[betaaldatumField] = betaaldatum;
  }
  if (doorField && input.door?.trim()) {
    fields[doorField] = input.door.trim();
  }
  if (datumTijdField && input.datumTijd?.trim()) {
    fields[datumTijdField] = normalizeDateTimeToIso(input.datumTijd.trim());
  }
  if (lidField && typeof input.lidId === 'number') {
    fields[lidField] = input.lidId;
  }
  await createNinoxRecord(tableIds.facturenVerkoop, {
    ...fields,
  });
}

export async function createNinoxInkoopFactuur(input: NieuwFactuurInput): Promise<void> {
  const datum = normalizeDateToIso(input.datum);
  const betaaldatum = input.betaaldatum ? normalizeDateToIso(input.betaaldatum) : '';
  const grootboek = (input.grootboek || '').trim();
  const tableFields = await fetchNinoxTableFields(tableIds.facturenInkoop);
  const factuurnummerField = findFieldName(tableFields, ['Factuurnummer']);
  const factuurdatumField = findFieldName(tableFields, ['Factuurdatum', 'Datum']);
  const datumField = findFieldName(tableFields, ['Datum']);
  const omschrijvingField = findFieldName(tableFields, ['Omschrijving']);
  const totaalField = findFieldName(tableFields, ['Totaalbedrag']);
  const betaaldField = findFieldName(tableFields, ['Betaald']);
  const grootboekRekeningField = findFieldName(tableFields, ['Grootboekrekening']);
  const grootboekNummerField = findFieldName(tableFields, ['Grootboeknummer']);
  const relatieField = findFieldName(tableFields, ['Relatie', 'Crediteur', 'Leverancier', 'Lid', 'Lid - 01']);
  const betaaldatumField = findFieldName(tableFields, ['Betaaldatum', 'Datum betaald']);
  const doorField = findFieldName(tableFields, ['Door', 'Gebruiker', 'Aangemaakt door']);
  const datumTijdField = findFieldName(tableFields, ['Datum+tijd', 'Datum tijd', 'Aangemaakt op']);
  const fields: Record<string, unknown> = {};
  const grootboekRecordId = grootboek ? await findGrootboekRecordIdByRef(grootboek) : null;
  if (factuurnummerField) {
    fields[factuurnummerField] = input.factuurnummer.trim();
  }
  if (factuurdatumField) {
    fields[factuurdatumField] = datum;
  }
  if (datumField && datumField !== factuurdatumField) {
    fields[datumField] = datum;
  }
  if (omschrijvingField) {
    fields[omschrijvingField] = input.omschrijving.trim();
  }
  if (totaalField) {
    fields[totaalField] = input.bedrag;
  }
  if (betaaldField) {
    fields[betaaldField] = input.betaald;
  }
  if (grootboek && grootboekRekeningField) {
    fields[grootboekRekeningField] = typeof grootboekRecordId === 'number' ? grootboekRecordId : grootboek;
  }
  if (grootboek && grootboekNummerField) {
    fields[grootboekNummerField] = grootboek;
  }
  if (betaaldatumField && betaaldatum) {
    fields[betaaldatumField] = betaaldatum;
  }
  if (doorField && input.door?.trim()) {
    fields[doorField] = input.door.trim();
  }
  if (datumTijdField && input.datumTijd?.trim()) {
    fields[datumTijdField] = normalizeDateTimeToIso(input.datumTijd.trim());
  }
  const linkId = typeof input.relatieId === 'number' ? input.relatieId : input.lidId;
  if (relatieField && typeof linkId === 'number') {
    fields[relatieField] = linkId;
  }

  const attempts: Array<Record<string, unknown>> = [
    fields,
    Object.fromEntries(
      Object.entries(fields).filter(([key]) =>
        [
          factuurnummerField,
          factuurdatumField,
          datumField,
          relatieField,
          totaalField,
          betaaldField,
          grootboekRekeningField,
          grootboekNummerField,
        ].includes(key)
      )
    ),
    Object.fromEntries(
      Object.entries(fields).filter(([key]) =>
        [factuurnummerField, factuurdatumField, datumField, relatieField, totaalField, betaaldField, grootboekNummerField].includes(key)
      )
    ),
  ];

  let createdRecordId: number | null = null;
  let lastError: unknown = null;
  for (const attempt of attempts) {
    try {
      createdRecordId = await createNinoxRecordReturningId(tableIds.facturenInkoop, attempt);
      break;
    } catch (error) {
      lastError = error;
      if (!isServerErrorWithStatus(error, 500)) {
        throw error;
      }
    }
  }
  if (createdRecordId === null) {
    throw lastError instanceof Error ? lastError : new Error('Inkoopfactuur aanmaken mislukt.');
  }
  if (input.documentBestand) {
    await uploadNinoxRecordDocument(tableIds.facturenInkoop, createdRecordId, input.documentBestand, 'Document');
  }
}

export async function updateNinoxVerkoopFactuur(id: number, input: NieuwFactuurInput): Promise<void> {
  const datum = normalizeDateToIso(input.datum);
  const periode = (input.periode || '').trim();
  const betaaldatum = input.betaaldatum ? normalizeDateToIso(input.betaaldatum) : '';
  const titel = (input.titel || '').trim();
  const grootboek = (input.grootboek || '').trim();
  const grootboekNummerTekst = (input.grootboekNummerTekst || grootboek).trim();
  const grootboek2 = (input.grootboek2 || '').trim();
  const grootboekRecordId = grootboek ? await findGrootboekRecordIdByRef(grootboek) : null;
  const grootboekRecordId2 = grootboek2 ? await findGrootboekRecordIdByRef(grootboek2) : null;
  const omschrijving2 = (input.omschrijving2 || '').trim();
  const bedrag2 = typeof input.bedrag2 === 'number' ? input.bedrag2 : 0;
  const totaal = input.bedrag + bedrag2;
  const tableFields = await fetchNinoxTableFields(tableIds.facturenVerkoop);
  const lidField = findFieldName(tableFields, ['Lid', 'Lid - 01']);
  const periodeField = findFieldName(tableFields, ['Periode', 'Periode contributie', 'Contributie periode']);
  const titelField = findFieldName(tableFields, ['Titel', 'Omschrijving', 'Onderwerp']);
  const betaaldatumField = findFieldName(tableFields, ['Betaaldatum', 'Datum betaald']);
  const doorField = findFieldName(tableFields, ['Door', 'Gebruiker', 'Aangemaakt door']);
  const datumTijdField = findFieldName(tableFields, ['Datum+tijd', 'Datum tijd', 'Aangemaakt op']);
  const fields: Record<string, unknown> = {
    Factuurnummer: input.factuurnummer.trim(),
    Factuurdatum: datum,
    Datum: datum,
    'Omschrijving - 01': input.omschrijving.trim(),
    'Omschrijving - 02': omschrijving2,
    Totaalbedrag: totaal,
    'Bedrag - 01': input.bedrag,
    'Bedrag - 02': bedrag2,
    ...(grootboek
      ? {
          'Grootboekrekening - 01': typeof grootboekRecordId === 'number' ? grootboekRecordId : grootboek,
          'Grootboeknummer - 01': grootboekNummerTekst,
        }
      : {}),
    ...(grootboek2
      ? {
          'Grootboekrekening - 02': typeof grootboekRecordId2 === 'number' ? grootboekRecordId2 : grootboek2,
          'Grootboeknummer - 02': grootboek2,
        }
      : {}),
    Betaald: input.betaald,
  };
  if (titelField && titel) {
    fields[titelField] = titel;
  }
  if (periodeField && periode) {
    fields[periodeField] = periode;
  }
  if (betaaldatumField && betaaldatum) {
    fields[betaaldatumField] = betaaldatum;
  }
  if (doorField && input.door?.trim()) {
    fields[doorField] = input.door.trim();
  }
  if (datumTijdField && input.datumTijd?.trim()) {
    fields[datumTijdField] = normalizeDateTimeToIso(input.datumTijd.trim());
  }
  if (lidField && typeof input.lidId === 'number') {
    fields[lidField] = input.lidId;
  }
  await updateNinoxRecord(tableIds.facturenVerkoop, id, fields);
}

export async function updateNinoxInkoopFactuur(id: number, input: NieuwFactuurInput): Promise<void> {
  const datum = normalizeDateToIso(input.datum);
  const betaaldatum = input.betaaldatum ? normalizeDateToIso(input.betaaldatum) : '';
  const grootboek = (input.grootboek || '').trim();
  const tableFields = await fetchNinoxTableFields(tableIds.facturenInkoop);
  const factuurnummerField = findFieldName(tableFields, ['Factuurnummer']);
  const factuurdatumField = findFieldName(tableFields, ['Factuurdatum', 'Datum']);
  const datumField = findFieldName(tableFields, ['Datum']);
  const omschrijvingField = findFieldName(tableFields, ['Omschrijving']);
  const totaalField = findFieldName(tableFields, ['Totaalbedrag']);
  const betaaldField = findFieldName(tableFields, ['Betaald']);
  const grootboekRekeningField = findFieldName(tableFields, ['Grootboekrekening']);
  const grootboekNummerField = findFieldName(tableFields, ['Grootboeknummer']);
  const relatieField = findFieldName(tableFields, ['Relatie', 'Crediteur', 'Leverancier', 'Lid', 'Lid - 01']);
  const betaaldatumField = findFieldName(tableFields, ['Betaaldatum', 'Datum betaald']);
  const doorField = findFieldName(tableFields, ['Door', 'Gebruiker', 'Aangemaakt door']);
  const datumTijdField = findFieldName(tableFields, ['Datum+tijd', 'Datum tijd', 'Aangemaakt op']);
  const fields: Record<string, unknown> = {};
  const grootboekRecordId = grootboek ? await findGrootboekRecordIdByRef(grootboek) : null;
  if (factuurnummerField) {
    fields[factuurnummerField] = input.factuurnummer.trim();
  }
  if (factuurdatumField) {
    fields[factuurdatumField] = datum;
  }
  if (datumField && datumField !== factuurdatumField) {
    fields[datumField] = datum;
  }
  if (omschrijvingField) {
    fields[omschrijvingField] = input.omschrijving.trim();
  }
  if (totaalField) {
    fields[totaalField] = input.bedrag;
  }
  if (betaaldField) {
    fields[betaaldField] = input.betaald;
  }
  if (grootboek && grootboekRekeningField) {
    fields[grootboekRekeningField] = typeof grootboekRecordId === 'number' ? grootboekRecordId : grootboek;
  }
  if (grootboek && grootboekNummerField) {
    fields[grootboekNummerField] = grootboek;
  }
  if (betaaldatumField && betaaldatum) {
    fields[betaaldatumField] = betaaldatum;
  }
  if (doorField && input.door?.trim()) {
    fields[doorField] = input.door.trim();
  }
  if (datumTijdField && input.datumTijd?.trim()) {
    fields[datumTijdField] = normalizeDateTimeToIso(input.datumTijd.trim());
  }
  const linkId = typeof input.relatieId === 'number' ? input.relatieId : input.lidId;
  if (relatieField && typeof linkId === 'number') {
    fields[relatieField] = linkId;
  }

  const attempts: Array<Record<string, unknown>> = [
    fields,
    Object.fromEntries(
      Object.entries(fields).filter(([key]) =>
        [
          factuurnummerField,
          factuurdatumField,
          datumField,
          relatieField,
          totaalField,
          betaaldField,
          grootboekRekeningField,
          grootboekNummerField,
        ].includes(key)
      )
    ),
    Object.fromEntries(
      Object.entries(fields).filter(([key]) =>
        [factuurnummerField, factuurdatumField, datumField, relatieField, totaalField, betaaldField, grootboekNummerField].includes(key)
      )
    ),
  ];

  let lastError: unknown = null;
  let updated = false;
  for (const attempt of attempts) {
    try {
      await updateNinoxRecord(tableIds.facturenInkoop, id, attempt);
      updated = true;
      break;
    } catch (error) {
      lastError = error;
      if (!isServerErrorWithStatus(error, 500)) {
        throw error;
      }
    }
  }
  if (!updated) {
    throw lastError instanceof Error ? lastError : new Error('Inkoopfactuur bijwerken mislukt.');
  }
  if (input.documentBestand) {
    await uploadNinoxRecordDocument(tableIds.facturenInkoop, id, input.documentBestand, 'Document');
  }
}

async function uploadNinoxRecordDocument(tableId: string, recordId: number, file: File, fieldName: string): Promise<void> {
  const postWithTimeout = async (path: string, init: RequestInit, timeoutMs = 15000): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await request(path, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  };

  const send = async (path: string, mode: 'field' | 'named' | 'fileOnly' | 'raw') => {
    let response: Response;
    if (mode === 'raw') {
      response = await postWithTimeout(
        path,
        {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'application/pdf',
          'X-File-Name': encodeURIComponent(file.name),
        },
        body: file,
        },
        12000
      );
    } else {
      const formData = new FormData();
      if (mode === 'field') {
        formData.append('field', fieldName);
        formData.append('file', file, file.name);
      } else if (mode === 'fileOnly') {
        formData.append('file', file, file.name);
      } else {
        formData.append(fieldName, file, file.name);
      }
      response = await postWithTimeout(path, {
        method: 'POST',
        body: formData,
      });
    }
    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      const message = typeof errorPayload?.message === 'string' ? errorPayload.message : 'Onbekende Ninox fout';
      const error = new Error(`Document upload mislukt (${response.status}): ${message}`) as Error & { statusCode?: number };
      error.statusCode = response.status;
      throw error;
    }
  };

  const beforeUploadNames = await fetchRecordFileNames(tableId, recordId);

  const attempts: Array<{ path: string; mode: 'field' | 'named' | 'fileOnly' | 'raw' }> = [
    { path: `/tables/${tableId}/records/${recordId}/files`, mode: 'field' },
    { path: `/tables/${tableId}/records/${recordId}/files/${encodeURIComponent(fieldName)}`, mode: 'field' },
    { path: `/tables/${tableId}/records/${recordId}/files/${encodeURIComponent(fieldName)}`, mode: 'raw' },
  ];

  let lastError: unknown = null;
  for (const attempt of attempts) {
    try {
      await send(attempt.path, attempt.mode);
      const uploadedName = await resolveUploadedFileName(tableId, recordId, file.name, beforeUploadNames);
      await linkUploadedFileToImageField(tableId, recordId, fieldName, uploadedName || file.name);
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Document upload mislukt.');
}

async function fetchRecordFileNames(tableId: string, recordId: number): Promise<string[]> {
  const response = await request(`/tables/${tableId}/records/${recordId}/files`);
  if (!response.ok) {
    return [];
  }
  const payload = await response.json().catch(() => []);
  if (!Array.isArray(payload)) {
    return [];
  }
  return payload
    .map((item) => asString((item as { name?: unknown })?.name).trim())
    .filter((name) => Boolean(name));
}

async function resolveUploadedFileName(
  tableId: string,
  recordId: number,
  preferredName: string,
  namesBeforeUpload: string[] = []
): Promise<string | null> {
  const normalizedPreferred = normalizeCompare(preferredName);
  const names = await fetchRecordFileNames(tableId, recordId);

  const beforeSet = new Set(namesBeforeUpload.map((name) => normalizeCompare(name)));
  const newlyAdded = names.find((name) => !beforeSet.has(normalizeCompare(name)));
  if (newlyAdded) {
    return newlyAdded;
  }

  const exact = names.find((name) => normalizeCompare(name) === normalizedPreferred);
  if (exact) {
    return exact;
  }
  if (names.length > 0) {
    return names[names.length - 1];
  }
  return null;
}

function extractFileNameCandidatesFromFieldValue(value: unknown): string[] {
  const out: string[] = [];
  const add = (v: string) => {
    const t = String(v || '').trim();
    if (t) {
      out.push(t);
    }
  };
  const walk = (v: unknown) => {
    if (typeof v === 'string' || typeof v === 'number') {
      add(String(v));
      return;
    }
    if (Array.isArray(v)) {
      for (const item of v) {
        walk(item);
      }
      return;
    }
    if (typeof v === 'object' && v !== null) {
      const obj = v as Record<string, unknown>;
      add(asString(obj.name));
      add(asString(obj.fileName));
      add(asString(obj.filename));
      add(asString(obj.caption));
      add(asString(obj.value));
      for (const child of Object.values(obj)) {
        if (typeof child === 'object' && child !== null) {
          walk(child);
        }
      }
    }
  };
  walk(value);
  return out.filter((v, idx, arr) => arr.findIndex((x) => normalizeCompare(x) === normalizeCompare(v)) === idx);
}

async function resolveLinkedFileNameForField(
  tableId: string,
  recordId: number,
  fieldName: string,
  fileNames?: string[]
): Promise<string | null> {
  const names = Array.isArray(fileNames) ? fileNames : await fetchRecordFileNames(tableId, recordId);
  if (names.length === 0) {
    return null;
  }

  const recordResponse = await request(`/tables/${tableId}/records/${recordId}`);
  if (!recordResponse.ok) {
    return null;
  }
  const record = (await recordResponse.json().catch(() => null)) as NinoxRecord | null;
  const fields = record?.fields ?? {};
  const linkedRaw = fields[fieldName];
  const candidates = extractFileNameCandidatesFromFieldValue(linkedRaw);
  if (candidates.length === 0) {
    return names.length === 1 ? names[0] : names[names.length - 1];
  }

  const normalizedNames = names.map((name) => ({ name, norm: normalizeCompare(name) }));
  for (const candidate of candidates) {
    const normCandidate = normalizeCompare(candidate);
    const exact = normalizedNames.find((item) => item.norm === normCandidate);
    if (exact) {
      return exact.name;
    }
  }
  for (const candidate of candidates) {
    const normCandidate = normalizeCompare(candidate);
    const byInclude = normalizedNames.find(
      (item) => item.norm.includes(normCandidate) || normCandidate.includes(item.norm)
    );
    if (byInclude) {
      return byInclude.name;
    }
  }
  return names.length === 1 ? names[0] : names[names.length - 1];
}

async function fetchTableNameById(tableId: string): Promise<string | null> {
  const response = await request('/tables');
  if (!response.ok) {
    return null;
  }
  const rawPayload = await response.json().catch(() => null);
  if (!rawPayload || !Array.isArray(rawPayload)) {
    return null;
  }
  const table = rawPayload.find((t: any) => normalizeCompare(String(t?.id ?? '')) === normalizeCompare(tableId));
  return table ? String(table?.name ?? '').trim() || null : null;
}

function escapeNinoxScriptString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, "\\'");
}

async function fetchNinoxQueryResult<T = unknown>(query: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  let response: Response;
  try {
    response = await request(`/query?query=${encodeURIComponent(query)}`, {
      method: 'GET',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    const message = typeof errorPayload?.message === 'string' ? errorPayload.message : 'Onbekende Ninox fout';
    const error = new Error(`Ninox query mislukt (${response.status}): ${message}`) as Error & { statusCode?: number };
    error.statusCode = response.status;
    throw error;
  }
  return (await response.json().catch(() => null)) as T;
}

async function executeNinoxQuery(query: string): Promise<void> {
  await fetchNinoxQueryResult(query);
}

async function fetchPlanRegelPersoneelIdsViaQuery(): Promise<Map<number, number>> {
  const result = await fetchNinoxQueryResult<unknown>(
    'let out := ""; for r in select PlanRegels do out := out + text(number(r)) + "|" + text(number(r.Personeel)) + "\\n" end; out'
  );
  const text = typeof result === 'string' ? result : '';
  const rows = text
    .replace(/\\n/g, '\n')
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean);

  const idsByPlanRegelId = new Map<number, number>();
  for (const row of rows) {
    const [planRegelIdRaw, personeelIdRaw] = row.split('|');
    const planRegelId = Number(String(planRegelIdRaw || '').trim());
    const personeelId = Number(String(personeelIdRaw || '').trim());
    if (!Number.isFinite(planRegelId) || !Number.isFinite(personeelId)) {
      continue;
    }
    idsByPlanRegelId.set(planRegelId, personeelId);
  }
  return idsByPlanRegelId;
}

async function linkUploadedFileToImageField(
  tableId: string,
  recordId: number,
  fieldName: string,
  uploadedFileName: string
): Promise<void> {
  // Fast path first: in many schemas this direct field assignment works immediately.
  const attempts: Array<Record<string, unknown>> = [
    { [fieldName]: uploadedFileName },
    { [fieldName]: [uploadedFileName] },
    { [fieldName]: { name: uploadedFileName } },
    { [fieldName]: { fileName: uploadedFileName } },
    { [fieldName]: { caption: uploadedFileName } },
  ];

  let lastError: unknown = null;
  for (const fields of attempts) {
    try {
      await updateNinoxRecord(tableId, recordId, fields);
      return;
    } catch (error) {
      lastError = error;
    }
  }

  // Fallback: use Ninox query-based linking only when direct assignment is rejected.
  const tableName = await fetchTableNameById(tableId);
  if (tableName) {
    const escapedTableName = escapeNinoxScriptString(tableName);
    const escapedFieldName = escapeNinoxScriptString(fieldName);
    const escapedFileName = escapeNinoxScriptString(uploadedFileName);
    const scriptAttempts = [
      `let r := first(select '${escapedTableName}' where Id = ${recordId}); if r then r.('${escapedFieldName}' := file(r, "${escapedFileName}")) end`,
      `let r := first(select ${escapedTableName} where Id = ${recordId}); if r then r.('${escapedFieldName}' := file(r, "${escapedFileName}")) end`,
    ];
    for (const query of scriptAttempts) {
      try {
        await executeNinoxQuery(query);
        return;
      } catch (error) {
        lastError = error;
      }
    }
  }

  // Keep upload success, but bubble linking failure for visibility.
  if (lastError instanceof Error) {
    throw new Error(`Document geupload, maar koppelen aan veld '${fieldName}' mislukt: ${lastError.message}`);
  }
  throw new Error(`Document geupload, maar koppelen aan veld '${fieldName}' mislukt.`);
}

export async function deleteNinoxVerkoopFactuur(id: number): Promise<void> {
  await deleteNinoxRecord(tableIds.facturenVerkoop, id);
}

export async function deleteNinoxInkoopFactuur(id: number): Promise<void> {
  await deleteNinoxRecord(tableIds.facturenInkoop, id);
}

export async function markeerNinoxInkoopFactuurBetaald(id: number): Promise<void> {
  const vandaag = todayIsoDate();
  const response = await request(`/tables/${tableIds.facturenInkoop}/records/${id}`);
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    const message = typeof errorPayload?.message === 'string' ? errorPayload.message : 'Onbekende Ninox fout';
    throw new Error(`Inkoopfactuur ophalen mislukt (${response.status}): ${message}`);
  }

  const record = (await response.json().catch(() => null)) as NinoxRecord | null;
  const fields = record?.fields ?? {};
  const totaal = Math.abs(asNumber(fields.Totaalbedrag, 0));
  const tableFields = await fetchNinoxTableFields(tableIds.facturenInkoop);
  const betaaldatumField = findFieldName(tableFields, ['Betaaldatum', 'Datum betaald']);
  const updateFields: Record<string, unknown> = {
    Betaald: totaal,
  };
  if (betaaldatumField) {
    updateFields[betaaldatumField] = vandaag;
  }

  await updateNinoxRecord(tableIds.facturenInkoop, id, updateFields);
}

export async function markeerNinoxVerkoopFactuurBetaald(id: number): Promise<void> {
  const vandaag = todayIsoDate();
  const response = await request(`/tables/${tableIds.facturenVerkoop}/records/${id}`);
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    const message = typeof errorPayload?.message === 'string' ? errorPayload.message : 'Onbekende Ninox fout';
    throw new Error(`Verkoopfactuur ophalen mislukt (${response.status}): ${message}`);
  }

  const record = (await response.json().catch(() => null)) as NinoxRecord | null;
  const fields = record?.fields ?? {};
  const totaal = Math.abs(asNumber(fields.Totaalbedrag, 0));
  const tableFields = await fetchNinoxTableFields(tableIds.facturenVerkoop);
  const betaaldatumField = findFieldName(tableFields, ['Betaaldatum', 'Datum betaald']);
  const updateFields: Record<string, unknown> = {
    Betaald: totaal,
  };
  if (betaaldatumField) {
    updateFields[betaaldatumField] = vandaag;
  }

  await updateNinoxRecord(tableIds.facturenVerkoop, id, updateFields);
}

function normalizeCompare(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '');
}

function findGrootboekIndexByRef(grootboekrekeningen: Grootboekrekening[], ref: string): number {
  const normalizedRef = normalizeCompare(ref);
  if (!normalizedRef) {
    return -1;
  }

  return grootboekrekeningen.findIndex((rekening) => {
    const nummerMatch = normalizeCompare(rekening.nummer) === normalizedRef;
    const naamMatch = normalizeCompare(rekening.naam) === normalizedRef;
    const idMatch = normalizeCompare(String(rekening.id)) === normalizedRef;
    return nummerMatch || naamMatch || idMatch;
  });
}

async function findGrootboekRecordIdByRef(ref: string): Promise<number | null> {
  return findRecordIdByRef(tableIds.grootboek, ref, [
    'Nummer',
    'Rekeningnummer',
    'Grootboeknummer',
    'Omschrijving',
    'Naam',
    'Grootboekomschrijving',
  ]);
}

function asLookupTexts(value: unknown): string[] {
  const texts = new Set<string>();
  const visit = (input: unknown) => {
    if (typeof input === 'string') {
      const trimmed = input.trim();
      if (trimmed) {
        texts.add(trimmed);
      }
      return;
    }
    if (typeof input === 'number' && Number.isFinite(input)) {
      texts.add(String(input));
      return;
    }
    if (Array.isArray(input)) {
      input.forEach(visit);
      return;
    }
    if (typeof input === 'object' && input !== null) {
      const obj = input as Record<string, unknown>;
      [obj.caption, obj.name, obj.text, obj.value, obj.id].forEach(visit);
    }
  };
  visit(value);
  return Array.from(texts);
}

async function findRecordIdByRef(tableId: string, ref: string, fieldCandidates: string[]): Promise<number | null> {
  const normalizedRef = normalizeCompare(ref);
  if (!normalizedRef) {
    return null;
  }
  const records = await fetchTableRecords(tableId, 500);
  for (const record of records) {
    if (normalizeCompare(String(record.id)) === normalizedRef) {
      return record.id;
    }
    const fields = record.fields ?? {};
    for (const candidate of fieldCandidates) {
      const value = fields[candidate];
      for (const text of asLookupTexts(value)) {
        if (normalizeCompare(text) === normalizedRef) {
          return record.id;
        }
      }
    }
  }
  return null;
}

async function fetchTableIdByName(tableName: string): Promise<string | null> {
  const response = await request('/tables');
  if (!response.ok) {
    return null;
  }

  const rawPayload = await response.json().catch(() => null);
  if (!rawPayload || !Array.isArray(rawPayload)) {
    return null;
  }

  const table = rawPayload.find((t: any) => normalizeCompare(String(t?.name ?? '')) === normalizeCompare(tableName));
  return table ? String(table?.id ?? '') : null;
}

async function requireMailBerichtenTableId(): Promise<string> {
  const tableId = await fetchTableIdByName('MailBerichten');
  if (!tableId) {
    throw new Error('Tabel MailBerichten niet gevonden.');
  }
  return tableId;
}

async function requireBerichtenTableId(): Promise<string> {
  const tableId = await fetchTableIdByName('Berichten');
  if (!tableId) {
    throw new Error('Tabel Berichten niet gevonden.');
  }
  return tableId;
}

async function requireTemplatesTableId(): Promise<string> {
  const tableId = (await fetchTableIdByName('MailTemplates')) || (await fetchTableIdByName('Templates'));
  if (!tableId) {
    throw new Error('Tabel MailTemplates niet gevonden.');
  }
  return tableId;
}

async function requireGebruikersTableId(): Promise<string> {
  const tableId = await fetchTableIdByName('Gebruikers');
  if (!tableId) {
    throw new Error('Tabel Gebruikers niet gevonden.');
  }
  return tableId;
}

function findFieldName(fields: NinoxTableField[], candidates: string[]): string | null {
  for (const candidate of candidates) {
    const match = fields.find((field) => normalizeCompare(field.name) === normalizeCompare(candidate));
    if (match) {
      return match.name;
    }
  }
  return null;
}

function resolveNinoxJaNeeValue(fields: NinoxTableField[], fieldName: string | null, value: boolean): unknown {
  if (!fieldName) {
    return value;
  }

  const field = fields.find((entry) => entry.name === fieldName);
  const fieldType = normalizeFieldSchemaKey(field?.type || '');
  if (fieldType.includes('bool')) {
    return value;
  }

  const choices = Array.isArray(field?.choices) ? field.choices : [];
  const targetCaption = value ? 'ja' : 'nee';
  const matchingChoice =
    choices.find((choice) => normalizeCompare(choice.caption) === targetCaption) ||
    choices.find((choice) => normalizeCompare(choice.id) === targetCaption);

  if (matchingChoice) {
    return matchingChoice.caption || matchingChoice.id;
  }

  return value ? 'Ja' : 'Nee';
}

function resolveChoiceCaptionValue(fields: NinoxTableField[], fieldName: string | null, rawValue: unknown): string {
  const direct =
    extractComparableText(rawValue).trim() ||
    asString(rawValue).trim();
  if (!fieldName || !direct) {
    return direct;
  }

  const field = fields.find((entry) => entry.name === fieldName);
  const choices = Array.isArray(field?.choices) ? field.choices : [];
  if (choices.length === 0) {
    return direct;
  }

  const normalizedDirect = normalizeCompare(direct);
  const match =
    choices.find((choice) => normalizeCompare(asString(choice.caption).trim()) === normalizedDirect) ||
    choices.find((choice) => normalizeCompare(asString(choice.id).trim()) === normalizedDirect);

  if (!match) {
    return direct;
  }

  return asString(match.caption).trim() || asString(match.id).trim() || direct;
}

function resolveChoiceCaptionListValue(
  fields: NinoxTableField[],
  fieldName: string | null,
  rawValue: unknown,
  depth = 0
): string {
  if (depth > 5) {
    return '';
  }

  const field = fieldName ? fields.find((entry) => entry.name === fieldName) : null;
  const choices = Array.isArray(field?.choices) ? field.choices : [];
  const choiceLabelsByKey = new Map<string, string>();

  for (const choice of choices) {
    const caption = asString(choice.caption).trim();
    const id = asString(choice.id).trim();
    if (caption) {
      choiceLabelsByKey.set(normalizeCompare(caption), caption);
    }
    if (id) {
      choiceLabelsByKey.set(normalizeCompare(id), caption || id);
    }
  }

  const resolveSingle = (value: unknown): string[] => {
    const direct = asPrimitiveString(value).trim();
    if (!direct) {
      return [];
    }

    const directMatch = choiceLabelsByKey.get(normalizeCompare(direct));
    if (directMatch) {
      return [directMatch];
    }

    if ((direct.includes(',') || direct.includes(';')) && choiceLabelsByKey.size > 0) {
      return direct
        .split(/[;,]/)
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => choiceLabelsByKey.get(normalizeCompare(part)) || part);
    }

    return [direct];
  };

  const flatten = (value: unknown, currentDepth: number): string[] => {
    if (currentDepth > 5 || value === null || value === undefined) {
      return [];
    }

    const direct = resolveSingle(value);
    if (direct.length > 0) {
      return direct;
    }

    if (Array.isArray(value)) {
      return value.flatMap((item) => flatten(item, currentDepth + 1));
    }

    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      const preferredCandidates = [obj.values, obj.items, obj.selections, obj.selected];
      for (const candidate of preferredCandidates) {
        const nested = flatten(candidate, currentDepth + 1);
        if (nested.length > 0) {
          return nested;
        }
      }

      const directCandidates = [obj.caption, obj.label, obj.name, obj.text, obj.value, obj.id];
      const directResolved = directCandidates.flatMap((candidate) => resolveSingle(candidate));
      if (directResolved.length > 0) {
        return directResolved;
      }
    }

    return [];
  };

  const result: string[] = [];
  for (const item of flatten(rawValue, depth)) {
    if (!item) {
      continue;
    }
    if (!result.some((existing) => normalizeCompare(existing) === normalizeCompare(item))) {
      result.push(item);
    }
  }

  return result.join(', ');
}

function isServerErrorWithStatus(error: unknown, status: number): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    typeof (error as { statusCode?: unknown }).statusCode === 'number' &&
    (error as { statusCode: number }).statusCode === status
  );
}

export async function fetchNinoxMailBerichten(): Promise<MailBericht[]> {
  const tableId = await requireMailBerichtenTableId();
  const records = await fetchTableRecords(tableId, 500);
  const mapped = records.map(mapMailBericht);
  const sorted = [...mapped].sort((a, b) => {
    const tsA = parseMailDatumToTimestamp(a.datum);
    const tsB = parseMailDatumToTimestamp(b.datum);
    if (tsA !== null && tsB !== null) {
      return tsB - tsA;
    }
    return b.datum.localeCompare(a.datum);
  });

  const keepCount = 10;
  const teVerwijderen = sorted.slice(keepCount);
  if (teVerwijderen.length > 0) {
    await Promise.allSettled(teVerwijderen.map((bericht) => deleteNinoxRecord(tableId, bericht.id)));
  }

  return sorted.slice(0, keepCount);
}

export async function fetchNinoxBerichten(): Promise<MailBericht[]> {
  const tableId = await requireBerichtenTableId();
  const records = await fetchTableRecords(tableId, 500);
  const mapped = records.map(mapMailBericht);

  return mapped.sort((a, b) => {
    const tsA = parseMailDatumToTimestamp(a.datum);
    const tsB = parseMailDatumToTimestamp(b.datum);
    if (tsA !== null && tsB !== null) {
      return tsB - tsA;
    }
    return b.datum.localeCompare(a.datum);
  });
}

export async function fetchNinoxMailTemplates(): Promise<MailTemplate[]> {
  const tableId = await requireTemplatesTableId();

  const records = await fetchTableRecords(tableId, 500);
  const mapped = records.map((record) => {
    const fields = record.fields ?? {};
    const titel =
      asString(fields.Titel).trim() ||
      asString(fields.Onderwerp).trim() ||
      asString(fields.Naam).trim() ||
      `Template ${record.id}`;
    const template =
      asRichTextHtml(fields.Template).trim() ||
      asRichTextHtml(fields.Inhoud).trim() ||
      asRichTextHtml(fields.Tekst).trim() ||
      '';
    return {
      id: record.id,
      titel,
      template,
      hasDocument: hasDocumentValue(fields.Document),
    } satisfies MailTemplate;
  });

  return mapped.sort((a, b) => a.titel.localeCompare(b.titel, 'nl', { sensitivity: 'base', numeric: true }));
}

export async function fetchNinoxAfsprakenEnContracten(): Promise<AfspraakContract[]> {
  const [afsprakenTableId, relatiesTableId] = await Promise.all([
    fetchTableIdByName('AfsprakenContracten'),
    fetchTableIdByName('Relaties'),
  ]);

  if (!afsprakenTableId) {
    throw new Error('Tabel AfsprakenContracten niet gevonden.');
  }

  const [afsprakenRecords, afsprakenFields, relatieRecords, relatieFields] = await Promise.all([
    fetchTableRecords(afsprakenTableId, 500),
    fetchNinoxTableFields(afsprakenTableId),
    relatiesTableId ? fetchTableRecords(relatiesTableId, 500) : Promise.resolve([] as NinoxRecord[]),
    relatiesTableId ? fetchNinoxTableFields(relatiesTableId) : Promise.resolve([] as NinoxTableField[]),
  ]);

  const relatieField = findFieldName(afsprakenFields, ['Relaties', 'Relatie']) || 'Relaties';
  const onderdeelField = findFieldName(afsprakenFields, ['Onderdeel']) || 'Onderdeel';
  const opmerkingenField = findFieldName(afsprakenFields, ['Opmerkingen', 'Opmerking', 'Memo']) || 'Opmerkingen';
  const relatieNaamField =
    findFieldName(relatieFields, ['Naam relatie', 'Naam', 'Bedrijf', 'Relatie', 'Titel']) || 'Naam relatie';

  const relatieNaamById = new Map<number, string>();
  for (const record of relatieRecords) {
    const fields = record.fields ?? {};
    const naam =
      asString(fields[relatieNaamField]).trim() ||
      asString(fields.Naam).trim() ||
      asString(fields.Bedrijf).trim() ||
      `Relatie ${record.id}`;
    relatieNaamById.set(record.id, naam);
  }

  return afsprakenRecords
    .map((record) => {
      const fields = record.fields ?? {};
      const relatieRaw = fields[relatieField];
      const relatieId = extractLinkedRecordId(relatieRaw) ?? undefined;
      const relatieTekst =
        (relatieId ? relatieNaamById.get(relatieId) : '') ||
        extractComparableText(relatieRaw).trim() ||
        asString(relatieRaw).trim() ||
        '-';
      const onderdeel = asString(fields[onderdeelField]).trim() || '-';
      const opmerkingen = asString(fields[opmerkingenField]).trim();

      return {
        id: record.id,
        relatieId,
        relatie: relatieTekst,
        onderdeel,
        opmerkingen,
      } satisfies AfspraakContract;
    })
    .sort((a, b) => {
      const relatieCompare = a.relatie.localeCompare(b.relatie, 'nl', { sensitivity: 'base', numeric: true });
      if (relatieCompare !== 0) {
        return relatieCompare;
      }
      return a.onderdeel.localeCompare(b.onderdeel, 'nl', { sensitivity: 'base', numeric: true });
    });
}

export async function fetchNinoxAfsprakenEnContractenVoorRelatie(relatieId: number): Promise<AfspraakContract[]> {
  if (!Number.isFinite(relatieId) || relatieId <= 0) {
    return [];
  }

  const [afsprakenTableId, relatiesTableId] = await Promise.all([
    fetchTableIdByName('AfsprakenContracten'),
    fetchTableIdByName('Relaties'),
  ]);

  if (!afsprakenTableId) {
    throw new Error('Tabel AfsprakenContracten niet gevonden.');
  }

  const [afsprakenFields, relatieRecords, relatieFields] = await Promise.all([
    fetchNinoxTableFields(afsprakenTableId),
    relatiesTableId ? fetchTableRecords(relatiesTableId, 500) : Promise.resolve([] as NinoxRecord[]),
    relatiesTableId ? fetchNinoxTableFields(relatiesTableId) : Promise.resolve([] as NinoxTableField[]),
  ]);
  const relatieField = findFieldName(afsprakenFields, ['Relaties', 'Relatie']) || 'Relaties';
  const relatieFieldNames = ['Relaties', 'Relatie', relatieField];
  const afsprakenRecords = await fetchTableRecordsFiltered(afsprakenTableId, { [relatieField]: relatieId }, 500);
  const onderdeelField = findFieldName(afsprakenFields, ['Onderdeel']) || 'Onderdeel';
  const opmerkingenField = findFieldName(afsprakenFields, ['Opmerkingen', 'Opmerking', 'Memo']) || 'Opmerkingen';
  const relatieNaamField =
    findFieldName(relatieFields, ['Naam relatie', 'Naam', 'Bedrijf', 'Relatie', 'Titel']) || 'Naam relatie';

  const relatieNaamById = new Map<number, string>();
  for (const record of relatieRecords) {
    const fields = record.fields ?? {};
    const naam =
      asString(fields[relatieNaamField]).trim() ||
      asString(fields.Naam).trim() ||
      asString(fields.Bedrijf).trim() ||
      `Relatie ${record.id}`;
    relatieNaamById.set(record.id, naam);
  }
  return afsprakenRecords
    .map((record) => {
      const fields = record.fields ?? {};
      const relatieRaw = getNinoxRecordValue(record, relatieFieldNames);
      const gevondenRelatieId = getNinoxLinkedRecordIdFromRecord(record, relatieFieldNames) ?? relatieId;
      const relatieTekst =
        relatieNaamById.get(gevondenRelatieId) ||
        extractComparableText(relatieRaw).trim() ||
        asString(relatieRaw).trim() ||
        '-';
      const onderdeel = asString(fields[onderdeelField]).trim() || '-';
      const opmerkingen = asString(fields[opmerkingenField]).trim();

      return {
        id: record.id,
        relatieId: gevondenRelatieId,
        relatie: relatieTekst,
        onderdeel,
        opmerkingen,
      } satisfies AfspraakContract;
    })
    .sort((a, b) => {
      const relatieCompare = a.relatie.localeCompare(b.relatie, 'nl', { sensitivity: 'base', numeric: true });
      if (relatieCompare !== 0) {
        return relatieCompare;
      }
      return a.onderdeel.localeCompare(b.onderdeel, 'nl', { sensitivity: 'base', numeric: true });
    });
}

export async function fetchNinoxAfsprakenContractBlokkenVoorRelatie(relatieId: number): Promise<{
  afspraakIds: number[];
  dossierItems: DossierItem[];
  inkoopItems: InkoopopdrachtItem[];
  prijsItems: PrijsafspraakItem[];
  debugRelatiesValues: string[];
}> {
  if (!Number.isFinite(relatieId) || relatieId <= 0) {
    return {
      afspraakIds: [],
      dossierItems: [],
      inkoopItems: [],
      prijsItems: [],
      debugRelatiesValues: [],
    };
  }

  const [afsprakenTableId, dossierTableId, inkoopTableId, prijsTableId, artikelenTableId, relatiesTableId] = await Promise.all([
    fetchTableIdByName('AfsprakenContracten'),
    fetchTableIdByName('Dossier'),
    fetchTableIdByName('Inkoopopdrachten'),
    fetchTableIdByName('Prijsafspraken'),
    fetchTableIdByName('Artikelen'),
    fetchTableIdByName('Relaties'),
  ]);

  if (!afsprakenTableId) {
    throw new Error('Tabel AfsprakenContracten niet gevonden.');
  }
  if (!dossierTableId) {
    throw new Error('Tabel Dossier niet gevonden.');
  }
  if (!inkoopTableId) {
    throw new Error('Tabel Inkoopopdrachten niet gevonden.');
  }
  if (!prijsTableId) {
    throw new Error('Tabel Prijsafspraken niet gevonden.');
  }
  if (!artikelenTableId) {
    throw new Error('Tabel Artikelen niet gevonden.');
  }

  const [afsprakenFields, relatieRecords, relatieFields, dossierFields, inkoopFields, prijsFields, artikelenRecords, artikelenFields] =
    await Promise.all([
      fetchNinoxTableFields(afsprakenTableId),
      relatiesTableId ? fetchTableRecords(relatiesTableId, 500) : Promise.resolve([] as NinoxRecord[]),
      relatiesTableId ? fetchNinoxTableFields(relatiesTableId) : Promise.resolve([] as NinoxTableField[]),
      fetchNinoxTableFields(dossierTableId),
      fetchNinoxTableFields(inkoopTableId),
      fetchNinoxTableFields(prijsTableId),
      fetchTableRecords(artikelenTableId, 2000),
      fetchNinoxTableFields(artikelenTableId),
    ]);

  const relatieField = findFieldName(afsprakenFields, ['Relaties', 'Relatie']) || 'Relaties';
  const relatieFieldNames = ['Relaties', 'Relatie', relatieField];
  const afsprakenRecords = await fetchTableRecordsFiltered(afsprakenTableId, { [relatieField]: relatieId }, 500);
  const relatieNaamField =
    findFieldName(relatieFields, ['Naam relatie', 'Naam', 'Bedrijf', 'Relatie', 'Titel']) || 'Naam relatie';
  const relatieNaamById = new Map<number, string>();
  for (const record of relatieRecords) {
    const fields = record.fields ?? {};
    const naam =
      asString(fields[relatieNaamField]).trim() ||
      asString(fields.Naam).trim() ||
      asString(fields.Bedrijf).trim() ||
      `Relatie ${record.id}`;
    relatieNaamById.set(record.id, naam);
  }
  const debugRelatiesValues = afsprakenRecords.slice(0, 12).map((record) => {
    const fieldValue = record.fields?.Relaties ?? record.fields?.Relatie ?? record.fields?.[relatieField];
    const resolvedId = getNinoxLinkedRecordIdFromRecord(record, relatieFieldNames);
    let fieldSerialized = '';
    try {
      fieldSerialized = JSON.stringify(fieldValue);
    } catch {
      fieldSerialized = String(fieldValue ?? '');
    }
    return `record ${record.id}: recordId=${record.id} | resolvedId=${resolvedId ?? '-'} | field=${fieldSerialized}`;
  });
  const afspraakIds = afsprakenRecords.map((record) => record.id);

  if (afspraakIds.length === 0) {
    return {
      afspraakIds: [],
      dossierItems: [],
      inkoopItems: [],
      prijsItems: [],
      debugRelatiesValues,
    };
  }

  const afspraakIdSet = new Set(afspraakIds);
  const matchesAfspraakRecord = (record: NinoxRecord, fieldNames: string[]): boolean => {
    const linkedId = getNinoxLinkedRecordIdFromRecord(record, fieldNames);
    return linkedId !== null && afspraakIdSet.has(linkedId);
  };

  const dossierHoofdLinkField =
    findFieldName(dossierFields, ['AfsprakenContracten', 'Afspraken Contracten', 'AfsprakenContract']) || 'AfsprakenContracten';
  const dossierHoofdLinkFieldNames = ['AfsprakenContracten', 'Afspraken Contracten', 'AfsprakenContract', dossierHoofdLinkField];
  const dossierTypeDocumentField = findFieldName(dossierFields, ['Type document', 'Typedocument', 'Document type']) || 'Type document';
  const dossierOmschrijvingField = findFieldName(dossierFields, ['Omschrijving', 'Titel', 'Naam']) || 'Omschrijving';
  const dossierExtraInformatieField =
    findFieldName(dossierFields, ['Extra informatie', 'Extra info', 'Informatie', 'Opmerkingen']) || 'Extra informatie';
  const dossierStartdatumField = findFieldName(dossierFields, ['Startdatum', 'Start datum', 'Datum start']) || 'Startdatum';
  const dossierEinddatumField = findFieldName(dossierFields, ['Einddatum', 'Eind datum', 'Datum eind']) || 'Einddatum';

  const [dossierRecords, inkoopRecords, prijsRecords] = await Promise.all([
    fetchTableRecords(dossierTableId, 2000),
    fetchTableRecords(inkoopTableId, 2000),
    fetchTableRecords(prijsTableId, 2000),
  ]);

  const dossierItems = dossierRecords
    .filter((record) => matchesAfspraakRecord(record, dossierHoofdLinkFieldNames))
    .map((record) => {
      const fields = record.fields ?? {};
      return {
        id: record.id,
        typeDocument: resolveChoiceCaptionValue(dossierFields, dossierTypeDocumentField, fields[dossierTypeDocumentField]),
        omschrijving: asString(fields[dossierOmschrijvingField]).trim() || '',
        extraInformatie: asString(fields[dossierExtraInformatieField]).trim() || '',
        startdatum: extractComparableText(fields[dossierStartdatumField]).trim() || asString(fields[dossierStartdatumField]).trim() || '',
        einddatum: extractComparableText(fields[dossierEinddatumField]).trim() || asString(fields[dossierEinddatumField]).trim() || '',
      } satisfies DossierItem;
    });

  const inkoopHoofdLinkField =
    findFieldName(inkoopFields, ['AfsprakenContracten', 'Afspraken Contracten', 'AfsprakenContract']) || 'AfsprakenContracten';
  const inkoopHoofdLinkFieldNames = ['AfsprakenContracten', 'Afspraken Contracten', 'AfsprakenContract', inkoopHoofdLinkField];
  const inkoopOmschrijvingField = findFieldName(inkoopFields, ['Omschrijving', 'Titel', 'Naam']) || 'Omschrijving';
  const inkoopExtraInformatieField =
    findFieldName(inkoopFields, ['Extra informatie', 'Extra info', 'Informatie', 'Opmerkingen']) || 'Extra informatie';
  const inkoopStartdatumField = findFieldName(inkoopFields, ['Startdatum', 'Start datum', 'Datum start']) || 'Startdatum';
  const inkoopEinddatumField = findFieldName(inkoopFields, ['Einddatum', 'Eind datum', 'Datum eind']) || 'Einddatum';

  const inkoopItems = inkoopRecords
    .filter((record) => matchesAfspraakRecord(record, inkoopHoofdLinkFieldNames))
    .map((record) => {
      const fields = record.fields ?? {};
      return {
        id: record.id,
        omschrijving: asString(fields[inkoopOmschrijvingField]).trim() || '',
        extraInformatie: asString(fields[inkoopExtraInformatieField]).trim() || '',
        startdatum: extractComparableText(fields[inkoopStartdatumField]).trim() || asString(fields[inkoopStartdatumField]).trim() || '',
        einddatum: extractComparableText(fields[inkoopEinddatumField]).trim() || asString(fields[inkoopEinddatumField]).trim() || '',
      } satisfies InkoopopdrachtItem;
    });

  const prijsHoofdLinkField =
    findFieldName(prijsFields, ['AfsprakenContracten', 'Afspraken Contracten', 'AfsprakenContract']) || 'AfsprakenContracten';
  const prijsHoofdLinkFieldNames = ['AfsprakenContracten', 'Afspraken Contracten', 'AfsprakenContract', prijsHoofdLinkField];
  const prijsArtikelField = findFieldName(prijsFields, ['Artikel', 'Artikelnummer', 'Artikel nummer']) || 'Artikel';
  const prijsWaardeField = findFieldName(prijsFields, ['Prijs', 'Bedrag', 'Prijs per eenheid']) || 'Prijs';
  const prijsEenheidField = findFieldName(prijsFields, ['Eenheid', 'Per', 'Prijs per']) || 'Eenheid';
  const prijsStartdatumField = findFieldName(prijsFields, ['Startdatum', 'Start datum', 'Datum start']) || 'Startdatum';
  const prijsEinddatumField = findFieldName(prijsFields, ['Einddatum', 'Eind datum', 'Datum eind']) || 'Einddatum';
  const artikelOmschrijvingField = findFieldName(artikelenFields, ['Omschrijving', 'Naam', 'Titel']) || 'Omschrijving';

  const artikelOmschrijvingById = new Map<number, string>();
  for (const record of artikelenRecords) {
    const fields = record.fields ?? {};
    const omschrijving = asString(fields[artikelOmschrijvingField]).trim();
    if (omschrijving) {
      artikelOmschrijvingById.set(record.id, omschrijving);
    }
  }

  const prijsItems = prijsRecords
    .filter((record) => matchesAfspraakRecord(record, prijsHoofdLinkFieldNames))
    .map((record) => {
      const fields = record.fields ?? {};
      const artikelValue = fields[prijsArtikelField];
      const artikelId = extractLinkedRecordId(artikelValue);
      const artikelTekst =
        (artikelId ? artikelOmschrijvingById.get(artikelId) || '' : '') ||
        extractComparableText(artikelValue).trim() ||
        asString(artikelValue).trim() ||
        '';
      return {
        id: record.id,
        artikel: artikelTekst,
        prijs: asNumber(fields[prijsWaardeField], 0),
        eenheid: resolveChoiceCaptionValue(prijsFields, prijsEenheidField, fields[prijsEenheidField]),
        startdatum: extractComparableText(fields[prijsStartdatumField]).trim() || asString(fields[prijsStartdatumField]).trim() || '',
        einddatum: extractComparableText(fields[prijsEinddatumField]).trim() || asString(fields[prijsEinddatumField]).trim() || '',
      } satisfies PrijsafspraakItem;
    });

  return {
    afspraakIds,
    dossierItems,
    inkoopItems,
    prijsItems,
    debugRelatiesValues,
  };
}

async function resolveAfsprakenEnContractenFieldNames(tableId: string): Promise<{
  relatie: string | null;
  relatieNaam: string | null;
  onderdeel: string;
  opmerkingen: string | null;
}> {
  const tableFields = await fetchNinoxTableFields(tableId);
  return {
    relatie: findFieldName(tableFields, ['Relaties', 'Relatie']),
    relatieNaam: findFieldName(tableFields, ['Naam relatie', 'Relatie naam', 'Relatie']),
    onderdeel: findFieldName(tableFields, ['Onderdeel']) || 'Onderdeel',
    opmerkingen: findFieldName(tableFields, ['Opmerkingen', 'Opmerking', 'Memo']),
  };
}

export async function fetchNinoxRelatiesLookup(): Promise<NinoxLookupOption[]> {
  const tableId = await fetchTableIdByName('Relaties');
  if (!tableId) {
    throw new Error('Tabel Relaties niet gevonden.');
  }

  const tableFields = await fetchNinoxTableFields(tableId);
  const naamField = findFieldName(tableFields, ['Naam relatie', 'Naam', 'Bedrijf', 'Relatie', 'Titel']) || 'Naam relatie';
  const kvkField = findFieldName(tableFields, ['Kvk', 'KvK', 'Kvk-nummer', 'KvK-nummer', 'Kvknummer', 'KvKnummer']);

  const records = await fetchTableRecords(tableId, 500);
  return records
    .map((record) => {
      const fields = record.fields ?? {};
      const label =
        asString(fields[naamField]).trim() ||
        asString(fields.Naam).trim() ||
        asString(fields.Bedrijf).trim() ||
        extractComparableText(Object.values(fields)[0]).trim() ||
        `Relatie ${record.id}`;
      const kvk = kvkField ? asString(fields[kvkField]).trim() : '';
      return {
        id: String(record.id),
        label,
        subtitle: kvk ? `- ${kvk}` : undefined,
      } satisfies NinoxLookupOption;
    })
    .filter((option) => option.id && option.label)
    .sort((a, b) => a.label.localeCompare(b.label, 'nl', { sensitivity: 'base', numeric: true }));
}

export async function fetchNinoxArtikelenLookup(): Promise<NinoxLookupOption[]> {
  const tableId = await fetchTableIdByName('Artikelen');
  if (!tableId) {
    throw new Error('Tabel Artikelen niet gevonden.');
  }

  const [records, tableFields] = await Promise.all([fetchTableRecords(tableId, 2000), fetchNinoxTableFields(tableId)]);
  const omschrijvingField = findFieldName(tableFields, ['Omschrijving', 'Naam', 'Titel']) || 'Omschrijving';

  return records
    .map((record) => {
      const fields = record.fields ?? {};
      const label = asString(fields[omschrijvingField]).trim();
      return {
        id: String(record.id),
        label,
      } satisfies NinoxLookupOption;
    })
    .filter((option) => option.id && option.label)
    .sort((a, b) => a.label.localeCompare(b.label, 'nl', { sensitivity: 'base', numeric: true }));
}

export async function fetchNinoxPrijsafsprakenEenheidOpties(): Promise<string[]> {
  const tableId = await fetchTableIdByName('Prijsafspraken');
  if (!tableId) {
    throw new Error('Tabel Prijsafspraken niet gevonden.');
  }

  const rawValues = await fetchRawChoiceValuesInFieldOrder(tableId, ['Eenheid', 'Per', 'Prijs per']);
  if (rawValues.length > 0) {
    return rawValues;
  }

  const tableFields = await fetchNinoxTableFields(tableId);
  const target =
    tableFields.find((field) => normalizeCompare(field.name) === normalizeCompare('Eenheid')) ||
    tableFields.find((field) => normalizeCompare(field.name) === normalizeCompare('Per')) ||
    tableFields.find((field) => normalizeCompare(field.name) === normalizeCompare('Prijs per'));

  if (!target || !Array.isArray(target.choices) || target.choices.length === 0) {
    return [];
  }

  return target.choices
    .map((choice) => asString(choice.caption).trim() || asString(choice.id).trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'nl', { sensitivity: 'base', numeric: true }));
}

export async function fetchNinoxDossierVoorAfspraakContract(afspraakContractId: number): Promise<DossierItem[]> {
  if (!Number.isFinite(afspraakContractId) || afspraakContractId <= 0) {
    return [];
  }

  const tableId = await fetchTableIdByName('Dossier');
  if (!tableId) {
    throw new Error('Tabel Dossier niet gevonden.');
  }

  const tableFields = await fetchNinoxTableFields(tableId);
  const hoofdLinkField = findFieldName(tableFields, ['AfsprakenContracten', 'Afspraken Contracten', 'AfsprakenContract']) || 'AfsprakenContracten';
  const records = await fetchTableRecordsFiltered(tableId, { [hoofdLinkField]: afspraakContractId }, 2000);
  const typeDocumentField = findFieldName(tableFields, ['Type document', 'Typedocument', 'Document type']) || 'Type document';
  const omschrijvingField = findFieldName(tableFields, ['Omschrijving', 'Titel', 'Naam']) || 'Omschrijving';
  const extraInformatieField =
    findFieldName(tableFields, ['Extra informatie', 'Extra info', 'Informatie', 'Opmerkingen']) || 'Extra informatie';
  const startdatumField = findFieldName(tableFields, ['Startdatum', 'Start datum', 'Datum start']) || 'Startdatum';
  const einddatumField = findFieldName(tableFields, ['Einddatum', 'Eind datum', 'Datum eind']) || 'Einddatum';

  return records
    .map((record) => {
      const fields = record.fields ?? {};
      return {
        id: record.id,
        typeDocument: resolveChoiceCaptionValue(tableFields, typeDocumentField, fields[typeDocumentField]),
        omschrijving: asString(fields[omschrijvingField]).trim() || '',
        extraInformatie: asString(fields[extraInformatieField]).trim() || '',
        startdatum: extractComparableText(fields[startdatumField]).trim() || asString(fields[startdatumField]).trim() || '',
        einddatum: extractComparableText(fields[einddatumField]).trim() || asString(fields[einddatumField]).trim() || '',
      } satisfies DossierItem;
    })
    .sort((a, b) => {
      const typeCompare = (a.typeDocument || '').localeCompare(b.typeDocument || '', 'nl', { sensitivity: 'base', numeric: true });
      if (typeCompare !== 0) {
        return typeCompare;
      }
      return (a.omschrijving || '').localeCompare(b.omschrijving || '', 'nl', { sensitivity: 'base', numeric: true });
    });
}

async function resolveDossierFieldNames(tableId: string): Promise<{
  typeDocument: string | null;
  omschrijving: string;
  extraInformatie: string | null;
  startdatum: string | null;
  einddatum: string | null;
  document: string | null;
}> {
  const tableFields = await fetchNinoxTableFields(tableId);
  return {
    typeDocument: findFieldName(tableFields, ['Type document', 'Typedocument', 'Document type']),
    omschrijving: findFieldName(tableFields, ['Omschrijving', 'Titel', 'Naam']) || 'Omschrijving',
    extraInformatie: findFieldName(tableFields, ['Extra informatie', 'Extra info', 'Informatie', 'Opmerkingen']),
    startdatum: findFieldName(tableFields, ['Startdatum', 'Start datum', 'Datum start']),
    einddatum: findFieldName(tableFields, ['Einddatum', 'Eind datum', 'Datum eind']),
    document: findFieldName(tableFields, ['Document', 'Document - 01', 'Bestand', 'PDF', 'Bijlage']),
  };
}

export async function fetchNinoxDossierTypeDocumentOpties(): Promise<string[]> {
  const tableId = await fetchTableIdByName('Dossier');
  if (!tableId) {
    throw new Error('Tabel Dossier niet gevonden.');
  }

  const rawValues = await fetchRawChoiceValuesInFieldOrder(tableId, ['Type document', 'Typedocument', 'Document type']);
  if (rawValues.length > 0) {
    return rawValues;
  }

  const tableFields = await fetchNinoxTableFields(tableId);
  const target =
    tableFields.find((field) => normalizeCompare(field.name) === normalizeCompare('Type document')) ||
    tableFields.find((field) => normalizeCompare(field.name) === normalizeCompare('Typedocument')) ||
    tableFields.find((field) => normalizeCompare(field.name) === normalizeCompare('Document type'));

  if (!target || !Array.isArray(target.choices) || target.choices.length === 0) {
    return [];
  }

  return target.choices
    .map((choice) => asString(choice.caption).trim() || asString(choice.id).trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'nl', { sensitivity: 'base', numeric: true }));
}

export async function updateNinoxDossier(
  id: number,
  input: { typeDocument: string; omschrijving: string; extraInformatie: string; startdatum: string; einddatum: string }
): Promise<void> {
  const tableId = await fetchTableIdByName('Dossier');
  if (!tableId) {
    throw new Error('Tabel Dossier niet gevonden.');
  }

  const names = await resolveDossierFieldNames(tableId);
  const payload: Record<string, unknown> = {
    [names.omschrijving]: input.omschrijving.trim(),
  };
  if (names.typeDocument) {
    payload[names.typeDocument] = input.typeDocument.trim();
  }
  if (names.extraInformatie) {
    payload[names.extraInformatie] = input.extraInformatie.trim();
  }
  if (names.startdatum) {
    payload[names.startdatum] = input.startdatum.trim();
  }
  if (names.einddatum) {
    payload[names.einddatum] = input.einddatum.trim();
  }

  await updateNinoxRecord(tableId, id, payload);
}

export async function createNinoxDossier(input: {
  afspraakContractId: number;
  typeDocument: string;
  omschrijving: string;
  extraInformatie: string;
  startdatum: string;
  einddatum: string;
}): Promise<number> {
  const tableId = await fetchTableIdByName('Dossier');
  if (!tableId) {
    throw new Error('Tabel Dossier niet gevonden.');
  }

  const tableFields = await fetchNinoxTableFields(tableId);
  const hoofdLinkField =
    findFieldName(tableFields, ['AfsprakenContracten', 'Afspraken Contracten', 'AfsprakenContract']) || 'AfsprakenContracten';
  const names = await resolveDossierFieldNames(tableId);
  const payload: Record<string, unknown> = {
    [hoofdLinkField]: input.afspraakContractId,
    [names.omschrijving]: input.omschrijving.trim(),
  };
  if (names.typeDocument) {
    payload[names.typeDocument] = input.typeDocument.trim();
  }
  if (names.extraInformatie) {
    payload[names.extraInformatie] = input.extraInformatie.trim();
  }
  if (names.startdatum) {
    payload[names.startdatum] = input.startdatum.trim();
  }
  if (names.einddatum) {
    payload[names.einddatum] = input.einddatum.trim();
  }

  return createNinoxRecord(tableId, payload);
}

export async function deleteNinoxDossier(id: number): Promise<void> {
  const tableId = await fetchTableIdByName('Dossier');
  if (!tableId) {
    throw new Error('Tabel Dossier niet gevonden.');
  }

  await deleteNinoxRecord(tableId, id);
}

export async function uploadNinoxDossierDocument(recordId: number, file: File): Promise<void> {
  const tableId = await fetchTableIdByName('Dossier');
  if (!tableId) {
    throw new Error('Tabel Dossier niet gevonden.');
  }

  await uploadNinoxRecordDocument(tableId, recordId, file, 'Document');
}

export async function clearNinoxDossierDocument(recordId: number): Promise<void> {
  const tableId = await fetchTableIdByName('Dossier');
  if (!tableId) {
    throw new Error('Tabel Dossier niet gevonden.');
  }

  const listNames = await fetchRecordFileNames(tableId, recordId);
  const linkedName = await resolveLinkedFileNameForField(tableId, recordId, 'Document', listNames);

  const clearAttempts: Array<Record<string, unknown>> = [
    { Document: '' },
    { Document: null },
    { Document: [] },
  ];
  let cleared = false;
  let lastError: unknown = null;
  for (const fields of clearAttempts) {
    try {
      await updateNinoxRecord(tableId, recordId, fields);
      cleared = true;
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!cleared) {
    throw lastError instanceof Error ? lastError : new Error('Veld "Document" leegmaken mislukt.');
  }

  if (!linkedName) {
    return;
  }
  const deleteResponse = await request(`/tables/${tableId}/records/${recordId}/files/${encodeURIComponent(linkedName)}`, {
    method: 'DELETE',
  });
  if (!deleteResponse.ok && deleteResponse.status !== 404) {
    const errorPayload = await deleteResponse.json().catch(() => ({}));
    const message = typeof errorPayload?.message === 'string' ? errorPayload.message : 'Onbekende Ninox fout';
    throw new Error(`PDF verwijderen mislukt (${deleteResponse.status}): ${message}`);
  }
}

export async function fetchNinoxDossierDocument(recordId: number): Promise<NinoxRecordDocument | null> {
  const fetchBinaryOrWrapped = async (path: string): Promise<Blob | null> => {
    const response = await request(path, {
      headers: {
        Accept: 'application/pdf,application/octet-stream,*/*',
      },
    });
    if (!response.ok) {
      return null;
    }
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('application/pdf') || contentType.includes('application/octet-stream')) {
      const blob = await response.blob();
      return blob.size > 0 ? blob : null;
    }
    const wrapped = await response.json().catch(() => null);
    const wrappedBase64 =
      typeof wrapped?.bodyBase64 === 'string'
        ? wrapped.bodyBase64
        : typeof wrapped?.base64 === 'string'
        ? wrapped.base64
        : '';
    const wrappedContentType =
      typeof wrapped?.contentType === 'string' && wrapped.contentType.trim() ? wrapped.contentType : 'application/pdf';
    if (!wrappedBase64) {
      return null;
    }
    const blob = base64ToBlob(wrappedBase64, wrappedContentType);
    return blob && blob.size > 0 ? blob : null;
  };

  const tableId = await fetchTableIdByName('Dossier');
  if (!tableId) {
    throw new Error('Tabel Dossier niet gevonden.');
  }

  const listResponse = await request(`/tables/${tableId}/records/${recordId}/files`);
  if (!listResponse.ok) {
    return null;
  }
  const payload = await listResponse.json().catch(() => []);
  if (!Array.isArray(payload) || payload.length === 0) {
    return null;
  }

  const fileNames = payload
    .map((item) => asString((item as { name?: unknown })?.name).trim())
    .filter((name) => Boolean(name));
  if (fileNames.length === 0) {
    return null;
  }

  const candidateName = await resolveLinkedFileNameForField(tableId, recordId, 'Document', fileNames);
  if (!candidateName) {
    return null;
  }
  const blob = await fetchBinaryOrWrapped(`/tables/${tableId}/records/${recordId}/files/${encodeURIComponent(candidateName)}`);
  if (!blob) {
    return null;
  }
  return { naam: candidateName, blob };
}

export async function fetchNinoxInkoopopdrachtenVoorAfspraakContract(
  afspraakContractId: number
): Promise<InkoopopdrachtItem[]> {
  if (!Number.isFinite(afspraakContractId) || afspraakContractId <= 0) {
    return [];
  }

  const tableId = await fetchTableIdByName('Inkoopopdrachten');
  if (!tableId) {
    throw new Error('Tabel Inkoopopdrachten niet gevonden.');
  }

  const tableFields = await fetchNinoxTableFields(tableId);
  const hoofdLinkField = findFieldName(tableFields, ['AfsprakenContracten', 'Afspraken Contracten', 'AfsprakenContract']) || 'AfsprakenContracten';
  const records = await fetchTableRecordsFiltered(tableId, { [hoofdLinkField]: afspraakContractId }, 2000);
  const typeDocumentField = findFieldName(tableFields, ['Type document', 'Typedocument', 'Document type']) || 'Type document';
  const omschrijvingField = findFieldName(tableFields, ['Omschrijving', 'Titel', 'Naam']) || 'Omschrijving';
  const extraInformatieField =
    findFieldName(tableFields, ['Extra informatie', 'Extra info', 'Informatie', 'Opmerkingen']) || 'Extra informatie';
  const startdatumField = findFieldName(tableFields, ['Startdatum', 'Start datum', 'Datum start']) || 'Startdatum';
  const einddatumField = findFieldName(tableFields, ['Einddatum', 'Eind datum', 'Datum eind']) || 'Einddatum';
  return records
    .map((record) => {
      const fields = record.fields ?? {};
      return {
        id: record.id,
        typeDocument: extractComparableText(fields[typeDocumentField]).trim() || asString(fields[typeDocumentField]).trim() || '',
        omschrijving: asString(fields[omschrijvingField]).trim() || '',
        extraInformatie: asString(fields[extraInformatieField]).trim() || '',
        startdatum: extractComparableText(fields[startdatumField]).trim() || asString(fields[startdatumField]).trim() || '',
        einddatum: extractComparableText(fields[einddatumField]).trim() || asString(fields[einddatumField]).trim() || '',
      } satisfies InkoopopdrachtItem;
    })
    .sort((a, b) => {
      const typeCompare = (a.typeDocument || '').localeCompare(b.typeDocument || '', 'nl', { sensitivity: 'base', numeric: true });
      if (typeCompare !== 0) {
        return typeCompare;
      }
      return (a.omschrijving || '').localeCompare(b.omschrijving || '', 'nl', { sensitivity: 'base', numeric: true });
    });
}

export async function fetchNinoxPrijsafsprakenVoorAfspraakContract(
  afspraakContractId: number
): Promise<PrijsafspraakItem[]> {
  if (!Number.isFinite(afspraakContractId) || afspraakContractId <= 0) {
    return [];
  }

  const tableId = await fetchTableIdByName('Prijsafspraken');
  if (!tableId) {
    throw new Error('Tabel Prijsafspraken niet gevonden.');
  }

  const artikelenTableId = await fetchTableIdByName('Artikelen');
  if (!artikelenTableId) {
    throw new Error('Tabel Artikelen niet gevonden.');
  }

  const [tableFields, artikelenRecords, artikelenFields] = await Promise.all([
    fetchNinoxTableFields(tableId),
    fetchTableRecords(artikelenTableId, 2000),
    fetchNinoxTableFields(artikelenTableId),
  ]);
  const hoofdLinkField = findFieldName(tableFields, ['AfsprakenContracten', 'Afspraken Contracten', 'AfsprakenContract']) || 'AfsprakenContracten';
  const records = await fetchTableRecordsFiltered(tableId, { [hoofdLinkField]: afspraakContractId }, 2000);
  const artikelField = findFieldName(tableFields, ['Artikel', 'Artikelnummer', 'Artikel nummer']) || 'Artikel';
  const prijsField = findFieldName(tableFields, ['Prijs', 'Bedrag', 'Prijs per eenheid']) || 'Prijs';
  const eenheidField = findFieldName(tableFields, ['Eenheid', 'Per', 'Prijs per']) || 'Eenheid';
  const startdatumField = findFieldName(tableFields, ['Startdatum', 'Start datum', 'Datum start']) || 'Startdatum';
  const einddatumField = findFieldName(tableFields, ['Einddatum', 'Eind datum', 'Datum eind']) || 'Einddatum';
  const artikelOmschrijvingField = findFieldName(artikelenFields, ['Omschrijving', 'Naam', 'Titel']) || 'Omschrijving';
  const artikelOmschrijvingById = new Map<number, string>();
  for (const record of artikelenRecords) {
    const fields = record.fields ?? {};
    const omschrijving = asString(fields[artikelOmschrijvingField]).trim();
    if (omschrijving) {
      artikelOmschrijvingById.set(record.id, omschrijving);
    }
  }

  return records
    .map((record) => {
      const fields = record.fields ?? {};
      const artikelValue = fields[artikelField];
      const artikelId = extractLinkedRecordId(artikelValue);
      const artikelTekst =
        (artikelId ? artikelOmschrijvingById.get(artikelId) || '' : '') ||
        extractComparableText(artikelValue).trim() ||
        asString(artikelValue).trim() ||
        '';
      return {
        id: record.id,
        artikel: artikelTekst,
        prijs: asNumber(fields[prijsField], 0),
        eenheid: resolveChoiceCaptionValue(tableFields, eenheidField, fields[eenheidField]),
        startdatum: extractComparableText(fields[startdatumField]).trim() || asString(fields[startdatumField]).trim() || '',
        einddatum: extractComparableText(fields[einddatumField]).trim() || asString(fields[einddatumField]).trim() || '',
      } satisfies PrijsafspraakItem;
    })
    .sort((a, b) => (a.artikel || '').localeCompare(b.artikel || '', 'nl', { sensitivity: 'base', numeric: true }));
}

async function resolvePrijsafspraakFieldNames(tableId: string): Promise<{
  artikel: string | null;
  artikelTekst: string | null;
  prijs: string | null;
  eenheid: string | null;
  startdatum: string | null;
  einddatum: string | null;
}> {
  const tableFields = await fetchNinoxTableFields(tableId);
  return {
    artikel: findFieldName(tableFields, ['Artikel', 'Artikelnummer', 'Artikel nummer']),
    artikelTekst: findFieldName(tableFields, ['Omschrijving', 'Artikel omschrijving', 'Artikelomschrijving']),
    prijs: findFieldName(tableFields, ['Prijs', 'Bedrag', 'Prijs per eenheid']),
    eenheid: findFieldName(tableFields, ['Eenheid', 'Per', 'Prijs per']),
    startdatum: findFieldName(tableFields, ['Startdatum', 'Start datum', 'Datum start']),
    einddatum: findFieldName(tableFields, ['Einddatum', 'Eind datum', 'Datum eind']),
  };
}

export async function createNinoxPrijsafspraak(input: {
  afspraakContractId: number;
  artikelId: string;
  artikelNaam?: string;
  prijs: number | null;
  eenheid?: string;
  startdatum?: string;
  einddatum?: string;
}): Promise<number> {
  const tableId = await fetchTableIdByName('Prijsafspraken');
  if (!tableId) {
    throw new Error('Tabel Prijsafspraken niet gevonden.');
  }

  const tableFields = await fetchNinoxTableFields(tableId);
  const hoofdLinkField =
    findFieldName(tableFields, ['AfsprakenContracten', 'Afspraken Contracten', 'AfsprakenContract']) || 'AfsprakenContracten';
  const names = await resolvePrijsafspraakFieldNames(tableId);
  const payload: Record<string, unknown> = {
    [hoofdLinkField]: input.afspraakContractId,
  };
  if (names.artikel && input.artikelId.trim()) {
    payload[names.artikel] = input.artikelId.trim();
  }
  if (names.artikelTekst && input.artikelNaam) {
    payload[names.artikelTekst] = input.artikelNaam.trim();
  }
  if (names.prijs && input.prijs !== null) {
    payload[names.prijs] = input.prijs;
  }
  if (names.eenheid) {
    payload[names.eenheid] = String(input.eenheid || '').trim();
  }
  if (names.startdatum) {
    payload[names.startdatum] = String(input.startdatum || '').trim();
  }
  if (names.einddatum) {
    payload[names.einddatum] = String(input.einddatum || '').trim();
  }

  return createNinoxRecord(tableId, payload);
}

export async function updateNinoxPrijsafspraak(
  id: number,
  input: { artikelId: string; artikelNaam?: string; prijs: number | null; eenheid?: string; startdatum?: string; einddatum?: string }
): Promise<void> {
  const tableId = await fetchTableIdByName('Prijsafspraken');
  if (!tableId) {
    throw new Error('Tabel Prijsafspraken niet gevonden.');
  }

  const names = await resolvePrijsafspraakFieldNames(tableId);
  const payload: Record<string, unknown> = {};
  if (names.artikel) {
    payload[names.artikel] = input.artikelId.trim();
  }
  if (names.artikelTekst && input.artikelNaam) {
    payload[names.artikelTekst] = input.artikelNaam.trim();
  }
  if (names.prijs) {
    payload[names.prijs] = input.prijs ?? null;
  }
  if (names.eenheid) {
    payload[names.eenheid] = String(input.eenheid || '').trim();
  }
  if (names.startdatum) {
    payload[names.startdatum] = String(input.startdatum || '').trim();
  }
  if (names.einddatum) {
    payload[names.einddatum] = String(input.einddatum || '').trim();
  }

  await updateNinoxRecord(tableId, id, payload);
}

export async function deleteNinoxPrijsafspraak(id: number): Promise<void> {
  const tableId = await fetchTableIdByName('Prijsafspraken');
  if (!tableId) {
    throw new Error('Tabel Prijsafspraken niet gevonden.');
  }

  await deleteNinoxRecord(tableId, id);
}

async function resolveInkoopopdrachtFieldNames(tableId: string): Promise<{
  typeDocument: string | null;
  omschrijving: string;
  extraInformatie: string | null;
  startdatum: string | null;
  einddatum: string | null;
}> {
  const tableFields = await fetchNinoxTableFields(tableId);
  return {
    typeDocument: findFieldName(tableFields, ['Type document', 'Typedocument', 'Document type']),
    omschrijving: findFieldName(tableFields, ['Omschrijving', 'Titel', 'Naam']) || 'Omschrijving',
    extraInformatie: findFieldName(tableFields, ['Extra informatie', 'Extra info', 'Informatie', 'Opmerkingen']),
    startdatum: findFieldName(tableFields, ['Startdatum', 'Start datum', 'Datum start']),
    einddatum: findFieldName(tableFields, ['Einddatum', 'Eind datum', 'Datum eind']),
  };
}

export async function fetchNinoxInkoopopdrachtenTypeDocumentOpties(): Promise<string[]> {
  const tableId = await fetchTableIdByName('Inkoopopdrachten');
  if (!tableId) {
    throw new Error('Tabel Inkoopopdrachten niet gevonden.');
  }

  const rawValues = await fetchRawChoiceValuesInFieldOrder(tableId, ['Type document', 'Typedocument', 'Document type']);
  if (rawValues.length > 0) {
    return rawValues;
  }

  const tableFields = await fetchNinoxTableFields(tableId);
  const target =
    tableFields.find((field) => normalizeCompare(field.name) === normalizeCompare('Type document')) ||
    tableFields.find((field) => normalizeCompare(field.name) === normalizeCompare('Typedocument')) ||
    tableFields.find((field) => normalizeCompare(field.name) === normalizeCompare('Document type'));

  if (!target || !Array.isArray(target.choices) || target.choices.length === 0) {
    return [];
  }

  return target.choices
    .map((choice) => asString(choice.caption).trim() || asString(choice.id).trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'nl', { sensitivity: 'base', numeric: true }));
}

export async function updateNinoxInkoopopdracht(
  id: number,
  input: { typeDocument: string; omschrijving: string; extraInformatie: string; startdatum: string; einddatum: string }
): Promise<void> {
  const tableId = await fetchTableIdByName('Inkoopopdrachten');
  if (!tableId) {
    throw new Error('Tabel Inkoopopdrachten niet gevonden.');
  }

  const names = await resolveInkoopopdrachtFieldNames(tableId);
  const payload: Record<string, unknown> = {
    [names.omschrijving]: input.omschrijving.trim(),
  };
  if (names.typeDocument) {
    payload[names.typeDocument] = input.typeDocument.trim();
  }
  if (names.extraInformatie) {
    payload[names.extraInformatie] = input.extraInformatie.trim();
  }
  if (names.startdatum) {
    payload[names.startdatum] = input.startdatum.trim();
  }
  if (names.einddatum) {
    payload[names.einddatum] = input.einddatum.trim();
  }

  await updateNinoxRecord(tableId, id, payload);
}

export async function createNinoxInkoopopdracht(input: {
  afspraakContractId: number;
  typeDocument: string;
  omschrijving: string;
  extraInformatie: string;
  startdatum: string;
  einddatum: string;
}): Promise<number> {
  const tableId = await fetchTableIdByName('Inkoopopdrachten');
  if (!tableId) {
    throw new Error('Tabel Inkoopopdrachten niet gevonden.');
  }

  const tableFields = await fetchNinoxTableFields(tableId);
  const hoofdLinkField =
    findFieldName(tableFields, ['AfsprakenContracten', 'Afspraken Contracten', 'AfsprakenContract']) || 'AfsprakenContracten';
  const names = await resolveInkoopopdrachtFieldNames(tableId);
  const payload: Record<string, unknown> = {
    [hoofdLinkField]: input.afspraakContractId,
    [names.omschrijving]: input.omschrijving.trim(),
  };
  if (names.typeDocument) {
    payload[names.typeDocument] = input.typeDocument.trim();
  }
  if (names.extraInformatie) {
    payload[names.extraInformatie] = input.extraInformatie.trim();
  }
  if (names.startdatum) {
    payload[names.startdatum] = input.startdatum.trim();
  }
  if (names.einddatum) {
    payload[names.einddatum] = input.einddatum.trim();
  }

  return createNinoxRecord(tableId, payload);
}

export async function deleteNinoxInkoopopdracht(id: number): Promise<void> {
  const tableId = await fetchTableIdByName('Inkoopopdrachten');
  if (!tableId) {
    throw new Error('Tabel Inkoopopdrachten niet gevonden.');
  }

  await deleteNinoxRecord(tableId, id);
}

export async function uploadNinoxInkoopopdrachtDocument(recordId: number, file: File): Promise<void> {
  const tableId = await fetchTableIdByName('Inkoopopdrachten');
  if (!tableId) {
    throw new Error('Tabel Inkoopopdrachten niet gevonden.');
  }

  await uploadNinoxRecordDocument(tableId, recordId, file, 'Document');
}

export async function clearNinoxInkoopopdrachtDocument(recordId: number): Promise<void> {
  const tableId = await fetchTableIdByName('Inkoopopdrachten');
  if (!tableId) {
    throw new Error('Tabel Inkoopopdrachten niet gevonden.');
  }

  const listNames = await fetchRecordFileNames(tableId, recordId);
  const linkedName = await resolveLinkedFileNameForField(tableId, recordId, 'Document', listNames);

  const clearAttempts: Array<Record<string, unknown>> = [{ Document: '' }, { Document: null }, { Document: [] }];
  let cleared = false;
  let lastError: unknown = null;
  for (const fields of clearAttempts) {
    try {
      await updateNinoxRecord(tableId, recordId, fields);
      cleared = true;
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!cleared) {
    throw lastError instanceof Error ? lastError : new Error('Veld "Document" leegmaken mislukt.');
  }

  if (!linkedName) {
    return;
  }
  const deleteResponse = await request(`/tables/${tableId}/records/${recordId}/files/${encodeURIComponent(linkedName)}`, {
    method: 'DELETE',
  });
  if (!deleteResponse.ok && deleteResponse.status !== 404) {
    const errorPayload = await deleteResponse.json().catch(() => ({}));
    const message = typeof errorPayload?.message === 'string' ? errorPayload.message : 'Onbekende Ninox fout';
    throw new Error(`PDF verwijderen mislukt (${deleteResponse.status}): ${message}`);
  }
}

export async function fetchNinoxInkoopopdrachtDocument(recordId: number): Promise<NinoxRecordDocument | null> {
  const fetchBinaryOrWrapped = async (path: string): Promise<Blob | null> => {
    const response = await request(path, {
      headers: {
        Accept: 'application/pdf,application/octet-stream,*/*',
      },
    });
    if (!response.ok) {
      return null;
    }
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('application/pdf') || contentType.includes('application/octet-stream')) {
      const blob = await response.blob();
      return blob.size > 0 ? blob : null;
    }
    const wrapped = await response.json().catch(() => null);
    const wrappedBase64 =
      typeof wrapped?.bodyBase64 === 'string'
        ? wrapped.bodyBase64
        : typeof wrapped?.base64 === 'string'
        ? wrapped.base64
        : '';
    const wrappedContentType =
      typeof wrapped?.contentType === 'string' && wrapped.contentType.trim() ? wrapped.contentType : 'application/pdf';
    if (!wrappedBase64) {
      return null;
    }
    const blob = base64ToBlob(wrappedBase64, wrappedContentType);
    return blob && blob.size > 0 ? blob : null;
  };

  const tableId = await fetchTableIdByName('Inkoopopdrachten');
  if (!tableId) {
    throw new Error('Tabel Inkoopopdrachten niet gevonden.');
  }

  const listResponse = await request(`/tables/${tableId}/records/${recordId}/files`);
  if (!listResponse.ok) {
    return null;
  }
  const payload = await listResponse.json().catch(() => []);
  if (!Array.isArray(payload) || payload.length === 0) {
    return null;
  }

  const fileNames = payload
    .map((item) => asString((item as { name?: unknown })?.name).trim())
    .filter((name) => Boolean(name));
  if (fileNames.length === 0) {
    return null;
  }

  const candidateName = await resolveLinkedFileNameForField(tableId, recordId, 'Document', fileNames);
  if (!candidateName) {
    return null;
  }
  const blob = await fetchBinaryOrWrapped(`/tables/${tableId}/records/${recordId}/files/${encodeURIComponent(candidateName)}`);
  if (!blob) {
    return null;
  }
  return { naam: candidateName, blob };
}

export async function createNinoxAfspraakContract(input: {
  relatieId: string;
  relatieNaam?: string;
  onderdeel: string;
  opmerkingen?: string;
}): Promise<number> {
  const tableId = await fetchTableIdByName('AfsprakenContracten');
  if (!tableId) {
    throw new Error('Tabel AfsprakenContracten niet gevonden.');
  }

  const names = await resolveAfsprakenEnContractenFieldNames(tableId);
  const payload: Record<string, unknown> = {
    [names.onderdeel]: input.onderdeel.trim(),
  };

  const relatieId = Number.parseInt(String(input.relatieId || '').trim(), 10);
  if (names.relatie && Number.isFinite(relatieId) && relatieId > 0) {
    payload[names.relatie] = relatieId;
  }
  if (names.relatieNaam && input.relatieNaam && names.relatieNaam !== names.relatie) {
    payload[names.relatieNaam] = input.relatieNaam.trim();
  }
  if (names.opmerkingen) {
    payload[names.opmerkingen] = String(input.opmerkingen || '').trim();
  }

  return createNinoxRecord(tableId, payload);
}

export async function updateNinoxAfspraakContract(
  id: number,
  input: { relatieId: string; relatieNaam?: string; onderdeel: string; opmerkingen?: string }
): Promise<void> {
  const tableId = await fetchTableIdByName('AfsprakenContracten');
  if (!tableId) {
    throw new Error('Tabel AfsprakenContracten niet gevonden.');
  }

  const names = await resolveAfsprakenEnContractenFieldNames(tableId);
  const payload: Record<string, unknown> = {
    [names.onderdeel]: input.onderdeel.trim(),
  };

  const relatieId = Number.parseInt(String(input.relatieId || '').trim(), 10);
  if (names.relatie && Number.isFinite(relatieId) && relatieId > 0) {
    payload[names.relatie] = relatieId;
  }
  if (names.relatieNaam && input.relatieNaam && names.relatieNaam !== names.relatie) {
    payload[names.relatieNaam] = input.relatieNaam.trim();
  }
  if (names.opmerkingen) {
    payload[names.opmerkingen] = String(input.opmerkingen || '').trim();
  }

  await updateNinoxRecord(tableId, id, payload);
}

export async function deleteNinoxAfspraakContract(id: number): Promise<void> {
  const tableId = await fetchTableIdByName('AfsprakenContracten');
  if (!tableId) {
    throw new Error('Tabel AfsprakenContracten niet gevonden.');
  }
  await deleteNinoxRecord(tableId, id);
}

export async function updateNinoxMailTemplate(id: number, input: { titel: string; template: string }): Promise<void> {
  const tableId = await requireTemplatesTableId();
  const tableFields = await fetchNinoxTableFields(tableId);
  const titelField = findFieldName(tableFields, ['Titel', 'Onderwerp', 'Naam']) || 'Titel';
  const templateField = findFieldName(tableFields, ['Template', 'Inhoud', 'Tekst']) || 'Template';
  await updateNinoxRecord(tableId, id, {
    [titelField]: input.titel.trim(),
    [templateField]: input.template,
  });
}

export async function createNinoxMailTemplate(input: { titel: string; template: string }): Promise<number> {
  const tableId = await requireTemplatesTableId();
  const tableFields = await fetchNinoxTableFields(tableId);
  const titelField = findFieldName(tableFields, ['Titel', 'Onderwerp', 'Naam']) || 'Titel';
  const templateField = findFieldName(tableFields, ['Template', 'Inhoud', 'Tekst']) || 'Template';
  return createNinoxRecord(tableId, {
    [titelField]: input.titel.trim(),
    [templateField]: input.template,
  });
}

export async function deleteNinoxMailTemplate(id: number): Promise<void> {
  const tableId = await requireTemplatesTableId();
  await deleteNinoxRecord(tableId, id);
}

export async function uploadNinoxMailTemplateDocument(recordId: number, file: File): Promise<void> {
  const tableId = await requireTemplatesTableId();
  await uploadNinoxRecordDocument(tableId, recordId, file, 'Document');
}

export async function clearNinoxMailTemplateDocument(recordId: number): Promise<void> {
  const tableId = await requireTemplatesTableId();
  const listNames = await fetchRecordFileNames(tableId, recordId);
  const linkedName = await resolveLinkedFileNameForField(tableId, recordId, 'Document', listNames);

  const clearAttempts: Array<Record<string, unknown>> = [{ Document: '' }, { Document: null }, { Document: [] }];
  let cleared = false;
  let lastError: unknown = null;
  for (const fields of clearAttempts) {
    try {
      await updateNinoxRecord(tableId, recordId, fields);
      cleared = true;
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!cleared) {
    throw lastError instanceof Error ? lastError : new Error('Veld "Document" leegmaken mislukt.');
  }

  if (!linkedName) {
    return;
  }
  const deleteResponse = await request(`/tables/${tableId}/records/${recordId}/files/${encodeURIComponent(linkedName)}`, {
    method: 'DELETE',
  });
  if (!deleteResponse.ok && deleteResponse.status !== 404) {
    const errorPayload = await deleteResponse.json().catch(() => ({}));
    const message = typeof errorPayload?.message === 'string' ? errorPayload.message : 'Onbekende Ninox fout';
    throw new Error(`PDF verwijderen mislukt (${deleteResponse.status}): ${message}`);
  }
}

export async function fetchNinoxMailTemplateDocument(recordId: number): Promise<NinoxRecordDocument | null> {
  const tableId = await requireTemplatesTableId();
  const listResponse = await request(`/tables/${tableId}/records/${recordId}/files`);
  if (!listResponse.ok) {
    return null;
  }
  const payload = await listResponse.json().catch(() => []);
  if (!Array.isArray(payload) || payload.length === 0) {
    return null;
  }

  const names = payload
    .map((item) => asString((item as { name?: unknown })?.name).trim())
    .filter((name) => Boolean(name));
  if (names.length === 0) {
    return null;
  }

  const candidateName = await resolveLinkedFileNameForField(tableId, recordId, 'Document', names);
  if (!candidateName) {
    return null;
  }
  const response = await request(`/tables/${tableId}/records/${recordId}/files/${encodeURIComponent(candidateName)}`, {
    headers: {
      Accept: 'application/pdf,application/octet-stream,*/*',
    },
  });
  if (!response.ok) {
    return null;
  }
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  let blob: Blob | null = null;
  if (contentType.includes('application/pdf') || contentType.includes('application/octet-stream')) {
    blob = await response.blob();
  } else {
    const wrapped = await response.json().catch(() => null);
    const wrappedBase64 =
      typeof wrapped?.bodyBase64 === 'string'
        ? wrapped.bodyBase64
        : typeof wrapped?.base64 === 'string'
        ? wrapped.base64
        : '';
    const wrappedContentType =
      typeof wrapped?.contentType === 'string' && wrapped.contentType.trim()
        ? wrapped.contentType
        : 'application/pdf';
    if (wrappedBase64) {
      blob = base64ToBlob(wrappedBase64, wrappedContentType);
    }
  }
  if (!blob || blob.size === 0) {
    return null;
  }
  return {
    naam: candidateName,
    blob,
  };
}

export async function fetchNinoxLedenGroepen(): Promise<string[]> {
  const tableId = await fetchTableIdByName('LedenGroepen');
  if (!tableId) {
    throw new Error('Tabel LedenGroepen niet gevonden.');
  }

  const records = await fetchTableRecords(tableId, 500);
  const groupNames = new Set<string>();

  for (const record of records) {
    const fields = record.fields ?? {};
    const preferred =
      asString(fields.Naam).trim() ||
      asString(fields.Groep).trim() ||
      asString(fields.Titel).trim() ||
      asString(fields.Omschrijving).trim();

    if (preferred) {
      groupNames.add(preferred);
      continue;
    }

    for (const value of Object.values(fields)) {
      const text = extractComparableText(value).trim();
      if (text) {
        groupNames.add(text);
        break;
      }
    }
  }

  return Array.from(groupNames).sort((a, b) => a.localeCompare(b, 'nl', { sensitivity: 'base', numeric: true }));
}

export async function fetchNinoxLedenGroepenBeheer(): Promise<NinoxLedenGroep[]> {
  const tableId = await fetchTableIdByName('LedenGroepen');
  if (!tableId) {
    throw new Error('Tabel LedenGroepen niet gevonden.');
  }

  const records = await fetchTableRecords(tableId, 500);
  const mapped = records.map((record) => {
    const fields = record.fields ?? {};
    const omschrijving =
      asString(fields.Omschrijving).trim() ||
      asString(fields.Naam).trim() ||
      asString(fields.Groep).trim() ||
      asString(fields.Titel).trim() ||
      extractComparableText(fields.Omschrijving).trim() ||
      extractComparableText(Object.values(fields)[0]).trim() ||
      `Groep ${record.id}`;
    return {
      id: record.id,
      omschrijving,
    };
  });

  return mapped.sort((a, b) => a.omschrijving.localeCompare(b.omschrijving, 'nl', { sensitivity: 'base', numeric: true }));
}

export async function createNinoxLedenGroep(omschrijving: string): Promise<void> {
  const tableId = await fetchTableIdByName('LedenGroepen');
  if (!tableId) {
    throw new Error('Tabel LedenGroepen niet gevonden.');
  }
  const tableFields = await fetchNinoxTableFields(tableId);
  const omschrijvingField = findFieldName(tableFields, ['Omschrijving', 'Naam', 'Groep', 'Titel']) || 'Omschrijving';
  await createNinoxRecord(tableId, {
    [omschrijvingField]: omschrijving.trim(),
  });
}

export async function updateNinoxLedenGroep(id: number, omschrijving: string): Promise<void> {
  const tableId = await fetchTableIdByName('LedenGroepen');
  if (!tableId) {
    throw new Error('Tabel LedenGroepen niet gevonden.');
  }
  const tableFields = await fetchNinoxTableFields(tableId);
  const omschrijvingField = findFieldName(tableFields, ['Omschrijving', 'Naam', 'Groep', 'Titel']) || 'Omschrijving';
  await updateNinoxRecord(tableId, id, {
    [omschrijvingField]: omschrijving.trim(),
  });
}

export async function deleteNinoxLedenGroep(id: number): Promise<void> {
  const tableId = await fetchTableIdByName('LedenGroepen');
  if (!tableId) {
    throw new Error('Tabel LedenGroepen niet gevonden.');
  }
  await deleteNinoxRecord(tableId, id);
}

export async function fetchNinoxLidmaatschappen(): Promise<NinoxLookupOption[]> {
  const tableId = await fetchTableIdByName('Lidmaatschappen');
  if (!tableId) {
    throw new Error('Tabel Lidmaatschappen niet gevonden.');
  }

  const records = await fetchTableRecords(tableId, 500);
  const options = records
    .map((record) => {
      const fields = record.fields ?? {};
      const label =
        asString(fields.Naam).trim() ||
        asString(fields.Lidmaatschap).trim() ||
        asString(fields.Titel).trim() ||
        asString(fields.Omschrijving).trim() ||
        Object.values(fields).map((value) => extractComparableText(value).trim()).find(Boolean) ||
        String(record.id);
      return {
        id: String(record.id),
        label,
      };
    })
    .filter((option) => option.id && option.label);

  options.sort((a, b) => a.label.localeCompare(b.label, 'nl', { sensitivity: 'base', numeric: true }));
  return options;
}

export async function fetchNinoxLidmaatschappenBeheer(): Promise<NinoxLidmaatschap[]> {
  const tableId = await fetchTableIdByName('Lidmaatschappen');
  if (!tableId) {
    throw new Error('Tabel Lidmaatschappen niet gevonden.');
  }

  const records = await fetchTableRecords(tableId, 500);
  const mapped = records.map((record) => {
    const fields = record.fields ?? {};
    const tegenrekeningRaw = fields.Tegenrekening;
    const tegenrekeningFromArray =
      Array.isArray(tegenrekeningRaw) && tegenrekeningRaw.length > 0
        ? tegenrekeningRaw[0]
        : null;
    const tegenrekeningObj =
      tegenrekeningRaw && typeof tegenrekeningRaw === 'object' && !Array.isArray(tegenrekeningRaw)
        ? (tegenrekeningRaw as Record<string, unknown>)
        : tegenrekeningFromArray && typeof tegenrekeningFromArray === 'object'
        ? (tegenrekeningFromArray as Record<string, unknown>)
        : null;
    const tegenrekeningId =
      typeof tegenrekeningRaw === 'number'
        ? String(tegenrekeningRaw)
        : typeof tegenrekeningRaw === 'string'
        ? tegenrekeningRaw.trim()
        : tegenrekeningObj
        ? asString(tegenrekeningObj.id).trim() ||
          asString(tegenrekeningObj.value).trim()
        : '';
    const omschrijving =
      asString(fields.Omschrijving).trim() ||
      asString(fields.Naam).trim() ||
      asString(fields.Lidmaatschap).trim() ||
      asString(fields.Titel).trim() ||
      extractComparableText(Object.values(fields)[0]).trim() ||
      `Lidmaatschap ${record.id}`;
    return {
      id: record.id,
      omschrijving,
      periode:
        asString(fields.Periode).trim() ||
        asString(fields['Periode omschrijving']).trim() ||
        asString(fields.Termijn).trim(),
      bedrag: asNumber(fields.Bedrag, 0),
      tegenrekeningId: tegenrekeningId || asString(fields['Tegenrekening id']).trim(),
      tegenrekening:
        extractComparableText(fields.Tegenrekening).trim() ||
        asString(fields['Tegenrekening nummer']).trim() ||
        asString(fields['Tegenrekening omschrijving']).trim(),
      tegenrekeningNummer:
        asString(fields['Tegenrekening nummer']).trim() ||
        asString(tegenrekeningObj?.nummer).trim() ||
        asString(tegenrekeningObj?.number).trim() ||
        asString(tegenrekeningObj?.code).trim(),
      tegenrekeningNaam:
        asString(fields['Tegenrekening omschrijving']).trim() ||
        asString(tegenrekeningObj?.naam).trim() ||
        asString(tegenrekeningObj?.name).trim() ||
        asString(tegenrekeningObj?.caption).trim(),
    };
  });

  return mapped.sort((a, b) => a.omschrijving.localeCompare(b.omschrijving, 'nl', { sensitivity: 'base', numeric: true }));
}

export async function createNinoxLidmaatschap(input: { omschrijving: string; periode?: string; bedrag?: number; tegenrekeningId?: string; tegenrekeningNummer?: string; tegenrekeningNaam?: string }): Promise<void> {
  const tableId = await fetchTableIdByName('Lidmaatschappen');
  if (!tableId) {
    throw new Error('Tabel Lidmaatschappen niet gevonden.');
  }
  const tableFields = await fetchNinoxTableFields(tableId);
  const omschrijvingField = findFieldName(tableFields, ['Omschrijving', 'Naam', 'Lidmaatschap', 'Titel']) || 'Omschrijving';
  const periodeField = findFieldName(tableFields, ['Periode', 'Periode omschrijving', 'Termijn']);
  const bedragField = findFieldName(tableFields, ['Bedrag', 'Prijs', 'Contributie']);
  const tegenrekeningField = findFieldName(tableFields, ['Tegenrekening']);
  const tegenrekeningNummerField = findFieldName(tableFields, ['Tegenrekening nummer', 'Grootboeknummer tegenrekening']);
  const tegenrekeningOmschrijvingField = findFieldName(tableFields, ['Tegenrekening omschrijving', 'Grootboekomschrijving tegenrekening']);
  const payload: Record<string, unknown> = {
    [omschrijvingField]: input.omschrijving.trim(),
  };
  if (periodeField) {
    payload[periodeField] = String(input.periode || '').trim();
  }
  if (bedragField && typeof input.bedrag === 'number' && Number.isFinite(input.bedrag)) {
    payload[bedragField] = input.bedrag;
  }
  if (tegenrekeningField) {
    const raw = String(input.tegenrekeningId || '').trim();
    if (raw) {
      const numericId = Number(raw);
      payload[tegenrekeningField] = Number.isFinite(numericId) ? numericId : raw;
    } else {
      payload[tegenrekeningField] = '';
    }
  }
  if (tegenrekeningNummerField) {
    payload[tegenrekeningNummerField] = String(input.tegenrekeningNummer || '').trim();
  }
  if (tegenrekeningOmschrijvingField) {
    payload[tegenrekeningOmschrijvingField] = String(input.tegenrekeningNaam || '').trim();
  }
  await createNinoxRecord(tableId, {
    ...payload,
  });
}

export async function updateNinoxLidmaatschap(id: number, input: { omschrijving: string; periode?: string; bedrag?: number; tegenrekeningId?: string; tegenrekeningNummer?: string; tegenrekeningNaam?: string }): Promise<void> {
  const tableId = await fetchTableIdByName('Lidmaatschappen');
  if (!tableId) {
    throw new Error('Tabel Lidmaatschappen niet gevonden.');
  }
  const tableFields = await fetchNinoxTableFields(tableId);
  const omschrijvingField = findFieldName(tableFields, ['Omschrijving', 'Naam', 'Lidmaatschap', 'Titel']) || 'Omschrijving';
  const periodeField = findFieldName(tableFields, ['Periode', 'Periode omschrijving', 'Termijn']);
  const bedragField = findFieldName(tableFields, ['Bedrag', 'Prijs', 'Contributie']);
  const tegenrekeningField = findFieldName(tableFields, ['Tegenrekening']);
  const tegenrekeningNummerField = findFieldName(tableFields, ['Tegenrekening nummer', 'Grootboeknummer tegenrekening']);
  const tegenrekeningOmschrijvingField = findFieldName(tableFields, ['Tegenrekening omschrijving', 'Grootboekomschrijving tegenrekening']);
  const payload: Record<string, unknown> = {
    [omschrijvingField]: input.omschrijving.trim(),
  };
  if (periodeField) {
    payload[periodeField] = String(input.periode || '').trim();
  }
  if (bedragField && typeof input.bedrag === 'number' && Number.isFinite(input.bedrag)) {
    payload[bedragField] = input.bedrag;
  }
  if (tegenrekeningField) {
    const raw = String(input.tegenrekeningId || '').trim();
    if (raw) {
      const numericId = Number(raw);
      payload[tegenrekeningField] = Number.isFinite(numericId) ? numericId : raw;
    } else {
      payload[tegenrekeningField] = '';
    }
  }
  if (tegenrekeningNummerField) {
    payload[tegenrekeningNummerField] = String(input.tegenrekeningNummer || '').trim();
  }
  if (tegenrekeningOmschrijvingField) {
    payload[tegenrekeningOmschrijvingField] = String(input.tegenrekeningNaam || '').trim();
  }
  await updateNinoxRecord(tableId, id, {
    ...payload,
  });
}

export async function deleteNinoxLidmaatschap(id: number): Promise<void> {
  const tableId = await fetchTableIdByName('Lidmaatschappen');
  if (!tableId) {
    throw new Error('Tabel Lidmaatschappen niet gevonden.');
  }
  await deleteNinoxRecord(tableId, id);
}

export async function fetchNinoxLidmaatschapPeriodeOpties(): Promise<string[]> {
  const tableId = await fetchTableIdByName('Lidmaatschappen');
  if (!tableId) {
    throw new Error('Tabel Lidmaatschappen niet gevonden.');
  }
  const fields = await fetchNinoxTableFields(tableId);
  const periodeField =
    fields.find((field) => normalizeCompare(field.name) === normalizeCompare('Periode')) ||
    fields.find((field) => normalizeCompare(field.name) === normalizeCompare('Periode omschrijving')) ||
    fields.find((field) => normalizeCompare(field.name) === normalizeCompare('Termijn'));

  const options = (periodeField?.choices || [])
    .map((choice) => asString(choice.caption).trim() || asString(choice.id).trim())
    .filter(Boolean);

  return Array.from(new Set(options)).sort((a, b) => a.localeCompare(b, 'nl', { sensitivity: 'base', numeric: true }));
}

export async function fetchNinoxGrootboekLookup(): Promise<NinoxGrootboekLookupOption[]> {
  const records = await fetchTableRecords(tableIds.grootboek, 1000);
  const mapped = records
    .map((record) => {
      const fields = record.fields ?? {};
      const nummer = asString(fields.Nummer).trim();
      const naam = asString(fields.Naam).trim() || asString(fields.Omschrijving).trim();
      const label = [naam, nummer].filter(Boolean).join(' - ') || `Grootboek ${record.id}`;
      return {
        id: String(record.id),
        nummer,
        naam,
        label,
      };
    })
    .filter((item) => item.id && item.label);

  return mapped.sort((a, b) => a.label.localeCompare(b.label, 'nl', { sensitivity: 'base', numeric: true }));
}

export async function fetchNinoxBrevettenBeheer(): Promise<NinoxBrevet[]> {
  const tableId = await fetchTableIdByName('Brevetten');
  if (!tableId) {
    throw new Error('Tabel Brevetten niet gevonden.');
  }

  const records = await fetchTableRecords(tableId, 500);
  const mapped = records.map((record) => {
    const fields = record.fields ?? {};
    const omschrijving =
      asString(fields.Omschrijving).trim() ||
      asString(fields.Naam).trim() ||
      asString(fields.Titel).trim() ||
      extractComparableText(Object.values(fields)[0]).trim() ||
      `Brevet ${record.id}`;
    return {
      id: record.id,
      omschrijving,
    };
  });

  return mapped.sort((a, b) => a.omschrijving.localeCompare(b.omschrijving, 'nl', { sensitivity: 'base', numeric: true }));
}

function formatIsoDateToDdMmYyyy(value: string): string {
  const iso = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!iso) {
    return String(value || '').trim();
  }
  return `${iso[3]}/${iso[2]}/${iso[1]}`;
}

function normalizeTimeToHm(value: unknown): string {
  const normalizePlainTime = (rawInput: string): string => {
    const raw = String(rawInput || '').trim();
    if (!raw) {
      return '';
    }
    const exactTimeMatch = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (exactTimeMatch) {
      return `${String(Number(exactTimeMatch[1])).padStart(2, '0')}:${exactTimeMatch[2]}`;
    }
    return '';
  };

  const normalizeFromString = (rawInput: string): string => {
    const raw = String(rawInput || '').trim();
    if (!raw) {
      return '';
    }

    const plain = normalizePlainTime(raw);
    if (plain) {
      return plain;
    }

    // Geen datetime parsing: we tonen alleen pure tijdtekst uit Ninox.
    const looseTimeMatch = raw.match(/\b(\d{1,2}):(\d{2})\b/);
    if (looseTimeMatch && !/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
      return `${String(Number(looseTimeMatch[1])).padStart(2, '0')}:${looseTimeMatch[2]}`;
    }

    return '';
  };

  if (typeof value === 'string') {
    const normalized = normalizeFromString(value);
    if (normalized) {
      return normalized;
    }
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const normalized = normalizeTimeToHm(item);
      if (normalized) {
        return normalized;
      }
    }
    return '';
  }

  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    const preferredTextFields = [obj.caption, obj.label, obj.text, obj.name, obj.formatted, obj.displayValue];
    for (const candidate of preferredTextFields) {
      const normalized = normalizeFromString(asString(candidate));
      if (normalized) {
        return normalized;
      }
    }

    // Alleen expliciete tijdvelden als fallback; geen generieke datetime/value omzetting.
    const fallbackFields = [obj.time];
    for (const candidate of fallbackFields) {
      const normalized = normalizeFromString(asString(candidate));
      if (normalized) {
        return normalized;
      }
    }
  }

  const fallbackRaw = extractComparableText(value).trim() || asString(value).trim();
  return normalizePlainTime(fallbackRaw);
}

function readFieldValueByExactAliases(fields: Record<string, unknown>, aliases: string[]): unknown {
  const entries = Object.entries(fields || {});
  const normalizeLoose = (value: string): string => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  for (const alias of aliases) {
    const exactNormalized = entries.find(([key]) => normalizeCompare(key) === normalizeCompare(alias));
    if (exactNormalized) {
      return exactNormalized[1];
    }
    const exactLoose = entries.find(([key]) => normalizeLoose(key) === normalizeLoose(alias));
    if (exactLoose) {
      return exactLoose[1];
    }
  }
  return undefined;
}

async function resolvePlanningStofzuigenFieldNames(tableId: string): Promise<{
  datum: string;
  vanaf: string;
  totEnMet: string;
  bad: string;
  reinigen: string;
}> {
  const tableFields = await fetchNinoxTableFields(tableId);
  const pickField = (exactCandidates: string[], fallbackName: string): string => {
    const exact = findFieldName(tableFields, exactCandidates);
    if (exact) {
      return exact;
    }
    return fallbackName;
  };

  return {
    datum: findFieldName(tableFields, ['Datum']) || 'Datum',
    vanaf: pickField(['Vanaf', 'Vanaf uu:mm', 'Vanaf HH:mm', 'Vanaf hh:mm'], 'Vanaf'),
    totEnMet: pickField(['Tot', 'Tot en met', 'Tot en met uu:mm', 'Tot en met HH:mm', 'Tot en met hh:mm'], 'Tot'),
    bad: findFieldName(tableFields, ['Bad']) || 'Bad',
    reinigen: findFieldName(tableFields, ['Reinigen']) || 'Reinigen',
  };
}

export async function fetchNinoxPlanningStofzuigen(): Promise<NinoxPlanningStofzuigen[]> {
  const tableId = await fetchTableIdByName('Planning stofzuigen');
  if (!tableId) {
    throw new Error('Tabel Planning stofzuigen niet gevonden.');
  }
  const names = await resolvePlanningStofzuigenFieldNames(tableId);
  const records = await fetchTableRecords(tableId, 1000);
  return records
    .map((record) => {
      const fields = record.fields ?? {};
      const datumRaw = extractComparableText(fields[names.datum]).trim() || asString(fields[names.datum]).trim();
      const datumIso = normalizeDateToIso(datumRaw);
      const vanafRaw =
        readFieldValueByExactAliases(fields, [names.vanaf, 'Vanaf', 'Vanaf uu:mm', 'Vanaf HH:mm', 'Vanaf hh:mm']) ?? '';
      const totEnMetRaw =
        readFieldValueByExactAliases(fields, [names.totEnMet, 'Tot', 'Tot en met', 'Tot en met uu:mm', 'Tot en met HH:mm', 'Tot en met hh:mm']) ?? '';
      return {
        id: record.id,
        datum: datumIso ? formatIsoDateToDdMmYyyy(datumIso) : datumRaw,
        vanaf: normalizeTimeToHm(vanafRaw),
        totEnMet: normalizeTimeToHm(totEnMetRaw),
        bad: extractComparableText(fields[names.bad]).trim() || asString(fields[names.bad]).trim(),
        reinigen: extractComparableText(fields[names.reinigen]).trim() || asString(fields[names.reinigen]).trim(),
      } satisfies NinoxPlanningStofzuigen;
    })
    .sort((a, b) => normalizeDateToIso(a.datum).localeCompare(normalizeDateToIso(b.datum), 'nl', { sensitivity: 'base', numeric: true }));
}

export async function fetchNinoxPlanningStofzuigenTijdOpties(): Promise<{
  vanaf: string[];
  tot: string[];
  bad: string[];
  reinigen: string[];
}> {
  const tableId = await fetchTableIdByName('Planning stofzuigen');
  if (!tableId) {
    throw new Error('Tabel Planning stofzuigen niet gevonden.');
  }

  const names = await resolvePlanningStofzuigenFieldNames(tableId);
  const fields = await fetchNinoxTableFields(tableId);

  const getChoices = (fieldNameCandidates: string[]): string[] => {
    const fieldName = findFieldName(fields, fieldNameCandidates);
    if (!fieldName) {
      return [];
    }
    const field = fields.find((item) => normalizeCompare(item.name) === normalizeCompare(fieldName));
    const values = (field?.choices || [])
      .map((choice) => asString(choice.caption).trim() || asString(choice.id).trim())
      .filter(Boolean);
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, 'nl', { sensitivity: 'base', numeric: true }));
  };

  return {
    vanaf: getChoices([names.vanaf, 'Vanaf', 'Vanaf uu:mm', 'Vanaf HH:mm', 'Vanaf hh:mm']),
    tot: getChoices([names.totEnMet, 'Tot', 'Tot en met', 'Tot en met uu:mm', 'Tot en met HH:mm', 'Tot en met hh:mm']),
    bad: getChoices([names.bad, 'Bad']),
    reinigen: getChoices([names.reinigen, 'Reinigen']),
  };
}

export async function createNinoxPlanningStofzuigen(input: {
  datum: string;
  vanaf: string;
  totEnMet: string;
  bad: string;
  reinigen: string;
}): Promise<void> {
  const tableId = await fetchTableIdByName('Planning stofzuigen');
  if (!tableId) {
    throw new Error('Tabel Planning stofzuigen niet gevonden.');
  }
  const names = await resolvePlanningStofzuigenFieldNames(tableId);
  await createNinoxRecord(tableId, {
    [names.datum]: normalizeDateToIso(input.datum),
    [names.vanaf]: String(input.vanaf || '').trim(),
    [names.totEnMet]: String(input.totEnMet || '').trim(),
    [names.bad]: String(input.bad || '').trim(),
    [names.reinigen]: String(input.reinigen || '').trim(),
  });
}

export async function updateNinoxPlanningStofzuigen(
  id: number,
  input: { datum: string; vanaf: string; totEnMet: string; bad: string; reinigen: string }
): Promise<void> {
  const tableId = await fetchTableIdByName('Planning stofzuigen');
  if (!tableId) {
    throw new Error('Tabel Planning stofzuigen niet gevonden.');
  }
  const names = await resolvePlanningStofzuigenFieldNames(tableId);
  await updateNinoxRecord(tableId, id, {
    [names.datum]: normalizeDateToIso(input.datum),
    [names.vanaf]: String(input.vanaf || '').trim(),
    [names.totEnMet]: String(input.totEnMet || '').trim(),
    [names.bad]: String(input.bad || '').trim(),
    [names.reinigen]: String(input.reinigen || '').trim(),
  });
}

export async function deleteNinoxPlanningStofzuigen(id: number): Promise<void> {
  const tableId = await fetchTableIdByName('Planning stofzuigen');
  if (!tableId) {
    throw new Error('Tabel Planning stofzuigen niet gevonden.');
  }
  await deleteNinoxRecord(tableId, id);
}

export async function vervalNinoxPlanningStofzuigen(id: number): Promise<void> {
  const tableId = await fetchTableIdByName('Planning stofzuigen');
  if (!tableId) {
    throw new Error('Tabel Planning stofzuigen niet gevonden.');
  }

  const tableFields = await fetchNinoxTableFields(tableId);
  const statusField = findFieldName(tableFields, ['Status', 'Record status']);
  if (statusField) {
    try {
      await updateNinoxRecord(tableId, id, { [statusField]: 'Vervallen' });
      return;
    } catch {
      // fallback to hard delete below
    }
  }

  const vervallenField = findFieldName(tableFields, ['Vervallen', 'Inactief', 'Actief']);
  if (vervallenField) {
    const normalizedName = normalizeCompare(vervallenField);
    const fieldType = (tableFields.find((field) => field.name === vervallenField)?.type || '').toLowerCase();
    const value = normalizedName.includes('actief') ? false : fieldType.includes('bool') ? true : 'Vervallen';
    try {
      await updateNinoxRecord(tableId, id, { [vervallenField]: value });
      return;
    } catch {
      // fallback to hard delete below
    }
  }

  await deleteNinoxRecord(tableId, id);
}

export async function createNinoxBrevet(omschrijving: string): Promise<void> {
  const tableId = await fetchTableIdByName('Brevetten');
  if (!tableId) {
    throw new Error('Tabel Brevetten niet gevonden.');
  }
  const tableFields = await fetchNinoxTableFields(tableId);
  const omschrijvingField = findFieldName(tableFields, ['Omschrijving', 'Naam', 'Titel']) || 'Omschrijving';
  await createNinoxRecord(tableId, {
    [omschrijvingField]: omschrijving.trim(),
  });
}

export async function updateNinoxBrevet(id: number, omschrijving: string): Promise<void> {
  const tableId = await fetchTableIdByName('Brevetten');
  if (!tableId) {
    throw new Error('Tabel Brevetten niet gevonden.');
  }
  const tableFields = await fetchNinoxTableFields(tableId);
  const omschrijvingField = findFieldName(tableFields, ['Omschrijving', 'Naam', 'Titel']) || 'Omschrijving';
  await updateNinoxRecord(tableId, id, {
    [omschrijvingField]: omschrijving.trim(),
  });
}

export async function deleteNinoxBrevet(id: number): Promise<void> {
  const tableId = await fetchTableIdByName('Brevetten');
  if (!tableId) {
    throw new Error('Tabel Brevetten niet gevonden.');
  }
  await deleteNinoxRecord(tableId, id);
}

export async function createNinoxMailBericht(input: NieuwMailBerichtInput): Promise<void> {
  const tableId = await requireMailBerichtenTableId();
  const tableFields = await fetchNinoxTableFields(tableId);

  const onderwerpField = findFieldName(tableFields, ['Onderwerp', 'Titel', 'Omschrijving']);
  const inhoudField = findFieldName(tableFields, ['Bericht', 'Inhoud', 'Tekst']);
  const datumField = findFieldName(tableFields, ['Datum+tijd', 'Datum tijd', 'Datum', 'Verzenddatum']);
  const statusField = findFieldName(tableFields, ['Status']);
  const aanField = findFieldName(tableFields, ['Aan']);
  const ontvangersAantalField = findFieldName(tableFields, ['Ontvangers', 'Aantal ontvangers']);
  const ontvangersNamenField = findFieldName(tableFields, ['Ontvangers namen', 'Leden', 'Ontvangers lijst']);
  const ontvangersEmailField = findFieldName(tableFields, ['Ontvangers e-mail', 'Ontvangers email', 'E-mailadressen']);

  const basisEntries: Array<[string, unknown]> = [];
  if (onderwerpField && input.onderwerp.trim()) {
    basisEntries.push([onderwerpField, input.onderwerp.trim()]);
  }
  if (inhoudField && input.inhoud.trim()) {
    basisEntries.push([inhoudField, input.inhoud.trim()]);
  }
  if (datumField) {
    basisEntries.push([datumField, normalizeDateTimeToIso(input.datum)]);
  }
  if (statusField) {
    basisEntries.push([statusField, input.status || 'Concept']);
  }
  if (ontvangersAantalField && typeof input.ontvangersAantal === 'number') {
    basisEntries.push([ontvangersAantalField, input.ontvangersAantal]);
  }

  // Sommige Ninox schema's geven 500 bij specifieke combinaties/typen.
  // Daarom proberen we van volledig naar minimaal.
  let recordId: number | null = null;
  let lastError: unknown = null;
  const attempts: Array<Array<[string, unknown]>> = [];
  for (let keep = basisEntries.length; keep >= 0; keep -= 1) {
    attempts.push(basisEntries.slice(0, keep));
  }

  for (const attemptEntries of attempts) {
    const attemptFields = Object.fromEntries(attemptEntries);
    try {
      recordId = await createNinoxRecordReturningId(tableId, attemptFields);
      break;
    } catch (error) {
      lastError = error;
      if (!isServerErrorWithStatus(error, 500)) {
        throw error;
      }
    }
  }

  if (recordId === null) {
    const available = tableFields.map((field) => `${field.name}(${field.type})`).join(', ');
    const mapped = [
      `onderwerp=${onderwerpField || '-'}`,
      `inhoud=${inhoudField || '-'}`,
      `datum=${datumField || '-'}`,
      `status=${statusField || '-'}`,
    ].join(', ');
    const baseMessage = lastError instanceof Error ? lastError.message : 'Onbekende Ninox fout';
    throw new Error(`MailBericht aanmaken mislukt: ${baseMessage}. Mapped velden: ${mapped}. Beschikbaar: ${available}`);
  }

  // Optionele velden kunnen relationeel zijn in Ninox. Dan faalt platte tekst met 500.
  // Daarom best-effort per veld, zonder het hoofdrecord te blokkeren.
  const optioneleFieldUpdates: Record<string, unknown> = {};
  if (aanField && input.aan && input.aan.trim()) {
    optioneleFieldUpdates[aanField] = input.aan.trim();
  }
  if (ontvangersNamenField && input.ontvangerNamen && input.ontvangerNamen.length > 0) {
    optioneleFieldUpdates[ontvangersNamenField] = input.ontvangerNamen.join(', ');
  }
  if (ontvangersEmailField && input.ontvangerEmails && input.ontvangerEmails.length > 0) {
    optioneleFieldUpdates[ontvangersEmailField] = input.ontvangerEmails.join(', ');
  }

  for (const [fieldName, fieldValue] of Object.entries(optioneleFieldUpdates)) {
    try {
      await updateNinoxRecord(tableId, recordId, { [fieldName]: fieldValue });
    } catch {
      // Ignore incompatible optional fields.
    }
  }
}

export async function verzendMailBericht(
  input: VerzendMailBerichtInput,
  options?: { onProgress?: (progress: VerzendMailBerichtProgress) => void }
): Promise<VerzendMailBerichtResult> {
  const totaalAantal = (input.ontvangers || []).length;
  let ontvangers = (input.ontvangers || [])
    .map((item) => ({
      ...item,
      email: String(item.email || '').trim(),
    }))
    .filter((item) => item.email.length > 0);

  const shouldEnforceActieveLeden = !input.allowInactieveLeden && (typeof input.enforceActieveLeden === 'boolean' ? input.enforceActieveLeden : true);
  let uitgeslotenAantal = 0;
  if (shouldEnforceActieveLeden) {
    const gefilterd = await filterActieveLedenOntvangers(ontvangers, todayLocalIsoDate());
    ontvangers = gefilterd.actieveOntvangers;
    uitgeslotenAantal = gefilterd.uitgeslotenAantal;
  }

  if (ontvangers.length === 0) {
    if (shouldEnforceActieveLeden) {
      throw new Error('Geen actieve leden met e-mailadres gevonden op verzenddatum (vandaag).');
    }
    throw new Error('Minimaal 1 ontvanger met e-mail is verplicht.');
  }

  const reportProgress = options?.onProgress;
  reportProgress?.({ current: 0, total: ontvangers.length });

  // Bulkverzending loopt via de generieke mail-endpoint op de lokale server.
  try {
    const response = await fetchApi('/mail-send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Idempotency-Key': input.idempotencyKey,
      },
      body: JSON.stringify({
        ...input,
        ontvangers,
      }),
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      const message = typeof errorPayload?.message === 'string' ? errorPayload.message : 'Mail versturen mislukt.';
      throw new Error(message);
    }

    const payload = await response.json().catch(() => ({}));
    
    const messages = Array.isArray(payload?.Messages) ? payload.Messages : [];
    const fouten: string[] = [];
    let succesvolVerzonden = 0;
    
    for (const msg of messages) {
      const status = String(msg?.Status || '').toLowerCase();
      const toEmail = msg?.To?.[0]?.Email || 'onbekend';
      
      if (status === 'success') {
        succesvolVerzonden += 1;
        reportProgress?.({ current: succesvolVerzonden, total: ontvangers.length });
      } else if (status === 'error') {
        const errorMsg = msg?.ErrorMessage || 'Onbekende fout';
        fouten.push(`${toEmail}: ${errorMsg}`);
      }
    }

    if (fouten.length > 0) {
      console.warn(`[BULK MAIL] ${fouten.length} van ${ontvangers.length} berichten gefaald:`, fouten);
    }

    return {
      status: succesvolVerzonden > 0 ? 'success' : 'error',
      verzondenAantal: succesvolVerzonden,
      uitgeslotenAantal,
      totaalAantal,
      fouten: fouten.length > 0 ? fouten : undefined,
    };
    
  } catch (fetchError) {
    console.error('Bulk mail verzenden fetch error:', fetchError);
    const errorMessage = fetchError instanceof Error ? fetchError.message : 'Netwerk fout bij versturen mail';
    throw new Error(errorMessage);
  }
}

interface InstellingenGrootboekRefs {
  crediteurenRef: string;
  bankRef: string;
  debiteurenRef: string;
}

export interface GoogleInstellingen {
  accessToken: string;
  gebruikersnaam: string;
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  agendaCalendarIds: Record<string, string>;
}

async function fetchInstellingenGrootboekRefs(): Promise<InstellingenGrootboekRefs> {
  return fetchInstellingenGrootboekRefsWithDeps(ninoxInstellingenDeps);
}

export async function verhoogEnBewaarInstellingenFactuurnummer(): Promise<string> {
  return verhoogEnBewaarInstellingenFactuurnummerWithDeps(ninoxInstellingenDeps);
}

/**
 * Haalt het volgende unieke lidnummer op uit Instellingen
 * Verhoogt het lidnummer met 1 en controleert of het al bestaat in Leden tabel
 * Blijft ophogen tot een uniek nummer gevonden is
 * Slaat het nieuwe nummer op in Instellingen
 * @returns Het nieuwe unieke lidnummer
 */
export async function verhoogEnBewaarInstellingenLidnummer(): Promise<string> {
  return verhoogEnBewaarInstellingenLidnummerWithDeps(ninoxInstellingenDeps);
}

export async function fetchInstellingenBanknummer(): Promise<string> {
  return fetchInstellingenBanknummerWithDeps(ninoxInstellingenDeps);
}

export async function fetchStofzuigenInformatieRichText(): Promise<string> {
  const aliases = ['Informatie', 'Informatie Stofzuigen', 'Stofzuigen Informatie'];
  const normalizedAliases = aliases.map((alias) => normalizeCompare(alias));

  const extractFromFields = (fields: Record<string, unknown>): string => {
    for (const alias of aliases) {
      if (Object.prototype.hasOwnProperty.call(fields, alias)) {
        const rich = asRichTextHtml(fields[alias], '').trim();
        if (rich) {
          return rich;
        }
      }
    }
    for (const [key, value] of Object.entries(fields)) {
      const normalizedKey = normalizeCompare(String(key || ''));
      if (normalizedAliases.includes(normalizedKey)) {
        const rich = asRichTextHtml(value, '').trim();
        if (rich) {
          return rich;
        }
      }
    }
    return '';
  };

  const tryTableByName = async (tableName: string, perPage = 200): Promise<string> => {
    const tableId = await fetchTableIdByName(tableName);
    if (!tableId) {
      return '';
    }
    const records = await fetchTableRecords(tableId, perPage).catch(() => []);
    for (const record of records) {
      const fields = record.fields ?? {};
      const extracted = extractFromFields(fields);
      if (extracted) {
        return extracted;
      }
    }
    return '';
  };

  // 1) Eerst de beoogde instellingenbron.
  const fromInstellingen = await tryTableByName('Instellingen', 20);
  if (fromInstellingen) {
    return fromInstellingen;
  }

  // 2) Daarna expliciet Stofzuigen-page gerelateerde tabellen.
  const fromStofzuigen = await tryTableByName('Stofzuigen', 200);
  if (fromStofzuigen) {
    return fromStofzuigen;
  }

  // 3) Vaak staat page-data indirect in Leden.
  const fromLeden = await tryTableByName('Leden', 500);
  if (fromLeden) {
    return fromLeden;
  }

  // 4) Laatste fallback: Informatie-tabel (bij voorkeur onderwerp "Stofzuigen").
  const informatieTableId = await fetchTableIdByName('Informatie');
  if (informatieTableId) {
    const informatieRecords = await fetchTableRecords(informatieTableId, 1000).catch(() => []);
    const stofzuigenRecord = informatieRecords.find((record) => {
      const fields = record.fields ?? {};
      const onderwerp =
        asString(fields.Onderwerp).trim() ||
        asString(fields.Titel).trim() ||
        asString(fields.Naam).trim();
      return normalizeCompare(onderwerp) === normalizeCompare('Stofzuigen');
    });
    if (stofzuigenRecord) {
      const fields = stofzuigenRecord.fields ?? {};
      const rich =
        asRichTextHtml(fields.Omschrijving, '').trim() ||
        asRichTextHtml(fields.Inhoud, '').trim() ||
        asRichTextHtml(fields.Tekst, '').trim();
      if (rich) {
        return rich;
      }
    }

    // Extra fallback: pak de eerste niet-lege rich-text uit Informatie.
    for (const record of informatieRecords) {
      const fields = record.fields ?? {};
      const rich =
        asRichTextHtml(fields.Omschrijving, '').trim() ||
        asRichTextHtml(fields.Inhoud, '').trim() ||
        asRichTextHtml(fields.Tekst, '').trim();
      if (rich) {
        return rich;
      }
    }
  }

  // 5) Laatste redmiddel: scan alle tabellen op een veld "Informatie" en pak de eerste niet-lege rich text.
  try {
    const tablesResponse = await request('/tables');
    if (tablesResponse.ok) {
      const rawPayload = await tablesResponse.json().catch(() => null);
      if (rawPayload && Array.isArray(rawPayload)) {
        for (const table of rawPayload) {
          const tableId = String(table?.id ?? '').trim();
          if (!tableId) {
            continue;
          }
          const fields = await fetchNinoxTableFields(tableId).catch(() => []);
          const infoFieldName = findFieldName(fields, aliases);
          if (!infoFieldName) {
            continue;
          }
          const records = await fetchTableRecords(tableId, 500).catch(() => []);
          for (const record of records) {
            const rawFields = record.fields ?? {};
            const rich = asRichTextHtml(rawFields[infoFieldName], '').trim();
            if (rich) {
              return rich;
            }
          }
        }
      }
    }
  } catch {
    // Ignore scan errors and return empty below.
  }

  return '';
}

export async function fetchLogicaInformatieRichText(programmaTitel: string): Promise<string> {
  const target = String(programmaTitel || '').trim();
  if (!target) {
    return '';
  }

  const tableId = await fetchTableIdByName('Logica');
  if (!tableId) {
    return '';
  }

  const tableFields = await fetchNinoxTableFields(tableId).catch(() => []);
  const programmaField = findFieldName(tableFields, ['Programma', 'Onderwerp', 'Naam']) || 'Programma';
  const informatieField = findFieldName(tableFields, ['Informatie', 'Omschrijving', 'Inhoud', 'Tekst']) || 'Informatie';
  const records = await fetchTableRecords(tableId, 1000).catch(() => []);

  const match = records.find((record) => {
    const fields = record.fields ?? {};
    const programma =
      asString(fields[programmaField]).trim() ||
      asString(fields.Programma).trim() ||
      asString(fields.Onderwerp).trim() ||
      asString(fields.Naam).trim();
    return normalizeCompare(programma) === normalizeCompare(target);
  });

  if (!match) {
    return '';
  }

  const fields = match.fields ?? {};
  return (
    asRichTextHtml(fields[informatieField], '').trim() ||
    asRichTextHtml(fields.Informatie, '').trim() ||
    asRichTextHtml(fields.Omschrijving, '').trim() ||
    asRichTextHtml(fields.Inhoud, '').trim() ||
    asRichTextHtml(fields.Tekst, '').trim() ||
    ''
  );
}

export async function updateLogicaInformatieRichText(programmaTitel: string, html: string): Promise<void> {
  const target = String(programmaTitel || '').trim();
  if (!target) {
    throw new Error('Programma is verplicht.');
  }

  const tableId = await fetchTableIdByName('Logica');
  if (!tableId) {
    throw new Error('Tabel Logica niet gevonden.');
  }

  const normalizedHtml = String(html || '').trim();
  const tableFields = await fetchNinoxTableFields(tableId).catch(() => []);
  const programmaField = findFieldName(tableFields, ['Programma', 'Onderwerp', 'Naam']) || 'Programma';
  const informatieField = findFieldName(tableFields, ['Informatie', 'Omschrijving', 'Inhoud', 'Tekst']) || 'Informatie';
  const records = await fetchTableRecords(tableId, 1000).catch(() => []);

  const match = records.find((record) => {
    const fields = record.fields ?? {};
    const programma =
      asString(fields[programmaField]).trim() ||
      asString(fields.Programma).trim() ||
      asString(fields.Onderwerp).trim() ||
      asString(fields.Naam).trim();
    return normalizeCompare(programma) === normalizeCompare(target);
  });

  if (match && typeof match.id === 'number') {
    await updateNinoxRecord(tableId, match.id, {
      [informatieField]: normalizedHtml,
    });
    return;
  }

  await createNinoxRecord(tableId, {
    [programmaField]: target,
    [informatieField]: normalizedHtml,
  });
}

export async function updateStofzuigenInformatieRichText(html: string): Promise<void> {
  const normalizedHtml = String(html || '').trim();
  const aliases = ['Informatie', 'Informatie Stofzuigen', 'Stofzuigen Informatie'];

  const resolveFieldByAliases = async (tableId: string): Promise<string | null> => {
    const fields = await fetchNinoxTableFields(tableId).catch(() => []);
    if (!fields.length) {
      return null;
    }
    const direct = findFieldName(fields, aliases);
    if (direct) {
      return direct;
    }
    return null;
  };

  const tryUpdateFirstRecord = async (tableName: string): Promise<boolean> => {
    const tableId = await fetchTableIdByName(tableName);
    if (!tableId) {
      return false;
    }
    const fieldName = await resolveFieldByAliases(tableId);
    if (!fieldName) {
      return false;
    }
    const records = await fetchTableRecords(tableId, 50).catch(() => []);
    const first = records[0];
    if (!first || typeof first.id !== 'number') {
      return false;
    }
    await updateNinoxRecord(tableId, first.id, { [fieldName]: normalizedHtml });
    return true;
  };

  if (await tryUpdateFirstRecord('Instellingen')) {
    return;
  }
  if (await tryUpdateFirstRecord('Stofzuigen')) {
    return;
  }

  const informatieTableId = await fetchTableIdByName('Informatie');
  if (informatieTableId) {
    const tableFields = await fetchNinoxTableFields(informatieTableId).catch(() => []);
    const onderwerpField = findFieldName(tableFields, ['Onderwerp', 'Titel', 'Naam']) || 'Onderwerp';
    const omschrijvingField = findFieldName(tableFields, ['Omschrijving', 'Inhoud', 'Tekst']) || 'Omschrijving';
    const records = await fetchTableRecords(informatieTableId, 1000).catch(() => []);
    const bestaand = records.find((record) => {
      const fields = record.fields ?? {};
      const onderwerp =
        asString(fields[onderwerpField]).trim() ||
        asString(fields.Onderwerp).trim() ||
        asString(fields.Titel).trim() ||
        asString(fields.Naam).trim();
      return normalizeCompare(onderwerp) === normalizeCompare('Stofzuigen');
    });
    if (bestaand && typeof bestaand.id === 'number') {
      await updateNinoxRecord(informatieTableId, bestaand.id, { [omschrijvingField]: normalizedHtml });
      return;
    }
    await createNinoxRecord(informatieTableId, {
      [onderwerpField]: 'Stofzuigen',
      [omschrijvingField]: normalizedHtml,
    });
    return;
  }

  throw new Error('Geen bron gevonden om veld Informatie voor Stofzuigen op te slaan.');
}

export async function fetchGoogleInstellingen(): Promise<GoogleInstellingen> {
  return fetchGoogleInstellingenWithDeps(ninoxInstellingenDeps);
}

export async function saveGoogleTokensInstellingen(input: { accessToken: string; refreshToken?: string }): Promise<void> {
  await saveGoogleTokensInstellingenWithDeps(ninoxInstellingenDeps, input);
}

export interface NinoxRecordDocument {
  naam: string;
  blob: Blob;
}

function base64ToBlob(base64: string, contentType: string): Blob | null {
  try {
    const cleaned = base64.replace(/\s+/g, '');
    const binary = atob(cleaned);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: contentType || 'application/pdf' });
  } catch {
    return null;
  }
}

export async function fetchNinoxInkoopFactuurDocument(recordId: number): Promise<NinoxRecordDocument | null> {
  const listResponse = await request(`/tables/${tableIds.facturenInkoop}/records/${recordId}/files`);
  if (!listResponse.ok) {
    return null;
  }
  const payload = await listResponse.json().catch(() => []);
  if (!Array.isArray(payload) || payload.length === 0) {
    return null;
  }

  const names = payload
    .map((item) => asString((item as { name?: unknown })?.name).trim())
    .filter((name) => Boolean(name));
  if (names.length === 0) {
    return null;
  }

  const pdfName = names.find((name) => name.toLowerCase().endsWith('.pdf')) || names[names.length - 1];
  const fileResponse = await request(`/tables/${tableIds.facturenInkoop}/records/${recordId}/files/${encodeURIComponent(pdfName)}`, {
    headers: {
      Accept: 'application/pdf,application/octet-stream,*/*',
    },
  });
  if (!fileResponse.ok) {
    return null;
  }

  const contentType = (fileResponse.headers.get('content-type') || '').toLowerCase();
  let blob: Blob | null = null;
  if (contentType.includes('application/pdf') || contentType.includes('application/octet-stream')) {
    blob = await fileResponse.blob();
  } else {
    const wrapped = await fileResponse.json().catch(() => null);
    const wrappedBase64 =
      typeof wrapped?.bodyBase64 === 'string'
        ? wrapped.bodyBase64
        : typeof wrapped?.base64 === 'string'
        ? wrapped.base64
        : '';
    const wrappedContentType =
      typeof wrapped?.contentType === 'string' && wrapped.contentType.trim()
        ? wrapped.contentType
        : 'application/pdf';
    if (wrappedBase64) {
      blob = base64ToBlob(wrappedBase64, wrappedContentType);
    }
  }

  if (!blob || blob.size === 0) {
    return null;
  }

  return {
    naam: pdfName,
    blob,
  };
}

export async function fetchNinoxLidDocument(
  recordId: number,
  fieldName: 'Inschrijfformulier' | 'Vog' | 'Document'
): Promise<NinoxRecordDocument | null> {
  const fetchBinaryOrWrapped = async (path: string): Promise<Blob | null> => {
    const response = await request(path, {
      headers: {
        Accept: 'application/pdf,application/octet-stream,*/*',
      },
    });
    if (!response.ok) {
      return null;
    }
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('application/pdf') || contentType.includes('application/octet-stream')) {
      const blob = await response.blob();
      return blob.size > 0 ? blob : null;
    }
    const wrapped = await response.json().catch(() => null);
    const wrappedBase64 =
      typeof wrapped?.bodyBase64 === 'string'
        ? wrapped.bodyBase64
        : typeof wrapped?.base64 === 'string'
        ? wrapped.base64
        : '';
    const wrappedContentType =
      typeof wrapped?.contentType === 'string' && wrapped.contentType.trim()
        ? wrapped.contentType
        : 'application/pdf';
    if (!wrappedBase64) {
      return null;
    }
    const blob = base64ToBlob(wrappedBase64, wrappedContentType);
    return blob && blob.size > 0 ? blob : null;
  };

  const listResponse = await request(`/tables/${tableIds.leden}/records/${recordId}/files`);
  if (!listResponse.ok) {
    return null;
  }
  const payload = await listResponse.json().catch(() => []);
  if (!Array.isArray(payload) || payload.length === 0) {
    return null;
  }

  const names = payload
    .map((item) => asString((item as { name?: unknown })?.name).trim())
    .filter((name) => Boolean(name));
  if (names.length === 0) {
    return null;
  }

  const candidateName = await resolveLinkedFileNameForField(tableIds.leden, recordId, fieldName, names);
  if (!candidateName) {
    return null;
  }
  const blob = await fetchBinaryOrWrapped(
    `/tables/${tableIds.leden}/records/${recordId}/files/${encodeURIComponent(candidateName)}`
  );
  if (!blob) {
    return null;
  }
  return {
    naam: candidateName,
    blob,
  };
}

export async function fetchCalculatedNinoxGrootboek(): Promise<Grootboekrekening[]> {
  const [grootboekRecords, inkoopRecords, verkoopRecords, boekingenRecords, refs] = await Promise.all([
    fetchTableRecords(tableIds.grootboek, 500),
    fetchTableRecords(tableIds.facturenInkoop, 1000),
    fetchTableRecords(tableIds.facturenVerkoop, 1000),
    (async () => {
      const boekingenTableId = await fetchTableIdByName('Boekingen');
      if (!boekingenTableId) {
        return [] as NinoxRecord[];
      }
      return fetchTableRecords(boekingenTableId, 2000);
    })(),
    fetchInstellingenGrootboekRefs(),
  ]);

  const grootboekrekeningen: Grootboekrekening[] = grootboekRecords.map((record) => {
    const fields = record.fields ?? {};
    const nummer = asString(fields.Nummer, String(record.id));
    const categorieRaw = asString(fields.Categorie);
    const balansRaw = extractComparableText(fields.Balans) || asString(fields.Balans);
    const categorieOpNummer = mapCategorieFromRekeningNummer(nummer);

    return {
      id: record.id,
      nummer,
      naam: asString(fields.Omschrijving, `Rekening ${record.id}`),
      categorie: categorieOpNummer || mapCategorie(categorieRaw),
      categorieBron: categorieRaw,
      balans: asString(balansRaw).trim(),
      // Berekening rekeningschema start altijd vanaf nul.
      saldo: 0,
    };
  });

  const crediteurenIndex = findGrootboekIndexByRef(grootboekrekeningen, refs.crediteurenRef);
  if (crediteurenIndex < 0) {
    throw new Error(`Crediteuren rekening "${refs.crediteurenRef}" niet gevonden in Grootboekrekeningen.`);
  }

  const bankIndex = findGrootboekIndexByRef(grootboekrekeningen, refs.bankRef);
  if (bankIndex < 0) {
    throw new Error(`Bank rekening "${refs.bankRef}" niet gevonden in Grootboekrekeningen.`);
  }
  const debiteurenIndex = findGrootboekIndexByRef(grootboekrekeningen, refs.debiteurenRef);
  if (debiteurenIndex < 0) {
    throw new Error(`Debiteuren rekening "${refs.debiteurenRef}" niet gevonden in Grootboekrekeningen.`);
  }

  for (const record of inkoopRecords) {
    const fields = record.fields ?? {};
    const amount = Math.abs(asNumber(fields.Totaalbedrag));
    if (!amount) {
      continue;
    }

    const usedGrootboekRef = extractComparableText(fields.Grootboekrekening) || extractComparableText(fields.Grootboeknummer);
    const usedGrootboekIndex = findGrootboekIndexByRef(grootboekrekeningen, usedGrootboekRef);
    if (usedGrootboekIndex < 0) {
      continue;
    }

    grootboekrekeningen[crediteurenIndex].saldo += amount;
    grootboekrekeningen[usedGrootboekIndex].saldo += amount;

    const betaaldAmount = Math.min(Math.abs(asNumber(fields.Betaald)), amount);
    if (betaaldAmount > 0) {
      grootboekrekeningen[crediteurenIndex].saldo -= betaaldAmount;
      grootboekrekeningen[bankIndex].saldo -= betaaldAmount;
    }
  }

  for (const record of verkoopRecords) {
    const fields = record.fields ?? {};
    const totaalbedrag = Math.abs(asNumber(fields.Totaalbedrag));
    if (!totaalbedrag) {
      continue;
    }

    grootboekrekeningen[debiteurenIndex].saldo += totaalbedrag;

    const regels = [
      {
        ref:
          extractComparableText(fields['Grootboekrekening - 01']) ||
          extractComparableText(fields['Grootboeknummer - 01']),
        amount: Math.abs(asNumber(fields['Bedrag - 01'])),
      },
      {
        ref:
          extractComparableText(fields['Grootboekrekening - 02']) ||
          extractComparableText(fields['Grootboeknummer - 02']),
        amount: Math.abs(asNumber(fields['Bedrag - 02'])),
      },
    ];

    for (const regel of regels) {
      if (!regel.ref || !regel.amount) {
        continue;
      }
      const regelIndex = findGrootboekIndexByRef(grootboekrekeningen, regel.ref);
      if (regelIndex < 0) {
        continue;
      }
      grootboekrekeningen[regelIndex].saldo += regel.amount;
    }

    const betaaldAmount = Math.min(Math.abs(asNumber(fields.Betaald)), totaalbedrag);
    if (betaaldAmount > 0) {
      grootboekrekeningen[bankIndex].saldo += betaaldAmount;
      grootboekrekeningen[debiteurenIndex].saldo -= betaaldAmount;
    }
  }

  for (const record of boekingenRecords) {
    const fields = record.fields ?? {};
    const bedrag = Math.abs(asNumber(fields.Bedrag));
    if (!bedrag) {
      continue;
    }

    const vanRef =
      asString(fields['Van grootboeknummer']).trim() ||
      asString(fields['Van Grootboeknummer']).trim() ||
      asString(fields['Grootboeknummer van']).trim() ||
      extractComparableText(fields['Van grootboekrekening']) ||
      extractComparableText(fields['Van Grootboekrekening']) ||
      extractComparableText(fields['Grootboekrekening van']);
    const naarRef =
      asString(fields['Naar grootboeknummer']).trim() ||
      asString(fields['Naar Grootboeknummer']).trim() ||
      asString(fields['Grootboeknummer naar']).trim() ||
      extractComparableText(fields['Naar grootboekrekening']) ||
      extractComparableText(fields['Naar Grootboekrekening']) ||
      extractComparableText(fields['Grootboekrekening naar']);

    const vanIndex = vanRef ? findGrootboekIndexByRef(grootboekrekeningen, vanRef) : -1;
    const naarIndex = naarRef ? findGrootboekIndexByRef(grootboekrekeningen, naarRef) : -1;

    if (vanIndex >= 0) {
      grootboekrekeningen[vanIndex].saldo -= bedrag;
    }
    if (naarIndex >= 0) {
      grootboekrekeningen[naarIndex].saldo += bedrag;
    }
  }

  return grootboekrekeningen;
}

function hashString(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function getCalculatedNinoxGrootboekLogicSignature(): string {
  const source = fetchCalculatedNinoxGrootboek.toString().replace(/\s+/g, ' ').trim();
  return `grootboek-${hashString(source)}`;
}

export function getCalculatedNinoxGrootboekLogicTemplateHtml(): string {
  return [
    '<p>Deze tekst is automatisch opgebouwd vanuit de huidige berekeningslogica in de code.</p>',
    '<p><strong>Volgorde van berekenen</strong></p>',
    '<ol>',
    '<li>Start met saldo 0 voor elke rekening.</li>',
    '<li>Verwerk inkoopfacturen (crediteuren, gekozen grootboek en betalingen).</li>',
    '<li>Verwerk verkoopfacturen (debiteuren, regels 01/02 en betalingen).</li>',
    '<li>Verwerk memoriaalboekingen (van-rekening min, naar-rekening plus).</li>',
    '</ol>',
    '<p><strong>Bronvelden</strong>: Grootboek.Nummer, Grootboek.Categorie, Inkoopfacturen.Totaalbedrag, Verkoopfacturen.Totaalbedrag, Boekingen.Bedrag.</p>',
  ].join('');
}

export function getCalculatedNinoxInkoopFacturenLogicTemplateHtml(): string {
  return [
    '<p>Deze tekst is automatisch opgebouwd vanuit de huidige inkoopfactuur-logica in de code.</p>',
    '<p><strong>Volgorde van verwerken</strong></p>',
    '<ol>',
    '<li>Lees totaalbedrag en gekozen grootboekrekening in.</li>',
    '<li>Sla de koppeling naar grootboek op als record-id in het Ninox linkveld.</li>',
    '<li>Sla daarnaast het zichtbare grootboeknummer op in het tekstveld.</li>',
    '<li>Bij markeren als betaald: zet <em>Betaald</em> op het factuurtotaal en vul <em>Betaaldatum</em>.</li>',
    '</ol>',
    '<p><strong>Bronvelden</strong>: Inkoopfacturen.Factuurnummer, Inkoopfacturen.Factuurdatum, Inkoopfacturen.Titel, Inkoopfacturen.Totaalbedrag, Inkoopfacturen.Grootboekrekening, Inkoopfacturen.Grootboeknummer, Inkoopfacturen.Betaald, Inkoopfacturen.Betaaldatum, Inkoopfacturen.Door.</p>',
  ].join('');
}

export function getCalculatedNinoxVerkoopFacturenLogicTemplateHtml(): string {
  return [
    '<p>Deze tekst is automatisch opgebouwd vanuit de huidige verkoopfactuur-logica in de code.</p>',
    '<p><strong>Volgorde van verwerken</strong></p>',
    '<ol>',
    '<li>Lees factuurkop en regelbedragen in (regel 01 en optioneel regel 02).</li>',
    '<li>Sla per regel de grootboekkoppeling op als record-id in het Ninox linkveld.</li>',
    '<li>Sla daarnaast per regel het zichtbare grootboeknummer op in het tekstveld.</li>',
    '<li>Bij markeren als betaald: zet <em>Betaald</em> op het factuurtotaal en vul <em>Betaaldatum</em>.</li>',
    '</ol>',
    '<p><strong>Bronvelden</strong>: Verkoopfacturen.Factuurnummer, Verkoopfacturen.Factuurdatum, Verkoopfacturen.Titel, Verkoopfacturen.Bedrag - 01, Verkoopfacturen.Bedrag - 02, Verkoopfacturen.Totaalbedrag, Verkoopfacturen.Grootboekrekening - 01, Verkoopfacturen.Grootboekrekening - 02, Verkoopfacturen.Grootboeknummer - 01, Verkoopfacturen.Grootboeknummer - 02, Verkoopfacturen.Betaald, Verkoopfacturen.Betaaldatum, Verkoopfacturen.Door.</p>',
  ].join('');
}

export function getCalculatedNinoxMemoriaalLogicTemplateHtml(): string {
  return [
    '<p>Deze tekst is automatisch opgebouwd vanuit de huidige memoriaal-logica in de code.</p>',
    '<p><strong>Volgorde van verwerken</strong></p>',
    '<ol>',
    '<li>Lees bedrag, van-rekening en naar-rekening van de boeking.</li>',
    '<li>Zoek de gekoppelde grootboekrekeningen op basis van nummer of linkveld.</li>',
    '<li>Trek het bedrag af van de van-rekening.</li>',
    '<li>Tel hetzelfde bedrag op bij de naar-rekening.</li>',
    '</ol>',
    '<p><strong>Bronvelden</strong>: Boekingen.Datum, Boekingen.Omschrijving, Boekingen.Bedrag, Boekingen.Van grootboeknummer, Boekingen.Naar grootboeknummer, Boekingen.Van grootboekrekening, Boekingen.Naar grootboekrekening.</p>',
  ].join('');
}

export function getCalculatedNinoxRelatiesLogicTemplateHtml(): string {
  return [
    '<p>Deze tekst is automatisch opgebouwd vanuit de huidige relaties-logica in de code.</p>',
    '<p><strong>Volgorde van verwerken</strong></p>',
    '<ol>',
    '<li>Lees relatiegegevens en standaard grootboekkoppeling in.</li>',
    '<li>Zoek voor de gekozen grootboekwaarde het echte Ninox record-id op.</li>',
    '<li>Sla de koppeling op in het linkveld <em>Standaard grootboekrekening</em>.</li>',
    '<li>Sla daarnaast het grootboeknummer en de omschrijving op in de bijbehorende tekstvelden.</li>',
    '</ol>',
    '<p><strong>Bronvelden</strong>: Relaties.Naam relatie, Relaties.Adres, Relaties.Postcode, Relaties.Woonplaats, Relaties.Land, Relaties.Contactpersoon - 01, Relaties.Mail - 01, Relaties.Standaard grootboekrekening, Relaties.Standaard grootboeknummer, Relaties.Standaard grootboekomschrijving, Relaties.Opmerkingen, Grootboek.id, Grootboek.Nummer, Grootboek.Omschrijving.</p>',
  ].join('');
}
