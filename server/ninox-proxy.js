import { buildNinoxDatabaseBaseUrl } from './ninox-auth.js';

function assertConfig(config) {
  if (!config.apiKey || !config.teamId || !config.databaseId) {
    const error = new Error('Serverconfig ontbreekt. Zet NINOX_API_KEY, NINOX_TEAM_ID en NINOX_DATABASE_ID.');
    error.statusCode = 500;
    throw error;
  }
}

function extractNinoxErrorMessage(payload) {
  if (!payload || typeof payload !== 'object') {
    return '';
  }
  const obj = payload;
  const candidates = [obj.message, obj.error, obj.title, obj.detail, obj.reason];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return '';
}

function compactText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

async function proxyNinoxRequest(method, pathAndQuery, config, body) {
  assertConfig(config);

  const baseUrl = buildNinoxDatabaseBaseUrl(config);
  const normalizedPath = pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`;
  const headers = {
    Authorization: `Bearer ${config.apiKey}`,
    Accept: 'application/json',
  };
  const requestInit = { method, headers };
  if (body !== undefined) {
    requestInit.body = JSON.stringify(body);
    requestInit.headers = { ...headers, 'Content-Type': 'application/json' };
  }

  const response = await fetch(`${baseUrl}${normalizedPath}`, requestInit);
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await response.json().catch(() => ({})) : null;

  if (!response.ok) {
    let message = extractNinoxErrorMessage(payload);
    if (!message) {
      const rawText = await response.text().catch(() => '');
      message = compactText(rawText);
    }
    if (!message) {
      message = compactText(response.statusText) || 'Onbekende Ninox fout';
    }
    const error = new Error(message);
    error.statusCode = response.status;
    throw error;
  }

  if (isJson) {
    return payload;
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    __binary: true,
    statusCode: response.status,
    contentType: contentType || 'application/octet-stream',
    bodyBase64: Buffer.from(arrayBuffer).toString('base64'),
  };
}

async function proxyNinoxRawRequest(method, pathAndQuery, config, rawBody, contentType, fileName) {
  assertConfig(config);

  const baseUrl = buildNinoxDatabaseBaseUrl(config);
  const normalizedPath = pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`;
  const headers = {
    Authorization: `Bearer ${config.apiKey}`,
    Accept: 'application/json',
    ...(contentType ? { 'Content-Type': contentType } : {}),
    ...(fileName ? { 'Content-Disposition': `attachment; filename="${fileName.replace(/"/g, '')}"` } : {}),
  };

  const response = await fetch(`${baseUrl}${normalizedPath}`, {
    method,
    headers,
    body: rawBody,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    let message = extractNinoxErrorMessage(payload);
    if (!message) {
      message = compactText(response.statusText) || 'Onbekende Ninox fout';
    }
    const error = new Error(message);
    error.statusCode = response.status;
    throw error;
  }

  return payload;
}

export async function proxyNinoxGet(pathAndQuery, config) {
  return proxyNinoxRequest('GET', pathAndQuery, config);
}

export async function proxyNinoxPost(pathAndQuery, config, body) {
  return proxyNinoxRequest('POST', pathAndQuery, config, body);
}

export async function proxyNinoxPostRaw(pathAndQuery, config, rawBody, contentType, fileName) {
  return proxyNinoxRawRequest('POST', pathAndQuery, config, rawBody, contentType, fileName);
}

export async function proxyNinoxPut(pathAndQuery, config, body) {
  return proxyNinoxRequest('PUT', pathAndQuery, config, body);
}

export async function proxyNinoxPutRaw(pathAndQuery, config, rawBody, contentType, fileName) {
  return proxyNinoxRawRequest('PUT', pathAndQuery, config, rawBody, contentType, fileName);
}

export async function proxyNinoxDelete(pathAndQuery, config) {
  return proxyNinoxRequest('DELETE', pathAndQuery, config);
}
