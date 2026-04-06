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

export interface NinoxRecordDocument {
  naam: string;
  blob: Blob;
}

interface NinoxRecordLike {
  id: number;
  fields?: Record<string, unknown>;
}

interface NinoxTableFieldLike {
  name: string;
}

interface NinoxInstellingenDependencies {
  fetchTableIdByName: (tableName: string) => Promise<string | null>;
  fetchTableRecords: (tableId: string, perPage?: number) => Promise<NinoxRecordLike[]>;
  fetchNinoxTableFields: (tableId: string) => Promise<NinoxTableFieldLike[]>;
  updateNinoxRecord: (tableId: string, id: number, fields: Record<string, unknown>) => Promise<void>;
  uploadNinoxRecordDocument: (tableId: string, recordId: number, file: File, fieldName: string) => Promise<void>;
  fetchRecordFileNames: (tableId: string, recordId: number) => Promise<string[]>;
  resolveLinkedFileNameForField: (tableId: string, recordId: number, fieldName: string, fileNames: string[]) => Promise<string | null>;
  request: (path: string, init?: RequestInit) => Promise<Response>;
  asString: (value: unknown, fallback?: string) => string;
  extractComparableText: (value: unknown) => string;
  normalizeCompare: (value: string) => string;
  asIntegerNumber: (value: unknown, fallback?: number) => number;
  base64ToBlob: (base64: string, contentType: string) => Blob | null;
}

async function requireInstellingenTableId(deps: NinoxInstellingenDependencies): Promise<string> {
  const tableId = await deps.fetchTableIdByName('Instellingen');
  if (!tableId) {
    throw new Error('Tabel Instellingen niet gevonden.');
  }
  return tableId;
}

async function fetchInstellingenRecord(deps: NinoxInstellingenDependencies): Promise<{ tableId: string; record: NinoxRecordLike }> {
  const tableId = await requireInstellingenTableId(deps);
  const records = await deps.fetchTableRecords(tableId, 10);
  const record = records[0];
  if (!record || typeof record.id !== 'number') {
    throw new Error('Geen Instellingen-record gevonden.');
  }
  return { tableId, record };
}

async function fetchInstellingenDocument(
  deps: NinoxInstellingenDependencies,
  recordId: number,
  fieldName: 'Document - 01' | 'Document - 02'
): Promise<NinoxRecordDocument | null> {
  const tableId = await requireInstellingenTableId(deps);
  const listResponse = await deps.request(`/tables/${tableId}/records/${recordId}/files`);
  if (!listResponse.ok) {
    return null;
  }
  const payload = await listResponse.json().catch(() => []);
  if (!Array.isArray(payload) || payload.length === 0) {
    return null;
  }

  const names = payload
    .map((item) => deps.asString((item as { name?: unknown })?.name).trim())
    .filter((name) => Boolean(name));
  if (names.length === 0) {
    return null;
  }

  const candidateName = await deps.resolveLinkedFileNameForField(tableId, recordId, fieldName, names);
  if (!candidateName) {
    return null;
  }

  const response = await deps.request(`/tables/${tableId}/records/${recordId}/files/${encodeURIComponent(candidateName)}`, {
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
      blob = deps.base64ToBlob(wrappedBase64, wrappedContentType);
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

async function clearInstellingenDocument(
  deps: NinoxInstellingenDependencies,
  recordId: number,
  fieldName: 'Document - 01' | 'Document - 02'
): Promise<void> {
  const tableId = await requireInstellingenTableId(deps);
  const listNames = await deps.fetchRecordFileNames(tableId, recordId);
  const linkedName = await deps.resolveLinkedFileNameForField(tableId, recordId, fieldName, listNames);

  const clearAttempts: Array<Record<string, unknown>> = [{ [fieldName]: '' }, { [fieldName]: null }, { [fieldName]: [] }];
  let cleared = false;
  let lastError: unknown = null;
  for (const fields of clearAttempts) {
    try {
      await deps.updateNinoxRecord(tableId, recordId, fields);
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

  const deleteResponse = await deps.request(`/tables/${tableId}/records/${recordId}/files/${encodeURIComponent(linkedName)}`, {
    method: 'DELETE',
  });
  if (!deleteResponse.ok && deleteResponse.status !== 404) {
    const errorPayload = await deleteResponse.json().catch(() => ({}));
    const message = typeof errorPayload?.message === 'string' ? errorPayload.message : 'Onbekende Ninox fout';
    throw new Error(`PDF verwijderen mislukt (${deleteResponse.status}): ${message}`);
  }
}

export async function fetchNinoxInstellingenOverzichtWithDeps(
  deps: NinoxInstellingenDependencies
): Promise<NinoxInstellingItem[]> {
  const tableId = await requireInstellingenTableId(deps);
  const records = await deps.fetchTableRecords(tableId, 200);

  return records
    .map((record) => {
      const fields = record.fields ?? {};
      const factuurnummer = deps.extractComparableText(fields.Factuurnummer) || deps.asString(fields.Factuurnummer);
      const naam =
        deps.extractComparableText(fields.Naam) ||
        deps.asString(fields.Naam) ||
        deps.asString(fields['Naam vereniging']) ||
        deps.asString(fields.Vereniging) ||
        '';

      return {
        id: record.id,
        factuurnummer: String(factuurnummer || '').trim(),
        naam: String(naam || '').trim(),
        adres: String(deps.extractComparableText(fields.Adres) || deps.asString(fields.Adres) || '').trim(),
        postcode: String(deps.extractComparableText(fields.Postcode) || deps.asString(fields.Postcode) || '').trim(),
        woonplaats: String(deps.extractComparableText(fields.Woonplaats) || deps.asString(fields.Woonplaats) || '').trim(),
        rawFields: fields,
      } satisfies NinoxInstellingItem;
    })
    .sort((a, b) => a.naam.localeCompare(b.naam, 'nl', { sensitivity: 'base', numeric: true }));
}

export async function updateNinoxInstellingAlgemeenWithDeps(
  deps: NinoxInstellingenDependencies,
  id: number,
  input: UpdateNinoxInstellingAlgemeenInput
): Promise<void> {
  const tableId = await requireInstellingenTableId(deps);
  const raw = input.rawFields || {};
  const rawFieldNames = Object.keys(raw);
  const rawFieldNamesByNormalized = new Map<string, string>();
  for (const fieldName of rawFieldNames) {
    rawFieldNamesByNormalized.set(deps.normalizeCompare(fieldName), fieldName);
  }

  const tableFields = await deps.fetchNinoxTableFields(tableId);
  const tableFieldNamesByNormalized = new Map<string, string>();
  for (const field of tableFields) {
    if (typeof field.name === 'string' && field.name.trim()) {
      tableFieldNamesByNormalized.set(deps.normalizeCompare(field.name), field.name);
    }
  }

  const resolveFieldName = (aliases: string[], fallback: string): string => {
    for (const alias of aliases) {
      if (Object.prototype.hasOwnProperty.call(raw, alias)) {
        return alias;
      }
    }
    const normalizedAliases = aliases.map((alias) => deps.normalizeCompare(alias));
    for (const key of Object.keys(raw)) {
      if (normalizedAliases.includes(deps.normalizeCompare(key))) {
        return key;
      }
    }
    return fallback;
  };

  const naamField = resolveFieldName(['Naam', 'Naam vereniging', 'Vereniging'], 'Naam');
  const adresField = resolveFieldName(['Adres'], 'Adres');
  const postcodeField = resolveFieldName(['Postcode'], 'Postcode');
  const woonplaatsField = resolveFieldName(['Woonplaats'], 'Woonplaats');
  const kvkField = resolveFieldName(['KvK nummer', 'Kvk nummer', 'Kvknummer', 'KvK'], 'KvK nummer');
  const lidnummerField = resolveFieldName(['Lidnummer', 'Lid nummer'], 'Lidnummer');
  const factuurnummerField = resolveFieldName(['Factuurnummer', 'Factuur nummer'], 'Factuurnummer');
  const crediteurenField = resolveFieldName(['Crediteuren'], 'Crediteuren');
  const debiteurenField = resolveFieldName(['Debiteuren'], 'Debiteuren');
  const bankField = resolveFieldName(['Bank'], 'Bank');
  const kasField = resolveFieldName(['Kas'], 'Kas');
  const logoMailField = resolveFieldName(['Locatie logo mail', 'Logo mail locatie'], 'Locatie logo mail');
  const logoFactuurField = resolveFieldName(['Locatie logo factuur', 'Logo factuur locatie'], 'Locatie logo factuur');
  const incassantIdField = resolveFieldName(['Incassant id', 'Incassantid', 'Incassant ID'], 'Incassant id');

  const asLinkOrText = (value: string): number | string => {
    const trimmed = String(value || '').trim();
    if (/^\d+$/.test(trimmed)) {
      return Number(trimmed);
    }
    return trimmed;
  };

  const payload: Record<string, unknown> = {
    [naamField]: String(input.naam || '').trim(),
    [adresField]: String(input.adres || '').trim(),
    [postcodeField]: String(input.postcode || '').trim(),
    [woonplaatsField]: String(input.woonplaats || '').trim(),
    [kvkField]: String(input.kvkNummer || '').trim(),
    [lidnummerField]: String(input.lidnummer || '').trim(),
    [factuurnummerField]: String(input.factuurnummer || '').trim(),
    [crediteurenField]: asLinkOrText(input.crediteuren),
    [debiteurenField]: asLinkOrText(input.debiteuren),
    [bankField]: asLinkOrText(input.bank),
    [kasField]: asLinkOrText(input.kas),
    [logoMailField]: String(input.locatieLogoMail || '').trim(),
    [logoFactuurField]: String(input.locatieLogoFactuur || '').trim(),
    [incassantIdField]: String(input.incassantId || '').trim(),
  };

  const extraFields = input.extraFields || {};
  for (const [key, value] of Object.entries(extraFields)) {
    const normalizedKey = deps.normalizeCompare(key);
    const matchedRawField = rawFieldNamesByNormalized.get(normalizedKey);
    const matchedTableField = tableFieldNamesByNormalized.get(normalizedKey);
    const resolvedFieldName = matchedRawField || matchedTableField;
    if (!resolvedFieldName) {
      continue;
    }
    payload[resolvedFieldName] = String(value ?? '').trim();
  }

  await deps.updateNinoxRecord(tableId, id, payload);
}

export async function uploadNinoxInstellingenDocument01WithDeps(
  deps: NinoxInstellingenDependencies,
  recordId: number,
  file: File
): Promise<void> {
  const tableId = await requireInstellingenTableId(deps);
  await deps.uploadNinoxRecordDocument(tableId, recordId, file, 'Document - 01');
}

export async function uploadNinoxInstellingenDocument02WithDeps(
  deps: NinoxInstellingenDependencies,
  recordId: number,
  file: File
): Promise<void> {
  const tableId = await requireInstellingenTableId(deps);
  await deps.uploadNinoxRecordDocument(tableId, recordId, file, 'Document - 02');
}

export async function clearNinoxInstellingenDocument01WithDeps(
  deps: NinoxInstellingenDependencies,
  recordId: number
): Promise<void> {
  await clearInstellingenDocument(deps, recordId, 'Document - 01');
}

export async function clearNinoxInstellingenDocument02WithDeps(
  deps: NinoxInstellingenDependencies,
  recordId: number
): Promise<void> {
  await clearInstellingenDocument(deps, recordId, 'Document - 02');
}

export async function fetchNinoxInstellingenDocument01WithDeps(
  deps: NinoxInstellingenDependencies,
  recordId: number
): Promise<NinoxRecordDocument | null> {
  return fetchInstellingenDocument(deps, recordId, 'Document - 01');
}

export async function fetchNinoxInstellingenDocument02WithDeps(
  deps: NinoxInstellingenDependencies,
  recordId: number
): Promise<NinoxRecordDocument | null> {
  return fetchInstellingenDocument(deps, recordId, 'Document - 02');
}

export async function fetchInstellingenGrootboekRefsWithDeps(
  deps: NinoxInstellingenDependencies
): Promise<InstellingenGrootboekRefs> {
  const { record } = await fetchInstellingenRecord(deps);
  const instellingen = record.fields ?? {};
  const crediteurenRef = deps.extractComparableText(instellingen.Crediteuren);
  const bankRef = deps.extractComparableText(instellingen.Bank);
  const debiteurenRef = deps.extractComparableText(instellingen.Debiteuren);

  if (!crediteurenRef) {
    throw new Error('Veld Instellingen.Crediteuren is leeg of ongeldig.');
  }
  if (!bankRef) {
    throw new Error('Veld Instellingen.Bank is leeg of ongeldig.');
  }
  if (!debiteurenRef) {
    throw new Error('Veld Instellingen.Debiteuren is leeg of ongeldig.');
  }

  return { crediteurenRef, bankRef, debiteurenRef };
}

export async function verhoogEnBewaarInstellingenFactuurnummerWithDeps(
  deps: NinoxInstellingenDependencies
): Promise<string> {
  const { tableId, record } = await fetchInstellingenRecord(deps);
  const huidig = deps.asIntegerNumber(record.fields?.Factuurnummer, 0);
  const nieuw = huidig + 1;
  await deps.updateNinoxRecord(tableId, record.id, { Factuurnummer: nieuw });
  return String(nieuw);
}

export async function verhoogEnBewaarInstellingenLidnummerWithDeps(
  deps: NinoxInstellingenDependencies
): Promise<string> {
  const { tableId, record } = await fetchInstellingenRecord(deps);
  const ledenTableId = await deps.fetchTableIdByName('Leden');
  if (!ledenTableId) {
    throw new Error('Tabel Leden niet gevonden.');
  }

  let nieuw = deps.asIntegerNumber(record.fields?.Lidnummer, 0) + 1;
  const alleLeden = await deps.fetchTableRecords(ledenTableId, 9999);
  const bestaandeLidnummers = new Set(
    alleLeden.map((lid) => deps.asIntegerNumber(lid.fields?.Lidnummer, 0)).filter((num) => num > 0)
  );

  while (bestaandeLidnummers.has(nieuw)) {
    nieuw += 1;
  }

  await deps.updateNinoxRecord(tableId, record.id, { Lidnummer: nieuw });
  return String(nieuw);
}

export async function fetchInstellingenBanknummerWithDeps(
  deps: NinoxInstellingenDependencies
): Promise<string> {
  const { record } = await fetchInstellingenRecord(deps);
  const fields = record.fields ?? {};
  const candidates = ['Bankrekeningnummer', 'Bank rekeningnummer', 'Banknummer', 'IBAN', 'Rekeningnummer', 'Banknummer vereniging'];

  for (const candidate of candidates) {
    const direct = deps.extractComparableText(fields[candidate]) || deps.asString(fields[candidate]).trim();
    if (direct) {
      return direct;
    }
  }

  for (const [key, value] of Object.entries(fields)) {
    const normalized = deps.normalizeCompare(key);
    if (normalized.includes('banknummer') || normalized === 'iban' || normalized.includes('rekeningnummer')) {
      const extracted = deps.extractComparableText(value) || deps.asString(value).trim();
      if (extracted) {
        return extracted;
      }
    }
  }

  return '';
}

export async function fetchGoogleInstellingenWithDeps(
  deps: NinoxInstellingenDependencies
): Promise<GoogleInstellingen> {
  const { record } = await fetchInstellingenRecord(deps);
  const fields = record.fields ?? {};

  const accessToken =
    deps.extractComparableText(fields['Google access token']) ||
    deps.extractComparableText(fields['Google acces token']) ||
    deps.extractComparableText(fields['Google token']) ||
    '';
  const gebruikersnaam =
    deps.extractComparableText(fields['Google gebruikersnaam']) ||
    deps.extractComparableText(fields['Google gebruiker']) ||
    deps.extractComparableText(fields['Google username']) ||
    '';
  const refreshToken =
    deps.extractComparableText(fields['Google refresh token']) ||
    deps.extractComparableText(fields['Google refreshtoken']) ||
    deps.extractComparableText(fields['Google refresh']) ||
    '';
  const clientId =
    deps.extractComparableText(fields['Google client id']) ||
    deps.extractComparableText(fields['Google clientid']) ||
    deps.extractComparableText(fields['Google oauth client id']) ||
    '';
  const clientSecret =
    deps.extractComparableText(fields['Google client secret']) ||
    deps.extractComparableText(fields['Google clientsecret']) ||
    deps.extractComparableText(fields['Google oauth client secret']) ||
    '';

  const findFieldValueByAliases = (aliases: string[]): string => {
    for (const alias of aliases) {
      const direct = deps.extractComparableText(fields[alias]);
      if (direct) {
        return direct;
      }
    }
    const normalizedAliases = aliases.map((alias) => deps.normalizeCompare(alias));
    for (const [key, value] of Object.entries(fields)) {
      const normalizedKey = deps.normalizeCompare(String(key || ''));
      if (normalizedAliases.some((alias) => alias === normalizedKey)) {
        const extracted = deps.extractComparableText(value);
        if (extracted) {
          return extracted;
        }
      }
    }
    return '';
  };

  const agendaCalendarIds: Record<string, string> = {
    Planning: findFieldValueByAliases(['Google agenda Planning', 'Google calendar id Planning', 'Google agenda-id Planning', 'Google Planning']),
    Stofzuigen: findFieldValueByAliases(['Google agenda Stofzuigen', 'Google calendar id Stofzuigen', 'Google agenda-id Stofzuigen', 'Google Stofzuigen']),
    Onderwervoetbal: findFieldValueByAliases([
      'Google agenda Onderwervoetbal',
      'Google agenda Onderwatervoetbal',
      'Google calendar id Onderwatervoetbal',
      'Google agenda-id Onderwatervoetbal',
      'Google Onderwatervoetbal',
    ]),
    Toezichthouders: findFieldValueByAliases([
      'Google agenda Toezichthouders',
      'Google calendar id Toezichthouders',
      'Google agenda-id Toezichthouders',
      'Google Toezichthouders',
    ]),
    'Training geven': findFieldValueByAliases([
      'Google agenda Training geven',
      'Google calendar id Training geven',
      'Google agenda-id Training geven',
      'Google Training geven',
    ]),
    Opleiding: findFieldValueByAliases(['Google agenda Opleiding', 'Google calendar id Opleiding', 'Google agenda-id Opleiding', 'Google Opleiding']),
  };

  return {
    accessToken,
    gebruikersnaam,
    refreshToken,
    clientId,
    clientSecret,
    agendaCalendarIds,
  };
}

export async function saveGoogleTokensInstellingenWithDeps(
  deps: NinoxInstellingenDependencies,
  input: { accessToken: string; refreshToken?: string }
): Promise<void> {
  const { tableId, record } = await fetchInstellingenRecord(deps);
  const fields = record.fields ?? {};

  const findFieldName = (aliases: string[], fallback: string): string => {
    for (const alias of aliases) {
      if (Object.prototype.hasOwnProperty.call(fields, alias)) {
        return alias;
      }
    }
    const normalizedAliases = aliases.map((alias) => deps.normalizeCompare(alias));
    for (const key of Object.keys(fields)) {
      const normalizedKey = deps.normalizeCompare(key);
      if (normalizedAliases.includes(normalizedKey)) {
        return key;
      }
    }
    return fallback;
  };

  const accessFieldName = findFieldName(['Google access token', 'Google acces token', 'Google token'], 'Google access token');
  const refreshFieldName = findFieldName(['Google refresh token', 'Google refreshtoken', 'Google refresh'], 'Google refresh token');

  const updates: Record<string, unknown> = {
    [accessFieldName]: String(input.accessToken || '').trim(),
  };
  const refresh = String(input.refreshToken || '').trim();
  if (refresh) {
    updates[refreshFieldName] = refresh;
  }

  await deps.updateNinoxRecord(tableId, record.id, updates);
}
