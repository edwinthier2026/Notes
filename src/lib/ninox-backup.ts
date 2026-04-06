export interface NinoxTable {
  id: string;
  name: string;
  recordCount?: number;
}

export interface NinoxChoiceOption {
  id: string;
  caption: string;
}

export interface NinoxTableField {
  id: string;
  name: string;
  type: string;
  choices?: NinoxChoiceOption[];
}

export interface NinoxBackupProgress {
  phase?: 'records' | 'files';
  tableIndex: number;
  tableCount: number;
  tableId?: string;
  tableName: string;
  recordCount: number;
  fileCount?: number;
  fileIndex?: number;
  fileName?: string;
}

export interface NinoxBackupFile {
  fieldName?: string;
  naam: string;
  contentType: string;
  size: number;
  path: string;
}

export interface NinoxBackupRecord {
  id: number;
  modifiedAt?: string;
  fields: Record<string, unknown>;
  files?: NinoxBackupFile[];
}

export interface NinoxBackupTableDump {
  id: string;
  name: string;
  fields: NinoxTableField[];
  recordCount: number;
  fileCount?: number;
  records: NinoxBackupRecord[];
}

export interface NinoxBackupDump {
  generatedAt: string;
  source: 'ninox';
  tableCount: number;
  totalRecords: number;
  totalFiles?: number;
  tables: NinoxBackupTableDump[];
}

export interface NinoxBackupArchive {
  dump: NinoxBackupDump;
  blob: Blob;
}

interface NinoxRecordLike {
  id: number;
  modifiedAt?: string;
  fields?: Record<string, unknown>;
}

type ZipBlobEntry = { path: string; blob: Blob };

interface NinoxBackupDependencies {
  request: (path: string, init?: RequestInit) => Promise<Response>;
  parseTables: (response: Response) => Promise<NinoxTable[]>;
  fetchNinoxTableFields: (tableId: string) => Promise<NinoxTableField[]>;
  fetchTableRecords: (tableId: string, perPage?: number) => Promise<NinoxRecordLike[]>;
  fetchRecordFileNames: (tableId: string, recordId: number) => Promise<string[]>;
  resolveLinkedFileNameForField: (tableId: string, recordId: number, fieldName: string, fileNames: string[]) => Promise<string | null>;
  base64ToBlob: (base64: string, contentType: string) => Blob | null;
  normalizeCompare: (value: string) => string;
  asString: (value: unknown, fallback?: string) => string;
}

function sanitizeBackupPathSegment(value: string, fallback: string): string {
  const normalized = String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^\.+|\.+$/g, '')
    .trim();
  return normalized || fallback;
}

async function fetchNinoxTablesForBackup(deps: NinoxBackupDependencies): Promise<NinoxTable[]> {
  const tablesResponse = await deps.request('/tables');
  if (!tablesResponse.ok) {
    const errorPayload = await tablesResponse.json().catch(() => ({}));
    const message = typeof errorPayload?.message === 'string' ? errorPayload.message : 'Onbekende Ninox fout';
    throw new Error(`Tabellen ophalen mislukt (${tablesResponse.status}): ${message}`);
  }

  const rawTables = await deps.parseTables(tablesResponse);
  return [...rawTables].sort((a, b) => a.name.localeCompare(b.name, 'nl', { sensitivity: 'base' }));
}

async function fetchNinoxRecordFileBlob(
  deps: NinoxBackupDependencies,
  tableId: string,
  recordId: number,
  fileName: string
): Promise<Blob | null> {
  const response = await deps.request(`/tables/${tableId}/records/${recordId}/files/${encodeURIComponent(fileName)}`, {
    headers: {
      Accept: 'application/pdf,application/octet-stream,*/*',
    },
  });
  if (!response.ok) {
    return null;
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('application/pdf') || contentType.includes('application/octet-stream') || contentType.startsWith('image/')) {
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
      : 'application/octet-stream';
  if (!wrappedBase64) {
    return null;
  }

  const blob = deps.base64ToBlob(wrappedBase64, wrappedContentType);
  return blob && blob.size > 0 ? blob : null;
}

async function fetchNinoxRecordBackupFiles(
  deps: NinoxBackupDependencies,
  table: NinoxTable,
  record: NinoxRecordLike,
  schemaFields: NinoxTableField[],
  tableFolderName: string,
  onProgress?: (progress: NinoxBackupProgress) => void,
  progressBase?: Omit<NinoxBackupProgress, 'phase' | 'fileCount' | 'fileIndex' | 'fileName'>
): Promise<{ files: NinoxBackupFile[]; zipEntries: ZipBlobEntry[] }> {
  const recordId = typeof record.id === 'number' ? record.id : 0;
  if (!recordId) {
    return { files: [], zipEntries: [] };
  }

  const fileNames = await deps.fetchRecordFileNames(table.id, recordId);
  if (fileNames.length === 0) {
    return { files: [], zipEntries: [] };
  }

  const linkedFields = await Promise.all(
    schemaFields.map(async (field) => ({
      fieldName: field.name,
      linkedFileName: await deps.resolveLinkedFileNameForField(table.id, recordId, field.name, fileNames),
    }))
  );

  const files: NinoxBackupFile[] = [];
  const zipEntries: ZipBlobEntry[] = [];
  const recordFolder = sanitizeBackupPathSegment(`record-${recordId}`, `record-${recordId}`);

  for (let index = 0; index < fileNames.length; index += 1) {
    const fileName = fileNames[index];
    onProgress?.({
      ...(progressBase ?? { tableIndex: 1, tableCount: 1, tableName: table.name, recordCount: 0 }),
      phase: 'files',
      fileCount: fileNames.length,
      fileIndex: index + 1,
      fileName,
    });

    const blob = await fetchNinoxRecordFileBlob(deps, table.id, recordId, fileName);
    if (!blob) {
      continue;
    }

    const fieldMatch = linkedFields.find((entry) => deps.normalizeCompare(entry.linkedFileName || '') === deps.normalizeCompare(fileName));
    const safeFileName = sanitizeBackupPathSegment(fileName, `file-${index + 1}`);
    const relativePath = `files/${tableFolderName}/${recordFolder}/${safeFileName}`;

    files.push({
      fieldName: fieldMatch?.fieldName,
      naam: fileName,
      contentType: blob.type || 'application/octet-stream',
      size: blob.size,
      path: relativePath,
    });
    zipEntries.push({ path: relativePath, blob });
  }

  return { files, zipEntries };
}

async function buildNinoxBackupTableDump(
  deps: NinoxBackupDependencies,
  table: NinoxTable,
  tableIndex = 1,
  tableCount = 1,
  onProgress?: (progress: NinoxBackupProgress) => void
): Promise<{ tableDump: NinoxBackupTableDump; zipEntries: ZipBlobEntry[] }> {
  const fields = await deps.fetchNinoxTableFields(table.id).catch(() => []);
  const records = await deps.fetchTableRecords(table.id, 500);
  const tableFolderName = sanitizeBackupPathSegment(table.name, table.id);
  const mappedRecords: NinoxBackupRecord[] = [];
  const zipEntries: ZipBlobEntry[] = [];
  let fileCount = 0;

  for (const record of records) {
    const progressBase = {
      tableIndex,
      tableCount,
      tableId: table.id,
      tableName: table.name,
      recordCount: records.length,
    };
    const backupFiles = await fetchNinoxRecordBackupFiles(deps, table, record, fields, tableFolderName, onProgress, progressBase);
    mappedRecords.push({
      id: record.id,
      modifiedAt: deps.asString(record.modifiedAt),
      fields: record.fields && typeof record.fields === 'object' ? { ...record.fields } : {},
      files: backupFiles.files,
    });
    zipEntries.push(...backupFiles.zipEntries);
    fileCount += backupFiles.files.length;
  }

  return {
    tableDump: {
      id: table.id,
      name: table.name,
      fields,
      recordCount: mappedRecords.length,
      fileCount,
      records: mappedRecords,
    },
    zipEntries,
  };
}

function resolveBackupTableByNameOrId(tables: NinoxTable[], tableNameOrId: string, normalizeCompare: NinoxBackupDependencies['normalizeCompare']): NinoxTable | null {
  const target = normalizeCompare(String(tableNameOrId || '').trim());
  if (!target) {
    return null;
  }
  return tables.find((table) => normalizeCompare(table.id) === target || normalizeCompare(table.name) === target) || null;
}

function formatZipDateParts(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear());
  const dosTime = ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = (((year - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0x0f) << 5) | (date.getDate() & 0x1f);
  return { time: dosTime, date: dosDate };
}

const crc32Table = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let current = i;
    for (let bit = 0; bit < 8; bit += 1) {
      current = (current & 1) !== 0 ? 0xedb88320 ^ (current >>> 1) : current >>> 1;
    }
    table[i] = current >>> 0;
  }
  return table;
})();

function computeCrc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    crc = crc32Table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function createZipBlob(entries: Array<{ path: string; data: Uint8Array }>): Promise<Blob> {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  const now = formatZipDateParts(new Date());

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.path.replace(/\\/g, '/'));
    const crc32 = computeCrc32(entry.data);
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, now.time, true);
    localView.setUint16(12, now.date, true);
    localView.setUint32(14, crc32, true);
    localView.setUint32(18, entry.data.length, true);
    localView.setUint32(22, entry.data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);
    localParts.push(localHeader, entry.data);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, now.time, true);
    centralView.setUint16(14, now.date, true);
    centralView.setUint32(16, crc32, true);
    centralView.setUint32(20, entry.data.length, true);
    centralView.setUint32(24, entry.data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);

    offset += localHeader.length + entry.data.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const endHeader = new Uint8Array(22);
  const endView = new DataView(endHeader.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  endView.setUint16(20, 0, true);

  const totalSize = offset + centralSize + endHeader.length;
  const output = new Uint8Array(totalSize);
  let cursor = 0;
  for (const part of [...localParts, ...centralParts, endHeader]) {
    output.set(part, cursor);
    cursor += part.length;
  }

  return new Blob([output.buffer], { type: 'application/zip' });
}

async function buildNinoxBackupArchiveFromDump(
  dump: NinoxBackupDump,
  zipEntries: ZipBlobEntry[]
): Promise<NinoxBackupArchive> {
  const jsonBlob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json;charset=utf-8' });
  const archiveEntries: Array<{ path: string; data: Uint8Array }> = [
    { path: 'backup.json', data: new Uint8Array(await jsonBlob.arrayBuffer()) },
  ];

  for (const entry of zipEntries) {
    archiveEntries.push({
      path: entry.path,
      data: new Uint8Array(await entry.blob.arrayBuffer()),
    });
  }

  return {
    dump,
    blob: await createZipBlob(archiveEntries),
  };
}

export async function createNinoxBackupDumpWithDeps(
  deps: NinoxBackupDependencies,
  onProgress?: (progress: NinoxBackupProgress) => void
): Promise<NinoxBackupDump> {
  const tables = await fetchNinoxTablesForBackup(deps);
  const backupTables: NinoxBackupTableDump[] = [];
  let totalRecords = 0;
  let totalFiles = 0;

  for (let index = 0; index < tables.length; index += 1) {
    const table = tables[index];
    const result = await buildNinoxBackupTableDump(deps, table, index + 1, tables.length, onProgress);
    backupTables.push(result.tableDump);
    totalRecords += result.tableDump.recordCount;
    totalFiles += result.tableDump.fileCount || 0;

    onProgress?.({
      phase: 'records',
      tableIndex: index + 1,
      tableCount: tables.length,
      tableId: table.id,
      tableName: table.name,
      recordCount: result.tableDump.recordCount,
      fileCount: result.tableDump.fileCount || 0,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    source: 'ninox',
    tableCount: backupTables.length,
    totalRecords,
    totalFiles,
    tables: backupTables,
  };
}

export async function createNinoxTableBackupDumpWithDeps(
  deps: NinoxBackupDependencies,
  tableNameOrId: string,
  onProgress?: (progress: NinoxBackupProgress) => void
): Promise<NinoxBackupDump> {
  const tables = await fetchNinoxTablesForBackup(deps);
  const table = resolveBackupTableByNameOrId(tables, tableNameOrId, deps.normalizeCompare);
  if (!table) {
    throw new Error(`Tabel "${tableNameOrId}" niet gevonden.`);
  }

  const result = await buildNinoxBackupTableDump(deps, table, 1, 1, onProgress);
  onProgress?.({
    phase: 'records',
    tableIndex: 1,
    tableCount: 1,
    tableId: table.id,
    tableName: table.name,
    recordCount: result.tableDump.recordCount,
    fileCount: result.tableDump.fileCount || 0,
  });

  return {
    generatedAt: new Date().toISOString(),
    source: 'ninox',
    tableCount: 1,
    totalRecords: result.tableDump.recordCount,
    totalFiles: result.tableDump.fileCount || 0,
    tables: [result.tableDump],
  };
}

export async function createNinoxBackupArchiveWithDeps(
  deps: NinoxBackupDependencies,
  onProgress?: (progress: NinoxBackupProgress) => void
): Promise<NinoxBackupArchive> {
  const tables = await fetchNinoxTablesForBackup(deps);
  const backupTables: NinoxBackupTableDump[] = [];
  const zipEntries: ZipBlobEntry[] = [];
  let totalRecords = 0;
  let totalFiles = 0;

  for (let index = 0; index < tables.length; index += 1) {
    const table = tables[index];
    const result = await buildNinoxBackupTableDump(deps, table, index + 1, tables.length, onProgress);
    backupTables.push(result.tableDump);
    zipEntries.push(...result.zipEntries);
    totalRecords += result.tableDump.recordCount;
    totalFiles += result.tableDump.fileCount || 0;

    onProgress?.({
      phase: 'records',
      tableIndex: index + 1,
      tableCount: tables.length,
      tableId: table.id,
      tableName: table.name,
      recordCount: result.tableDump.recordCount,
      fileCount: result.tableDump.fileCount || 0,
    });
  }

  return buildNinoxBackupArchiveFromDump(
    {
      generatedAt: new Date().toISOString(),
      source: 'ninox',
      tableCount: backupTables.length,
      totalRecords,
      totalFiles,
      tables: backupTables,
    },
    zipEntries
  );
}

export async function createNinoxTableBackupArchiveWithDeps(
  deps: NinoxBackupDependencies,
  tableNameOrId: string,
  onProgress?: (progress: NinoxBackupProgress) => void
): Promise<NinoxBackupArchive> {
  const tables = await fetchNinoxTablesForBackup(deps);
  const table = resolveBackupTableByNameOrId(tables, tableNameOrId, deps.normalizeCompare);
  if (!table) {
    throw new Error(`Tabel "${tableNameOrId}" niet gevonden.`);
  }

  const result = await buildNinoxBackupTableDump(deps, table, 1, 1, onProgress);
  onProgress?.({
    phase: 'records',
    tableIndex: 1,
    tableCount: 1,
    tableId: table.id,
    tableName: table.name,
    recordCount: result.tableDump.recordCount,
    fileCount: result.tableDump.fileCount || 0,
  });

  return buildNinoxBackupArchiveFromDump(
    {
      generatedAt: new Date().toISOString(),
      source: 'ninox',
      tableCount: 1,
      totalRecords: result.tableDump.recordCount,
      totalFiles: result.tableDump.fileCount || 0,
      tables: [result.tableDump],
    },
    result.zipEntries
  );
}
