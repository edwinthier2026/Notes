function asString(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function normalizeEnvValue(value) {
  const raw = asString(value).trim();
  if (!raw) {
    return '';
  }
  // Accept copied secrets with accidental wrapping quotes.
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1).trim();
  }
  return raw;
}

function readEnvFirst(env, keys) {
  for (const key of keys) {
    const value = normalizeEnvValue(env?.[key]);
    if (value) {
      return value;
    }
  }
  return '';
}

function normalizeNinoxApiRoot(value) {
  const fallback = 'https://planning-nl.ninoxdb.com/v1';
  const raw = normalizeEnvValue(value);
  if (!raw) {
    return fallback;
  }

  let normalized = raw;
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }
  normalized = normalized.replace(/\/+$/, '');

  const teamsIndex = normalized.toLowerCase().indexOf('/teams/');
  if (teamsIndex >= 0) {
    normalized = normalized.slice(0, teamsIndex);
  }

  const databasesIndex = normalized.toLowerCase().indexOf('/databases/');
  if (databasesIndex >= 0) {
    normalized = normalized.slice(0, databasesIndex);
  }

  if (!/\/v1$/i.test(normalized)) {
    normalized = `${normalized}/v1`;
  }

  return normalized;
}

function extractNinoxErrorMessage(payload) {
  if (!payload || typeof payload !== 'object') {
    return '';
  }
  const obj = payload;
  const candidates = [obj.message, obj.error, obj.title, obj.detail, obj.reason];
  for (const candidate of candidates) {
    const value = asString(candidate).trim();
    if (value) {
      return value;
    }
  }
  return '';
}

function compactText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function asBoolean(value) {
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
    const obj = value;
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

function readString(fields, keys) {
  for (const key of keys) {
    const value = asString(fields[key]).trim();
    if (value) {
      return value;
    }
  }
  return '';
}

function normalizeFieldKey(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '');
}

function readBooleanField(fields, keys) {
  if (!fields || typeof fields !== 'object') {
    return false;
  }
  const entries = Object.entries(fields);
  const normalizedTargets = keys.map((key) => normalizeFieldKey(key));
  for (const [rawKey, rawValue] of entries) {
    const normalizedKey = normalizeFieldKey(rawKey);
    if (normalizedTargets.includes(normalizedKey)) {
      return asBoolean(rawValue);
    }
  }
  return false;
}

function asRole(fields) {
  // Simpel: Beheerder ja/nee veld bepaalt de rol
  if (asBoolean(fields.Beheerder)) {
    return 'Beheerder';
  }
  return 'Gebruiker';
}

export function resolveNinoxConfig(env) {
  return {
    apiBaseUrl: readEnvFirst(env, ['NINOX_API_BASE_URL', 'NINOX_BASE_URL', 'VITE_NINOX_API_BASE_URL']),
    apiKey: readEnvFirst(env, ['NINOX_API_KEY', 'NINOX_API_TOKEN', 'VITE_NINOX_API_KEY', 'VITE_NINOX_API_TOKEN']),
    teamId: readEnvFirst(env, ['NINOX_TEAM_ID', 'NINOX_TEAM', 'VITE_NINOX_TEAM_ID', 'VITE_NINOX_TEAM']),
    databaseId: readEnvFirst(env, ['NINOX_DATABASE_ID', 'NINOX_DB_ID', 'VITE_NINOX_DATABASE_ID', 'VITE_NINOX_DB_ID']),
    gebruikersTableId: readEnvFirst(env, ['NINOX_GEBRUIKERS_TABLE_ID', 'NINOX_USERS_TABLE_ID']),
  };
}

export function buildNinoxDatabaseBaseUrl(config) {
  const apiRoot = normalizeNinoxApiRoot(config?.apiBaseUrl);
  return `${apiRoot}/teams/${config.teamId}/databases/${config.databaseId}`;
}

function assertConfig(config) {
  if (!config.apiKey || !config.teamId || !config.databaseId) {
    throw new Error('Serverconfig ontbreekt. Zet NINOX_API_KEY, NINOX_TEAM_ID en NINOX_DATABASE_ID.');
  }
}

let cachedGebruikersTableId = '';

export async function resolveGebruikersTableId(config) {
  const configured = normalizeEnvValue(config?.gebruikersTableId || '');
  if (configured) {
    return configured;
  }
  if (cachedGebruikersTableId) {
    return cachedGebruikersTableId;
  }

  const url = `${buildNinoxDatabaseBaseUrl(config)}/tables`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Tabellen ophalen mislukt (401). Controleer NINOX_API_KEY, NINOX_TEAM_ID en NINOX_DATABASE_ID.');
    }
    throw new Error(`Tabellen ophalen mislukt (${response.status}).`);
  }

  const tables = await response.json().catch(() => []);
  const list = Array.isArray(tables) ? tables : [];
  const match = list.find((table) => normalizeFieldKey(table?.name) === normalizeFieldKey('Gebruikers'));
  if (match?.id) {
    cachedGebruikersTableId = String(match.id);
    return cachedGebruikersTableId;
  }

  // Fallback voor oudere omgevingen waar Gebruikers op "P" stond.
  cachedGebruikersTableId = 'P';
  return cachedGebruikersTableId;
}

export async function fetchGebruikersRecords(config, gebruikersTableId) {
  assertConfig(config);
  const perPage = 500;
  const maxPages = 1000;
  const fetchBatch = async (query) => {
    const url = `${buildNinoxDatabaseBaseUrl(config)}/tables/${gebruikersTableId}/records?perPage=${perPage}&${query}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const responseClone = response.clone();
      const errorPayload = await response.json().catch(() => ({}));
      let message = extractNinoxErrorMessage(errorPayload);
      if (!message) {
        const rawText = await responseClone.text().catch(() => '');
        message = compactText(rawText);
      }
      if (!message) {
        message = compactText(response.statusText) || 'Onbekende Ninox fout';
      }
      throw new Error(`Gebruikers ophalen mislukt (${response.status}): ${message}`);
    }

    const payload = await response.json().catch(() => []);
    return Array.isArray(payload) ? payload : [];
  };

  const runStrategy = async (strategy) => {
    const results = [];
    const seenIds = new Set();

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

    let nieuwAantal = 0;
    for (const record of batch) {
      const recordId = Number(record?.id ?? 0);
      if (!recordId || seenIds.has(recordId)) {
        continue;
      }
      seenIds.add(recordId);
      results.push(record);
      nieuwAantal += 1;
    }

    if (nieuwAantal === 0 || batch.length < perPage) {
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
  return withOffset.length > 0 ? withOffset : withSkip;
}

async function updateLaatsteLogin(recordId, config, gebruikersTableId) {
  assertConfig(config);
  
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  
  // Ninox expects mm/dd/yyyy (American format)
  const formattedDateForNinox = `${month}/${day}/${year}`;
  
  // Ninox API requires PUT method and /tables/{tableId}/records/{recordId} path
  const url = `${buildNinoxDatabaseBaseUrl(config)}/tables/${gebruikersTableId}/records/${recordId}`;
  
  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        fields: {
          'Laatst gebruikt': formattedDateForNinox,
        },
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`[updateLaatsteLogin] Update mislukt voor record ${recordId}: ${response.status} ${response.statusText}`, errorText);
    }
  } catch (error) {
    console.error(`[updateLaatsteLogin] Update error voor record ${recordId}:`, error);
  }
}

// Rate limiting map: username -> { attempts: number, lastAttempt: timestamp }
const rateLimitMap = new Map();

function generateLoginCode() {
  // Generate 6-digit random code
  return String(Math.floor(100000 + Math.random() * 900000));
}

function maskEmail(email) {
  if (!email || !email.includes('@')) {
    return 'je e-mailadres';
  }
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

function checkRateLimit(gebruikersnaam) {
  const now = Date.now();
  const limit = rateLimitMap.get(gebruikersnaam);
  
  if (!limit) {
    rateLimitMap.set(gebruikersnaam, { attempts: 1, lastAttempt: now });
    return true;
  }
  
  // Reset after 15 minutes
  if (now - limit.lastAttempt > 15 * 60 * 1000) {
    rateLimitMap.set(gebruikersnaam, { attempts: 1, lastAttempt: now });
    return true;
  }
  
  // Max 3 attempts per 15 minutes
  if (limit.attempts >= 3) {
    return false;
  }
  
  limit.attempts++;
  limit.lastAttempt = now;
  return true;
}

async function updateLoginCode(recordId, code, config, gebruikersTableId) {
  assertConfig(config);
  
  const now = new Date();
  const isoDateTime = now.toISOString();
  
  const url = `${buildNinoxDatabaseBaseUrl(config)}/tables/${gebruikersTableId}/records/${recordId}`;
  
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      fields: {
        'Logincode': code,
        'Logincode aangemaakt': isoDateTime,
      },
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.error(`[updateLoginCode] Failed to save code for record ${recordId}:`, response.status, errorText);
    
    if (response.status === 500) {
      throw new Error('Ninox velden ontbreken. Maak de velden "Logincode" en "Logincode aangemaakt" aan in de Gebruikers tabel.');
    }
    
    throw new Error(`Login code opslaan mislukt: ${response.status} ${errorText}`);
  }
}

async function clearLoginCode(recordId, config, gebruikersTableId) {
  assertConfig(config);
  
  const url = `${buildNinoxDatabaseBaseUrl(config)}/tables/${gebruikersTableId}/records/${recordId}`;
  
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      fields: {
        'Logincode': '',
        'Logincode aangemaakt': '',
      },
    }),
  });
  
  if (!response.ok) {
    console.error(`[clearLoginCode] Failed to clear code for record ${recordId}`);
  }
}

export async function requestLoginCode(gebruikersnaamInput, config, options = {}) {
  const gebruikersnaam = asString(gebruikersnaamInput).trim().toLowerCase();

  if (!gebruikersnaam) {
    const error = new Error('Vul je gebruikersnaam in.');
    error.statusCode = 400;
    throw error;
  }
  
  // Check rate limit
  if (!checkRateLimit(gebruikersnaam)) {
    const error = new Error('Te veel aanvragen. Probeer het over 15 minuten opnieuw.');
    error.statusCode = 429;
    throw error;
  }

  const gebruikersTableId = await resolveGebruikersTableId(config);
  const records = await fetchGebruikersRecords(config, gebruikersTableId);

  const match = records.find((record) => {
    const fields = record?.fields ?? {};
    const savedGebruikersnaam = readString(fields, ['Gebruikersnaam']).toLowerCase();
    return savedGebruikersnaam === gebruikersnaam;
  });

  if (!match) {
    // Don't reveal if user exists or not (security)
    return {
      success: true,
      message: 'Als deze gebruikersnaam bestaat, is er een code verstuurd.',
      maskedEmail: '',
    };
  }

  const fields = match.fields ?? {};
  const email = readString(fields, ['Email', 'E-mail']);
  const naam = readString(fields, ['Naam', 'Gebruikersnaam']) || gebruikersnaam;

  if (!email) {
    const error = new Error('Geen e-mailadres gevonden voor deze gebruiker. Neem contact op met de beheerder.');
    error.statusCode = 400;
    throw error;
  }

  // Generate and save login code
  const code = generateLoginCode();
  const recordId = Number(match.id ?? 0);
  
  await updateLoginCode(recordId, code, config, gebruikersTableId);

  if (typeof options.sendMail !== 'function') {
    throw new Error('Mailserver configuratie ontbreekt');
  }

  await options.sendMail({
    to: email,
    naam,
    code,
  });

  return {
    success: true,
    message: `Code verstuurd naar ${maskEmail(email)}`,
    maskedEmail: maskEmail(email),
  };
}

export async function verifyLoginCode(gebruikersnaamInput, codeInput, config) {
  const gebruikersnaam = asString(gebruikersnaamInput).trim().toLowerCase();
  const code = asString(codeInput).trim();

  if (!gebruikersnaam || !code) {
    const error = new Error('Vul gebruikersnaam en code in.');
    error.statusCode = 400;
    throw error;
  }

  const gebruikersTableId = await resolveGebruikersTableId(config);
  const records = await fetchGebruikersRecords(config, gebruikersTableId);

  const match = records.find((record) => {
    const fields = record?.fields ?? {};
    const savedGebruikersnaam = readString(fields, ['Gebruikersnaam']).toLowerCase();
    return savedGebruikersnaam === gebruikersnaam;
  });

  if (!match) {
    const error = new Error('Onjuiste code of gebruiker niet gevonden.');
    error.statusCode = 401;
    throw error;
  }

  const fields = match.fields ?? {};
  const savedCode = readString(fields, ['Logincode']);
  const codeCreated = readString(fields, ['Logincode aangemaakt']);

  if (!savedCode || savedCode !== code) {
    const error = new Error('Onjuiste code.');
    error.statusCode = 401;
    throw error;
  }

  // Check if code is expired (10 minutes)
  if (codeCreated) {
    const createdDate = new Date(codeCreated);
    const now = new Date();
    const diffMinutes = (now.getTime() - createdDate.getTime()) / (1000 * 60);
    
    if (diffMinutes > 10) {
      const error = new Error('Code verlopen. Vraag een nieuwe code aan.');
      error.statusCode = 401;
      throw error;
    }
  }

  // Code is valid - clear it and log user in
  const recordId = Number(match.id ?? 0);
  
  // Clear login code (fire and forget)
  clearLoginCode(recordId, config, gebruikersTableId).catch((err) => {
    console.error('[verifyLoginCode] Failed to clear code:', err);
  });
  
  // Update Laatst gebruikt timestamp (fire and forget)
  if (recordId) {
    updateLaatsteLogin(recordId, config, gebruikersTableId).catch((err) => {
      console.error('[verifyLoginCode] Timestamp update failed:', err);
    });
  }

  return {
    id: recordId,
    naam: readString(fields, ['Naam', 'Gebruikersnaam']) || `Gebruiker ${match.id}`,
    gebruikersnaam: readString(fields, ['Gebruikersnaam']) || gebruikersnaamInput,
    email: readString(fields, ['Email', 'E-mail']),
    rol: asRole(fields),
    relaties: readBooleanField(fields, ['Relaties']),
    verkoopkansen: readBooleanField(fields, ['Verkoopkansen']),
    abonnementen: readBooleanField(fields, ['Abonnementen']),
    koppelingen: readBooleanField(fields, ['Koppelingen']),
    tabellen: readBooleanField(fields, ['Tabellen']),
    personeel: readBooleanField(fields, ['Personeel']),
    administratie: readBooleanField(fields, ['Administratie']),
    materiaalbeheer: readBooleanField(fields, ['Materiaalbeheer']),
    planning: readBooleanField(fields, ['Planning']),
    mailen: readBooleanField(fields, ['Mailen']),
    googleAgenda: readBooleanField(fields, ['Google agenda', 'Google Agenda']),
    googleDrive: readBooleanField(fields, ['Google drive', 'Google Drive']),
  };
}

// Legacy function - kept for backwards compatibility during migration
export async function authenticateNinoxUser(gebruikersnaamInput, wachtwoordInput, config) {
  const gebruikersnaam = asString(gebruikersnaamInput).trim().toLowerCase();
  const wachtwoord = asString(wachtwoordInput).trim();

  if (!gebruikersnaam || !wachtwoord) {
    const error = new Error('Vul gebruikersnaam en wachtwoord in.');
    error.statusCode = 400;
    throw error;
  }

  const gebruikersTableId = await resolveGebruikersTableId(config);
  const records = await fetchGebruikersRecords(config, gebruikersTableId);

  const match = records.find((record) => {
    const fields = record?.fields ?? {};
    const savedGebruikersnaam = readString(fields, ['Gebruikersnaam']).toLowerCase();
    const savedWachtwoord = readString(fields, ['Wachtwoord']);
    return savedGebruikersnaam === gebruikersnaam && savedWachtwoord === wachtwoord;
  });

  if (!match) {
    const error = new Error('Onjuiste inloggegevens of account is niet actief.');
    error.statusCode = 401;
    throw error;
  }

  // Update Laatst gebruikt timestamp (fire and forget)
  const recordId = Number(match.id ?? 0);
  if (recordId) {
    updateLaatsteLogin(recordId, config, gebruikersTableId).catch((err) => {
      console.error('[authenticateNinoxUser] Timestamp update failed:', err);
      // Silent fail - don't block login if timestamp update fails
    });
  }

  const fields = match.fields ?? {};
  return {
    id: recordId,
    naam: readString(fields, ['Naam', 'Gebruikersnaam']) || `Gebruiker ${match.id}`,
    gebruikersnaam: readString(fields, ['Gebruikersnaam']) || gebruikersnaamInput,
    email: readString(fields, ['Email', 'E-mail']),
    rol: asRole(fields),
    relaties: readBooleanField(fields, ['Relaties']),
    verkoopkansen: readBooleanField(fields, ['Verkoopkansen']),
    abonnementen: readBooleanField(fields, ['Abonnementen']),
    koppelingen: readBooleanField(fields, ['Koppelingen']),
    tabellen: readBooleanField(fields, ['Tabellen']),
    personeel: readBooleanField(fields, ['Personeel']),
    administratie: readBooleanField(fields, ['Administratie']),
    materiaalbeheer: readBooleanField(fields, ['Materiaalbeheer']),
    planning: readBooleanField(fields, ['Planning']),
    mailen: readBooleanField(fields, ['Mailen']),
    googleAgenda: readBooleanField(fields, ['Google agenda', 'Google Agenda']),
    googleDrive: readBooleanField(fields, ['Google drive', 'Google Drive']),
  };
}
