import type { IncomingMessage, ServerResponse } from 'node:http';

type NoteStatus = 'Concept' | 'Actief' | 'Gearchiveerd';

type NoteRecord = {
  id: number;
  title: string;
  category: string;
  status: NoteStatus;
  excerpt: string;
  content: string;
  tags: string[];
  authorName: string;
  updatedAt: string;
};

type RelatieRecord = {
  sleutel: string;
  naamRelatie: string;
  groep: string;
  straat: string;
  postcode: string;
  woonplaats: string;
  opmerkingen: string;
};

type UserRecord = {
  id: number;
  naam: string;
  gebruikersnaam: string;
  email: string;
  functie: string;
  rol: 'Beheerder' | 'Medewerker';
  dashboard: boolean;
  relaties: boolean;
  notes: boolean;
  mailbox: boolean;
  database: boolean;
  settings: boolean;
  beheer: boolean;
};

type AdminUserRecord = {
  sleutel: string;
  naam: string;
  gebruikersnaam: string;
  wachtwoord: string;
  email: string;
  beheerder: boolean;
  rol: 'Beheerder' | 'Medewerker';
};

type EnvMap = Record<string, string>;

let memoryNotes: NoteRecord[] = [
  {
    id: 1,
    title: 'Projectbasis Notes',
    category: 'Project',
    status: 'Actief',
    excerpt: 'Layout, grids en eerste API-koppelingen opgezet.',
    content: 'Deze notitie beschrijft de eerste basis van het Notes-project met Mailjet en MariaDB.',
    tags: ['basis', 'migratie', 'layout'],
    authorName: 'Codex',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 2,
    title: 'Mailjet configuratie',
    category: 'Integratie',
    status: 'Concept',
    excerpt: 'API-sleutels en afzendergegevens nog invullen in .env.',
    content: 'Gebruik MAILJET_API_KEY, MAILJET_API_SECRET, MAILJET_FROM_EMAIL en MAILJET_FROM_NAME.',
    tags: ['mailjet', 'env'],
    authorName: 'Codex',
    updatedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: 3,
    title: 'MariaDB schema',
    category: 'Database',
    status: 'Concept',
    excerpt: 'Tabel notes wordt automatisch aangemaakt zodra MariaDB bereikbaar is.',
    content: 'De notes-tabel wordt on-demand gecreeerd zodat de basis direct bruikbaar blijft.',
    tags: ['mariadb', 'schema'],
    authorName: 'Codex',
    updatedAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
  },
];

let memoryRelaties: RelatieRecord[] = [];
let nextMemoryNoteId = memoryNotes.length + 1;
let cachedPool: unknown = null;
let cachedPoolSignature = '';

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function createHttpError(message: string, statusCode: number) {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = statusCode;
  return error;
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
  } catch {
    throw createHttpError('Request body bevat geen geldige JSON.', 400);
  }
}

function normalizePath(urlValue: string | undefined): string {
  const url = new URL(urlValue || '/', 'http://localhost');
  return url.pathname.replace(/\/+$/, '') || '/';
}

function readEnv(env: EnvMap, key: string, fallback = ''): string {
  const value = env[key];
  return typeof value === 'string' ? value.trim() : fallback;
}

function readText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isValidStatus(value: string): value is NoteStatus {
  return value === 'Concept' || value === 'Actief' || value === 'Gearchiveerd';
}

function sanitizeTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => readText(item)).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function sanitizeNoteInput(body: Record<string, unknown>) {
  const title = readText(body.title);
  if (!title) {
    throw createHttpError('Titel is verplicht.', 400);
  }

  const statusInput = readText(body.status) || 'Concept';
  if (!isValidStatus(statusInput)) {
    throw createHttpError('Ongeldige status voor notitie.', 400);
  }

  return {
    title,
    category: readText(body.category) || 'Algemeen',
    status: statusInput,
    excerpt: readText(body.excerpt),
    content: readText(body.content),
    tags: sanitizeTags(body.tags),
  };
}

function sanitizeAdminUserInput(body: Record<string, unknown>) {
  const naam = readText(body.naam);
  const gebruikersnaam = readText(body.gebruikersnaam);
  const wachtwoord = readText(body.wachtwoord);
  const email = readText(body.email);
  const beheerder = readBoolean(body.beheerder) ?? false;

  if (!naam || !gebruikersnaam || !wachtwoord) {
    throw createHttpError('Naam, gebruikersnaam en wachtwoord zijn verplicht.', 400);
  }

  return {
    naam,
    gebruikersnaam,
    wachtwoord,
    email,
    beheerder,
  };
}

function sanitizeRelatieInput(body: Record<string, unknown>) {
  const naamRelatie = readText(body.naamRelatie);
  if (!naamRelatie) {
    throw createHttpError('Naam relatie is verplicht.', 400);
  }

  return {
    naamRelatie,
    groep: readText(body.groep),
    straat: readText(body.straat),
    postcode: readText(body.postcode),
    woonplaats: readText(body.woonplaats),
    opmerkingen: readText(body.opmerkingen),
  };
}

function buildUser(role: 'Beheerder' | 'Medewerker', gebruikersnaam: string): UserRecord {
  return {
    id: role === 'Beheerder' ? 1 : 2,
    naam: role === 'Beheerder' ? 'Notes Beheer' : 'Notes Medewerker',
    gebruikersnaam,
    email: role === 'Beheerder' ? 'beheer@notes.local' : 'medewerker@notes.local',
    functie: role === 'Beheerder' ? 'Applicatiebeheer' : 'Projectmedewerker',
    rol,
    dashboard: true,
    relaties: true,
    notes: true,
    mailbox: true,
    database: role === 'Beheerder',
    settings: true,
    beheer: role === 'Beheerder',
  };
}

function normalizeCompare(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '');
}

function readBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }

  const normalized = normalizeCompare(value);
  if (!normalized) {
    return null;
  }

  if (['1', 'true', 'ja', 'yes', 'actief', 'enabled'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'nee', 'no', 'inactief', 'disabled'].includes(normalized)) {
    return false;
  }

  return null;
}

function findColumnName(columns: string[], aliases: string[]): string {
  for (const alias of aliases) {
    const match = columns.find((column) => normalizeCompare(column) === normalizeCompare(alias));
    if (match) {
      return match;
    }
  }
  return '';
}

function readRowText(row: Record<string, unknown>, columns: string[], aliases: string[], fallback = ''): string {
  const columnName = findColumnName(columns, aliases);
  if (!columnName) {
    return fallback;
  }
  return readText(row[columnName]) || fallback;
}

function readRowBoolean(row: Record<string, unknown>, columns: string[], aliases: string[], fallback: boolean): boolean {
  const columnName = findColumnName(columns, aliases);
  if (!columnName) {
    return fallback;
  }
  const value = readBoolean(row[columnName]);
  return value === null ? fallback : value;
}

function mapDbUserRow(row: Record<string, unknown>, columns: string[], gebruikersnaamFallback: string): UserRecord {
  const rolRaw = readRowText(row, columns, ['rol', 'role', 'user_role'], 'Medewerker');
  const beheerder =
    readRowBoolean(row, columns, ['beheerder', 'admin', 'administrator', 'is_admin', 'isadmin'], false) ||
    normalizeCompare(rolRaw) === 'beheerder';
  const rol: 'Beheerder' | 'Medewerker' = beheerder ? 'Beheerder' : 'Medewerker';
  const functie = readRowText(row, columns, ['functie', 'jobtitle', 'title'], rol);

  return {
    id: Number(row[findColumnName(columns, ['id', 'gebruiker_id', 'userid'])] ?? 0) || 0,
    naam: readRowText(row, columns, ['naam', 'name', 'volledignaam', 'displayname'], gebruikersnaamFallback),
    gebruikersnaam: readRowText(row, columns, ['gebruikersnaam', 'username', 'login', 'user', 'inlognaam'], gebruikersnaamFallback),
    email: readRowText(row, columns, ['email', 'mail', 'e-mail', 'emailadres'], ''),
    functie,
    rol,
    dashboard: readRowBoolean(row, columns, ['dashboard'], true),
    relaties: readRowBoolean(row, columns, ['relaties', 'relatie'], true),
    notes: readRowBoolean(row, columns, ['notes', 'notities'], true),
    mailbox: readRowBoolean(row, columns, ['mailbox', 'mail', 'mailen'], true),
    database: readRowBoolean(row, columns, ['database', 'db'], beheerder),
    settings: readRowBoolean(row, columns, ['settings', 'instellingen'], true),
    beheer: readRowBoolean(row, columns, ['beheer', 'beheerder', 'admin', 'administrator'], beheerder),
  };
}

async function authenticateUser(body: Record<string, unknown>, env: EnvMap): Promise<UserRecord> {
  const gebruikersnaam = readText(body.gebruikersnaam).toLowerCase();
  const wachtwoord = readText(body.wachtwoord);

  if (!gebruikersnaam || !wachtwoord) {
    throw createHttpError('Vul gebruikersnaam en wachtwoord in.', 400);
  }

  if (hasDbConfig(env)) {
    try {
      return await withDbConnection(env, async (connection) => {
        const columnRows = (await connection.query('SHOW COLUMNS FROM gebruikers')) as Array<{ Field?: string }>;
        const columns = columnRows.map((row) => String(row.Field || '')).filter(Boolean);
        if (columns.length === 0) {
          throw createHttpError('Tabel "gebruikers" bevat geen leesbare kolommen.', 500);
        }

        const usernameColumn = findColumnName(columns, ['gebruikersnaam', 'username', 'login', 'user', 'inlognaam']);
        const passwordColumn = findColumnName(columns, ['wachtwoord', 'password', 'passwd']);
        const activeColumn = findColumnName(columns, ['actief', 'toegang', 'enabled', 'is_active', 'isactive']);

        if (!usernameColumn || !passwordColumn) {
          throw createHttpError('Tabel "gebruikers" mist kolommen voor gebruikersnaam of wachtwoord.', 500);
        }

        const rows = (await connection.query(
          `SELECT * FROM gebruikers WHERE LOWER(TRIM(${usernameColumn})) = LOWER(TRIM(?)) LIMIT 1`,
          [gebruikersnaam]
        )) as Record<string, unknown>[];

        const row = rows[0];
        if (!row) {
          throw createHttpError('Ongeldige gebruikersnaam of wachtwoord.', 401);
        }

        const actief = activeColumn ? readBoolean(row[activeColumn]) : true;
        if (actief === false) {
          throw createHttpError('Deze gebruiker is niet actief.', 403);
        }

        const storedPassword = readText(row[passwordColumn]);
        if (!storedPassword || storedPassword !== wachtwoord) {
          throw createHttpError('Ongeldige gebruikersnaam of wachtwoord.', 401);
        }

        return mapDbUserRow(row, columns, gebruikersnaam);
      });
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error) {
        throw error;
      }

      const message = error instanceof Error ? error.message : 'Onbekende databasefout.';
      throw createHttpError(`Inloggen via tabel "gebruikers" mislukt: ${message}`, 500);
    }
  }

  const adminUsername = readEnv(env, 'NOTES_ADMIN_USERNAME', 'admin').toLowerCase();
  const adminPassword = readEnv(env, 'NOTES_ADMIN_PASSWORD', 'notes123');
  const userUsername = readEnv(env, 'NOTES_USER_USERNAME', 'medewerker').toLowerCase();
  const userPassword = readEnv(env, 'NOTES_USER_PASSWORD', 'notes123');

  if (gebruikersnaam === adminUsername && wachtwoord === adminPassword) {
    return buildUser('Beheerder', gebruikersnaam);
  }

  if (gebruikersnaam === userUsername && wachtwoord === userPassword) {
    return buildUser('Medewerker', gebruikersnaam);
  }

  throw createHttpError('Ongeldige gebruikersnaam of wachtwoord.', 401);
}

function resolveDbConfig(env: EnvMap) {
  return {
    host: readEnv(env, 'MARIADB_HOST'),
    port: Number(readEnv(env, 'MARIADB_PORT', '3306')) || 3306,
    user: readEnv(env, 'MARIADB_USER'),
    password: readEnv(env, 'MARIADB_PASSWORD'),
    database: readEnv(env, 'MARIADB_DATABASE'),
    connectionLimit: Number(readEnv(env, 'MARIADB_CONNECTION_LIMIT', '5')) || 5,
  };
}

function hasDbConfig(env: EnvMap): boolean {
  const config = resolveDbConfig(env);
  return Boolean(config.host && config.user && config.database);
}

async function getMariaDbPool(env: EnvMap) {
  const config = resolveDbConfig(env);
  if (!config.host || !config.user || !config.database) {
    return null;
  }

  const signature = `${config.host}|${config.port}|${config.user}|${config.database}|${config.connectionLimit}`;
  if (cachedPool && cachedPoolSignature === signature) {
    return cachedPool as {
      getConnection: () => Promise<{
        query: (sql: string, values?: unknown[]) => Promise<unknown[]>;
        end?: () => Promise<void>;
        release?: () => void;
      }>;
    };
  }

  try {
    const mariadbModule = await import('mariadb');
    if (cachedPool && cachedPoolSignature !== signature) {
      const previous = cachedPool as { end?: () => Promise<void> };
      await previous.end?.().catch(() => undefined);
    }
    cachedPool = mariadbModule.createPool(config);
    cachedPoolSignature = signature;
    return cachedPool as {
      getConnection: () => Promise<{
        query: (sql: string, values?: unknown[]) => Promise<unknown[]>;
        end?: () => Promise<void>;
        release?: () => void;
      }>;
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/Cannot find package 'mariadb'|Cannot find module 'mariadb'/i.test(message)) {
      throw createHttpError('Package "mariadb" ontbreekt. Run npm install om de databasekoppeling te activeren.', 500);
    }
    throw error;
  }
}

async function withDbConnection<T>(
  env: EnvMap,
  work: (connection: { query: (sql: string, values?: unknown[]) => Promise<unknown[]> }) => Promise<T>
): Promise<T> {
  const pool = await getMariaDbPool(env);
  if (!pool) {
    throw createHttpError('MariaDB configuratie ontbreekt.', 500);
  }

  const connection = await pool.getConnection();
  try {
    return await work(connection);
  } finally {
    connection.release?.();
  }
}

async function ensureNotesTable(env: EnvMap): Promise<void> {
  await withDbConnection(env, async (connection) => {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(120) NOT NULL DEFAULT 'Algemeen',
        status VARCHAR(32) NOT NULL DEFAULT 'Concept',
        excerpt TEXT NOT NULL,
        content LONGTEXT NOT NULL,
        tags_json LONGTEXT NOT NULL,
        author_name VARCHAR(120) NOT NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
  });
}

async function ensureGebruikersTable(env: EnvMap): Promise<void> {
  await withDbConnection(env, async (connection) => {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS gebruikers (
        Gebruikersnaam VARCHAR(20) NULL,
        Naam VARCHAR(50) NULL,
        Wachtwoord VARCHAR(20) NULL,
        Email VARCHAR(50) NULL,
        Beheerder TINYINT NULL
      )
    `);
  });
}

async function ensureRelatiesTable(env: EnvMap): Promise<void> {
  await withDbConnection(env, async (connection) => {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS relaties (
        \`Naam relatie\` VARCHAR(50) NULL,
        \`Groep\` VARCHAR(50) NULL,
        \`Straat\` VARCHAR(50) NULL,
        \`Postcode\` VARCHAR(10) NULL,
        \`Woonplaats\` VARCHAR(50) NULL,
        \`Opmerkingen\` TEXT NULL
      )
    `);
  });
}

function buildRelatieKey(input: Omit<RelatieRecord, 'sleutel'>, index: number): string {
  return [
    input.naamRelatie || 'relatie',
    input.groep || '-',
    input.postcode || '-',
    input.woonplaats || '-',
    String(index),
  ]
    .map((part) => normalizeCompare(part) || '-')
    .join('|');
}

function mapDbRelatie(row: Record<string, unknown>, index: number): RelatieRecord {
  const columns = Object.keys(row);
  const item = {
    naamRelatie: readRowText(row, columns, ['Naam relatie', 'naam relatie', 'naamrelatie']),
    groep: readRowText(row, columns, ['Groep', 'groep']),
    straat: readRowText(row, columns, ['Straat', 'straat']),
    postcode: readRowText(row, columns, ['Postcode', 'postcode']),
    woonplaats: readRowText(row, columns, ['Woonplaats', 'woonplaats']),
    opmerkingen: readRowText(row, columns, ['Opmerkingen', 'opmerkingen']),
  };

  return {
    sleutel: buildRelatieKey(item, index),
    ...item,
  };
}

async function listRelaties(env: EnvMap): Promise<RelatieRecord[]> {
  if (!hasDbConfig(env)) {
    return [...memoryRelaties].sort((a, b) => a.naamRelatie.localeCompare(b.naamRelatie, 'nl', { sensitivity: 'base' }));
  }

  await ensureRelatiesTable(env);
  return withDbConnection(env, async (connection) => {
    const rows = (await connection.query(
      'SELECT `Naam relatie`, `Groep`, `Straat`, `Postcode`, `Woonplaats`, `Opmerkingen` FROM relaties ORDER BY `Naam relatie` ASC, `Woonplaats` ASC'
    )) as Record<string, unknown>[];
    return rows.map((row, index) => mapDbRelatie(row, index));
  });
}

async function createRelatie(env: EnvMap, input: ReturnType<typeof sanitizeRelatieInput>): Promise<RelatieRecord> {
  if (!hasDbConfig(env)) {
    const created: RelatieRecord = {
      sleutel: buildRelatieKey(input, memoryRelaties.length),
      ...input,
    };
    memoryRelaties = [created, ...memoryRelaties];
    return created;
  }

  await ensureRelatiesTable(env);
  await withDbConnection(env, async (connection) => {
    await connection.query(
      'INSERT INTO relaties (`Naam relatie`, `Groep`, `Straat`, `Postcode`, `Woonplaats`, `Opmerkingen`) VALUES (?, ?, ?, ?, ?, ?)',
      [input.naamRelatie, input.groep, input.straat, input.postcode, input.woonplaats, input.opmerkingen]
    );
  });

  return {
    sleutel: buildRelatieKey(input, Date.now()),
    ...input,
  };
}

function mapAdminUserRow(row: Record<string, unknown>): AdminUserRecord {
  const gebruikersnaam = readText(row.Gebruikersnaam);
  const beheerder = readBoolean(row.Beheerder) ?? false;

  return {
    sleutel: gebruikersnaam,
    naam: readText(row.Naam),
    gebruikersnaam,
    wachtwoord: readText(row.Wachtwoord),
    email: readText(row.Email),
    beheerder,
    rol: beheerder ? 'Beheerder' : 'Medewerker',
  };
}

async function listAdminUsers(env: EnvMap): Promise<AdminUserRecord[]> {
  if (!hasDbConfig(env)) {
    throw createHttpError('MariaDB configuratie ontbreekt.', 500);
  }

  await ensureGebruikersTable(env);
  return withDbConnection(env, async (connection) => {
    const rows = (await connection.query(
      'SELECT Gebruikersnaam, Naam, Wachtwoord, Email, Beheerder FROM gebruikers ORDER BY Naam ASC, Gebruikersnaam ASC'
    )) as Record<string, unknown>[];
    return rows.map(mapAdminUserRow);
  });
}

async function findAdminUserByUsername(env: EnvMap, gebruikersnaam: string): Promise<AdminUserRecord | null> {
  await ensureGebruikersTable(env);
  return withDbConnection(env, async (connection) => {
    const rows = (await connection.query(
      'SELECT Gebruikersnaam, Naam, Wachtwoord, Email, Beheerder FROM gebruikers WHERE LOWER(TRIM(Gebruikersnaam)) = LOWER(TRIM(?)) LIMIT 1',
      [gebruikersnaam]
    )) as Record<string, unknown>[];
    return rows[0] ? mapAdminUserRow(rows[0]) : null;
  });
}

async function createAdminUser(env: EnvMap, input: ReturnType<typeof sanitizeAdminUserInput>): Promise<AdminUserRecord> {
  if (!hasDbConfig(env)) {
    throw createHttpError('MariaDB configuratie ontbreekt.', 500);
  }

  const bestaande = await findAdminUserByUsername(env, input.gebruikersnaam);
  if (bestaande) {
    throw createHttpError('Deze gebruikersnaam bestaat al.', 409);
  }

  await ensureGebruikersTable(env);
  await withDbConnection(env, async (connection) => {
    await connection.query(
      'INSERT INTO gebruikers (Gebruikersnaam, Naam, Wachtwoord, Email, Beheerder) VALUES (?, ?, ?, ?, ?)',
      [input.gebruikersnaam, input.naam, input.wachtwoord, input.email, input.beheerder ? 1 : 0]
    );
  });

  const created = await findAdminUserByUsername(env, input.gebruikersnaam);
  if (!created) {
    throw createHttpError('Gebruiker aanmaken mislukt.', 500);
  }
  return created;
}

async function updateAdminUser(env: EnvMap, originalGebruikersnaam: string, input: ReturnType<typeof sanitizeAdminUserInput>): Promise<AdminUserRecord> {
  if (!hasDbConfig(env)) {
    throw createHttpError('MariaDB configuratie ontbreekt.', 500);
  }

  const bestaand = await findAdminUserByUsername(env, originalGebruikersnaam);
  if (!bestaand) {
    throw createHttpError('Gebruiker niet gevonden.', 404);
  }

  if (normalizeCompare(originalGebruikersnaam) !== normalizeCompare(input.gebruikersnaam)) {
    const conflict = await findAdminUserByUsername(env, input.gebruikersnaam);
    if (conflict) {
      throw createHttpError('Deze gebruikersnaam bestaat al.', 409);
    }
  }

  await ensureGebruikersTable(env);
  await withDbConnection(env, async (connection) => {
    await connection.query(
      `
        UPDATE gebruikers
        SET Gebruikersnaam = ?, Naam = ?, Wachtwoord = ?, Email = ?, Beheerder = ?
        WHERE LOWER(TRIM(Gebruikersnaam)) = LOWER(TRIM(?))
      `,
      [input.gebruikersnaam, input.naam, input.wachtwoord, input.email, input.beheerder ? 1 : 0, originalGebruikersnaam]
    );
  });

  const updated = await findAdminUserByUsername(env, input.gebruikersnaam);
  if (!updated) {
    throw createHttpError('Gebruiker bijwerken mislukt.', 500);
  }
  return updated;
}

async function deleteAdminUser(env: EnvMap, gebruikersnaam: string): Promise<void> {
  if (!hasDbConfig(env)) {
    throw createHttpError('MariaDB configuratie ontbreekt.', 500);
  }

  const bestaand = await findAdminUserByUsername(env, gebruikersnaam);
  if (!bestaand) {
    throw createHttpError('Gebruiker niet gevonden.', 404);
  }

  await ensureGebruikersTable(env);
  await withDbConnection(env, async (connection) => {
    await connection.query(
      'DELETE FROM gebruikers WHERE LOWER(TRIM(Gebruikersnaam)) = LOWER(TRIM(?))',
      [gebruikersnaam]
    );
  });
}

function mapDbNote(row: Record<string, unknown>): NoteRecord {
  let tags: string[] = [];
  const rawTags = readText(row.tags_json);
  if (rawTags) {
    try {
      const parsed = JSON.parse(rawTags) as unknown;
      if (Array.isArray(parsed)) {
        tags = parsed.map((item) => readText(item)).filter(Boolean);
      }
    } catch {
      tags = [];
    }
  }

  const statusValue = readText(row.status);

  return {
    id: Number(row.id) || 0,
    title: readText(row.title),
    category: readText(row.category),
    status: isValidStatus(statusValue) ? statusValue : 'Concept',
    excerpt: readText(row.excerpt),
    content: readText(row.content),
    tags,
    authorName: readText(row.author_name),
    updatedAt: new Date(readText(row.updated_at) || Date.now()).toISOString(),
  };
}

async function listNotes(env: EnvMap): Promise<NoteRecord[]> {
  if (!hasDbConfig(env)) {
    return [...memoryNotes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  await ensureNotesTable(env);
  return withDbConnection(env, async (connection) => {
    const rows = (await connection.query(
      'SELECT id, title, category, status, excerpt, content, tags_json, author_name, updated_at FROM notes ORDER BY updated_at DESC'
    )) as Record<string, unknown>[];
    return rows.map(mapDbNote);
  });
}

async function insertOrUpdateNote(env: EnvMap, input: ReturnType<typeof sanitizeNoteInput>, authorName: string, noteId?: number): Promise<NoteRecord> {
  if (!hasDbConfig(env)) {
    if (noteId) {
      const existing = memoryNotes.find((item) => item.id === noteId);
      if (!existing) {
        throw createHttpError('Notitie niet gevonden.', 404);
      }

      const updated: NoteRecord = {
        ...existing,
        ...input,
        authorName,
        updatedAt: new Date().toISOString(),
      };

      memoryNotes = memoryNotes.map((item) => (item.id === noteId ? updated : item));
      return updated;
    }

    const created: NoteRecord = {
      id: nextMemoryNoteId++,
      ...input,
      authorName,
      updatedAt: new Date().toISOString(),
    };
    memoryNotes = [created, ...memoryNotes];
    return created;
  }

  await ensureNotesTable(env);
  return withDbConnection(env, async (connection) => {
    const tagsJson = JSON.stringify(input.tags);

    if (noteId) {
      await connection.query(
        `
          UPDATE notes
          SET title = ?, category = ?, status = ?, excerpt = ?, content = ?, tags_json = ?, author_name = ?, updated_at = NOW()
          WHERE id = ?
        `,
        [input.title, input.category, input.status, input.excerpt, input.content, tagsJson, authorName, noteId]
      );
    } else {
      await connection.query(
        `
          INSERT INTO notes (title, category, status, excerpt, content, tags_json, author_name)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [input.title, input.category, input.status, input.excerpt, input.content, tagsJson, authorName]
      );
    }

    const idToLoad = noteId
      ? noteId
      : Number(((await connection.query('SELECT MAX(id) AS id FROM notes')) as Record<string, unknown>[])[0]?.id);

    const rows = (await connection.query(
      'SELECT id, title, category, status, excerpt, content, tags_json, author_name, updated_at FROM notes WHERE id = ? LIMIT 1',
      [idToLoad]
    )) as Record<string, unknown>[];

    const row = rows[0];
    if (!row) {
      throw createHttpError('Notitie opslaan mislukt.', 500);
    }

    return mapDbNote(row);
  });
}

async function removeNote(env: EnvMap, noteId: number): Promise<void> {
  if (!hasDbConfig(env)) {
    const hasExisting = memoryNotes.some((item) => item.id === noteId);
    if (!hasExisting) {
      throw createHttpError('Notitie niet gevonden.', 404);
    }
    memoryNotes = memoryNotes.filter((item) => item.id !== noteId);
    return;
  }

  await ensureNotesTable(env);
  await withDbConnection(env, async (connection) => {
    await connection.query('DELETE FROM notes WHERE id = ?', [noteId]);
  });
}

async function getDatabaseStatus(env: EnvMap) {
  const config = resolveDbConfig(env);

  if (!config.host || !config.user || !config.database) {
    return {
      configured: false,
      connected: false,
      host: '-',
      database: '-',
      noteCount: memoryNotes.length,
      message: 'MariaDB variabelen ontbreken. De app gebruikt nu demo-data voor de layoutbasis.',
    };
  }

  try {
    await ensureNotesTable(env);
    const noteCount = await withDbConnection(env, async (connection) => {
      const rows = (await connection.query('SELECT COUNT(*) AS total FROM notes')) as Record<string, unknown>[];
      return Number(rows[0]?.total) || 0;
    });

    return {
      configured: true,
      connected: true,
      host: config.host,
      database: config.database,
      noteCount,
      message: 'MariaDB verbinding is actief en de notes-tabel is beschikbaar.',
    };
  } catch (error) {
    return {
      configured: true,
      connected: false,
      host: config.host,
      database: config.database,
      noteCount: 0,
      message: error instanceof Error ? error.message : 'MariaDB verbinding mislukt.',
    };
  }
}

function getMailjetConfig(env: EnvMap) {
  return {
    apiKey: readEnv(env, 'MAILJET_API_KEY'),
    apiSecret: readEnv(env, 'MAILJET_API_SECRET'),
    fromEmail: readEnv(env, 'MAILJET_FROM_EMAIL'),
    fromName: readEnv(env, 'MAILJET_FROM_NAME', 'Notes'),
  };
}

function getMailjetStatus(env: EnvMap) {
  const config = getMailjetConfig(env);
  const configured = Boolean(config.apiKey && config.apiSecret && config.fromEmail);

  return {
    configured,
    reachable: configured,
    senderEmail: config.fromEmail || '-',
    senderName: config.fromName || 'Notes',
    message: configured
      ? 'Mailjet configuratie is aanwezig. Gebruik het mailboxscherm om een testmail te versturen.'
      : 'Mailjet variabelen ontbreken nog in .env.',
  };
}

async function sendMailjetMessage(env: EnvMap, body: Record<string, unknown>) {
  const config = getMailjetConfig(env);
  if (!config.apiKey || !config.apiSecret || !config.fromEmail) {
    throw createHttpError('Mailjet is nog niet volledig geconfigureerd.', 400);
  }

  const to = readText(body.to);
  const subject = readText(body.subject);
  const text = readText(body.text);

  if (!to || !subject || !text) {
    throw createHttpError('Vul ontvanger, onderwerp en bericht in.', 400);
  }

  const response = await fetch('https://api.mailjet.com/v3.1/send', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString('base64')}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      Messages: [
        {
          From: { Email: config.fromEmail, Name: config.fromName },
          To: [{ Email: to }],
          Subject: subject,
          TextPart: text,
        },
      ],
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'ErrorMessage' in payload && typeof payload.ErrorMessage === 'string'
        ? payload.ErrorMessage
        : 'Mailjet testmail verzenden mislukt.';
    throw createHttpError(message, response.status || 502);
  }

  return { message: `Testmail verzonden naar ${to}.` };
}

async function buildDashboardSummary(env: EnvMap) {
  const notes = await listNotes(env);
  const databaseStatus = await getDatabaseStatus(env);
  const mailjetStatus = getMailjetStatus(env);

  return {
    totalNotes: notes.length,
    activeNotes: notes.filter((item) => item.status === 'Actief').length,
    draftNotes: notes.filter((item) => item.status === 'Concept').length,
    archivedNotes: notes.filter((item) => item.status === 'Gearchiveerd').length,
    recentNotes: notes.slice(0, 5),
    databaseStatus,
    mailjetStatus,
  };
}

export async function handleNotesApiRequest(req: IncomingMessage, res: ServerResponse, env: EnvMap): Promise<boolean> {
  const method = req.method || 'GET';
  const path = normalizePath(req.url);

  if (!path.startsWith('/api')) {
    return false;
  }

  try {
    if (method === 'GET' && path === '/api/health') {
      sendJson(res, 200, { status: 'ok' });
      return true;
    }

    if (method === 'POST' && path === '/api/login') {
      const body = await readJsonBody(req);
      sendJson(res, 200, { user: await authenticateUser(body, env) });
      return true;
    }

    if (method === 'GET' && path === '/api/dashboard') {
      sendJson(res, 200, await buildDashboardSummary(env));
      return true;
    }

    if (method === 'GET' && path === '/api/admin/users') {
      sendJson(res, 200, { users: await listAdminUsers(env) });
      return true;
    }

    if (method === 'GET' && path === '/api/relaties') {
      sendJson(res, 200, { relaties: await listRelaties(env) });
      return true;
    }

    if (method === 'POST' && path === '/api/relaties') {
      const input = sanitizeRelatieInput(await readJsonBody(req));
      sendJson(res, 201, { relatie: await createRelatie(env, input) });
      return true;
    }

    if (method === 'POST' && path === '/api/admin/users') {
      const input = sanitizeAdminUserInput(await readJsonBody(req));
      sendJson(res, 201, { user: await createAdminUser(env, input) });
      return true;
    }

    const adminUserMatch = path.match(/^\/api\/admin\/users\/([^/]+)$/);
    if (adminUserMatch) {
      const originalGebruikersnaam = decodeURIComponent(adminUserMatch[1]);

      if (method === 'PUT') {
        const input = sanitizeAdminUserInput(await readJsonBody(req));
        sendJson(res, 200, { user: await updateAdminUser(env, originalGebruikersnaam, input) });
        return true;
      }

      if (method === 'DELETE') {
        await deleteAdminUser(env, originalGebruikersnaam);
        sendJson(res, 200, { message: 'Gebruiker verwijderd.' });
        return true;
      }
    }

    if (method === 'GET' && path === '/api/notes') {
      sendJson(res, 200, { notes: await listNotes(env) });
      return true;
    }

    if (method === 'POST' && path === '/api/notes') {
      const input = sanitizeNoteInput(await readJsonBody(req));
      sendJson(res, 201, { note: await insertOrUpdateNote(env, input, 'Notes gebruiker') });
      return true;
    }

    const noteMatch = path.match(/^\/api\/notes\/(\d+)$/);
    if (noteMatch) {
      const noteId = Number(noteMatch[1]);
      if (!Number.isFinite(noteId) || noteId <= 0) {
        throw createHttpError('Ongeldig notitie-id.', 400);
      }

      if (method === 'PUT') {
        const input = sanitizeNoteInput(await readJsonBody(req));
        sendJson(res, 200, { note: await insertOrUpdateNote(env, input, 'Notes gebruiker', noteId) });
        return true;
      }

      if (method === 'DELETE') {
        await removeNote(env, noteId);
        sendJson(res, 200, { message: 'Notitie verwijderd.' });
        return true;
      }
    }

    if (method === 'GET' && path === '/api/database/status') {
      sendJson(res, 200, await getDatabaseStatus(env));
      return true;
    }

    if (method === 'GET' && path === '/api/mailjet/status') {
      sendJson(res, 200, getMailjetStatus(env));
      return true;
    }

    if (method === 'POST' && path === '/api/mailjet/send-test') {
      sendJson(res, 200, await sendMailjetMessage(env, await readJsonBody(req)));
      return true;
    }

    sendJson(res, 404, { message: 'API-route niet gevonden.' });
    return true;
  } catch (error) {
    const statusCode =
      typeof error === 'object' && error !== null && 'statusCode' in error
        ? Number((error as { statusCode?: number }).statusCode) || 500
        : 500;
    const message = error instanceof Error ? error.message : 'Onbekende serverfout.';
    sendJson(res, statusCode, { message });
    return true;
  }
}
