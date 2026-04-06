function asTemplateText(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'Ja' : 'Nee';
  }
  if (Array.isArray(value)) {
    return value.map((item) => asTemplateText(item)).filter(Boolean).join(', ');
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const candidates = [obj.id, obj.value, obj.key, obj.recordId, obj.caption, obj.label, obj.name, obj.text];
    for (const candidate of candidates) {
      const text = asTemplateText(candidate).trim();
      if (text) {
        return text;
      }
    }
    const joined = Object.values(obj)
      .map((item) => asTemplateText(item).trim())
      .filter(Boolean)
      .join(' ');
    if (joined) {
      return joined;
    }
  }
  return '';
}

function normalizeTemplateKey(value: string): string {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '');
}

function pickBestMatch(candidates: Array<[string, unknown]>): string | null {
  if (candidates.length === 0) {
    return null;
  }
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const value = asTemplateText(candidates[index][1]).trim();
    if (value) {
      return value;
    }
  }
  return asTemplateText(candidates[candidates.length - 1][1]);
}

function resolveTemplateToken(fields: Record<string, unknown>, token: string): string | null {
  const entries = Object.entries(fields);
  const trimmedToken = String(token || '').trim();
  if (!trimmedToken) {
    return null;
  }

  const direct = entries.filter(([key]) => key.toLowerCase() === trimmedToken.toLowerCase());
  const directValue = pickBestMatch(direct);
  if (directValue !== null) {
    return directValue;
  }

  const normalizedToken = normalizeTemplateKey(trimmedToken);
  const normalized = entries.filter(([key]) => normalizeTemplateKey(key) === normalizedToken);
  const normalizedValue = pickBestMatch(normalized);
  if (normalizedValue !== null) {
    return normalizedValue;
  }

  const contains = entries.filter(([key, value]) => {
    const text = asTemplateText(value).trim();
    if (!text) {
      return false;
    }
    const normalizedKey = normalizeTemplateKey(key);
    return normalizedKey.includes(normalizedToken) || normalizedToken.includes(normalizedKey);
  });
  if (contains.length > 0) {
    contains.sort((a, b) => normalizeTemplateKey(a[0]).length - normalizeTemplateKey(b[0]).length);
    const containsValue = pickBestMatch(contains);
    if (containsValue !== null) {
      return containsValue;
    }
  }

  return null;
}

function stringToBool(value: string): boolean {
  const normalized = value.toLowerCase().trim();
  if (!normalized) {
    return false;
  }
  return !['0', 'false', 'nee', 'no', 'n', 'off', '-'].includes(normalized);
}

function evalCondition(expression: string, fields: Record<string, unknown>): boolean {
  const raw = String(expression || '').trim();
  if (!raw) {
    return false;
  }
  const notMatch = raw.match(/^not\s+(.+)$/i);
  if (notMatch) {
    return !evalCondition(notMatch[1], fields);
  }
  const compareMatch = raw.match(/^(.+?)(==|!=)(.+)$/);
  if (compareMatch) {
    const leftToken = compareMatch[1].trim();
    const operator = compareMatch[2];
    const rightToken = compareMatch[3].trim();
    const leftValue = String(resolveTemplateToken(fields, leftToken) ?? leftToken).trim().toLowerCase();
    const rightValue = rightToken.replace(/^['"]|['"]$/g, '').trim().toLowerCase();
    return operator === '==' ? leftValue === rightValue : leftValue !== rightValue;
  }
  const tokenValue = resolveTemplateToken(fields, raw);
  if (tokenValue === null) {
    return false;
  }
  return stringToBool(tokenValue);
}

export function applyTemplateConditionals(template: string, fields: Record<string, unknown>): string {
  const input = String(template || '');
  const ifRegex = /\{if\s+([^}]+)\}/gi;
  const tokenRegex = /\{if\s+[^}]+\}|\{else\}|\{endif\}/gi;

  const resolveBlock = (source: string): string => {
    const ifMatch = ifRegex.exec(source);
    ifRegex.lastIndex = 0;
    if (!ifMatch || ifMatch.index < 0) {
      return source;
    }

    const blockStart = ifMatch.index;
    const opening = ifMatch[0];
    const expression = ifMatch[1] || '';
    let depth = 1;
    let elseIndex = -1;
    let endIndex = -1;
    let endTokenLength = 0;
    tokenRegex.lastIndex = blockStart + opening.length;
    let tokenMatch: RegExpExecArray | null = tokenRegex.exec(source);
    while (tokenMatch) {
      const token = tokenMatch[0].toLowerCase();
      if (token.startsWith('{if ')) {
        depth += 1;
      } else if (token === '{endif}') {
        depth -= 1;
        if (depth === 0) {
          endIndex = tokenMatch.index;
          endTokenLength = tokenMatch[0].length;
          break;
        }
      } else if (token === '{else}' && depth === 1 && elseIndex < 0) {
        elseIndex = tokenMatch.index;
      }
      tokenMatch = tokenRegex.exec(source);
    }
    tokenRegex.lastIndex = 0;
    if (endIndex < 0) {
      return source;
    }

    const trueStart = blockStart + opening.length;
    const truePart = source.slice(trueStart, elseIndex >= 0 ? elseIndex : endIndex);
    const falsePart = elseIndex >= 0 ? source.slice(elseIndex + '{else}'.length, endIndex) : '';
    const keep = evalCondition(expression, fields) ? truePart : falsePart;

    const merged =
      source.slice(0, blockStart) +
      resolveBlock(keep) +
      source.slice(endIndex + endTokenLength);
    return resolveBlock(merged);
  };

  return resolveBlock(input);
}

export function replaceTemplatePlaceholders(template: string, fields: Record<string, unknown>): string {
  return String(template || '').replace(/\{([^{}]+)\}/g, (full, rawToken: string) => {
    const token = String(rawToken || '').trim();
    if (!token) {
      return full;
    }
    const keyword = token.toLowerCase();
    if (keyword === 'else' || keyword === 'endif' || keyword.startsWith('if ')) {
      return '';
    }
    const yearSliceMatch = token.match(/^(.+?)\s*\[\s*[-−‑]4\s*:\s*\]\s*$/);
    if (yearSliceMatch) {
      const baseToken = String(yearSliceMatch[1] || '').trim();
      const baseValue = resolveTemplateToken(fields, baseToken);
      if (baseValue !== null) {
        const jaarMatch = String(baseValue).match(/(19\d{2}|20\d{2}|21\d{2})/);
        if (jaarMatch) {
          return jaarMatch[1];
        }
        const digitsOnly = String(baseValue).replace(/\D/g, '');
        if (digitsOnly.length >= 4) {
          return digitsOnly.slice(-4);
        }
      }
    }
    // Hard fallback for Factuurdatum year-slice variants to avoid fuzzy matching to full date.
    if (
      /^factuurdatum/i.test(token) &&
      ((token.includes('[') && token.includes(']') && /4/.test(token) && token.includes(':')) ||
        /\[\s*[-−‑]4\s*:\s*\]/i.test(token))
    ) {
      const baseValue = resolveTemplateToken(fields, 'Factuurdatum');
      if (baseValue !== null) {
        const jaarMatch = String(baseValue).match(/(19\d{2}|20\d{2}|21\d{2})/);
        if (jaarMatch) {
          return jaarMatch[1];
        }
      }
      return '';
    }
    const value = resolveTemplateToken(fields, token);
    return value === null ? full : value;
  });
}

export function decodeBasicHtmlEntities(value: string): string {
  let out = String(value || '');
  for (let i = 0; i < 3; i += 1) {
    const next = out
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&#39;/gi, "'")
      .replace(/&quot;/gi, '"');
    if (next === out) {
      break;
    }
    out = next;
  }
  return out;
}
