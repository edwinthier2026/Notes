function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function asTemplateText(value) {
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
    const obj = value;
    const candidates = [obj.id, obj.value, obj.key, obj.recordId, obj.caption, obj.label, obj.name, obj.text];
    for (const candidate of candidates) {
      const text = asTemplateText(candidate).trim();
      if (text) {
        return text;
      }
    }
  }
  return '';
}

function normalizeTemplateKey(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '');
}

function resolveTemplateToken(fields, token) {
  const entries = Object.entries(fields || {});
  const trimmedToken = String(token || '').trim();
  if (!trimmedToken) {
    return null;
  }

  const direct = entries.filter(([key]) => key.toLowerCase() === trimmedToken.toLowerCase());
  for (let index = direct.length - 1; index >= 0; index -= 1) {
    const text = asTemplateText(direct[index][1]).trim();
    if (text) {
      return text;
    }
  }

  const normalizedToken = normalizeTemplateKey(trimmedToken);
  const normalized = entries.filter(([key]) => normalizeTemplateKey(key) === normalizedToken);
  for (let index = normalized.length - 1; index >= 0; index -= 1) {
    const text = asTemplateText(normalized[index][1]).trim();
    if (text) {
      return text;
    }
  }

  return null;
}

function stringToBool(value) {
  const normalized = String(value || '').toLowerCase().trim();
  if (!normalized) {
    return false;
  }
  return !['0', 'false', 'nee', 'no', 'n', 'off', '-'].includes(normalized);
}

function evalCondition(expression, fields) {
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

function applyTemplateConditionals(template, fields) {
  const input = String(template || '');
  const ifRegex = /\{if\s+([^}]+)\}/gi;
  const tokenRegex = /\{if\s+[^}]+\}|\{else\}|\{endif\}/gi;

  const resolveBlock = (source) => {
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
    let tokenMatch = tokenRegex.exec(source);

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
    const merged = source.slice(0, blockStart) + resolveBlock(keep) + source.slice(endIndex + endTokenLength);
    return resolveBlock(merged);
  };

  return resolveBlock(input);
}

function normalizeMergeFieldKey(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, '');
}

function pickMergeFieldValue(mergeFields, candidates) {
  const entries = Object.entries(mergeFields || {});
  for (const candidate of candidates) {
    const wanted = normalizeMergeFieldKey(candidate);
    const exactMatches = entries.filter(([key]) => normalizeMergeFieldKey(key) === wanted);
    for (let index = exactMatches.length - 1; index >= 0; index -= 1) {
      const value = exactMatches[index]?.[1];
      if (value != null && String(value).trim()) {
        return String(value);
      }
    }
  }
  return '';
}

function formatAmountNl(value) {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return '';
  }
  if (raw.includes(',') || raw.includes('.')) {
    return raw;
  }
  const asNumber = Number(raw);
  if (!Number.isFinite(asNumber)) {
    return raw;
  }
  return new Intl.NumberFormat('nl-NL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(asNumber);
}

function parseAmountLoose(value) {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return 0;
  }
  const normalized = raw.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildFactuurBlokHtml(mergeFields) {
  const regel1Omschrijving =
    pickMergeFieldValue(mergeFields, ['Omschrijving - 01']) ||
    pickMergeFieldValue(mergeFields, ['Omschrijving']) ||
    '';
  const regel1BedragBron =
    pickMergeFieldValue(mergeFields, ['Bedrag - 01']) || pickMergeFieldValue(mergeFields, ['Bedrag']);
  const regel1Bedrag = formatAmountNl(regel1BedragBron);

  const regel2Omschrijving = pickMergeFieldValue(mergeFields, ['Omschrijving - 02']);
  const regel2BedragBron = pickMergeFieldValue(mergeFields, ['Bedrag - 02']);
  const regel2Bedrag = formatAmountNl(regel2BedragBron);
  const toonRegel2 = Boolean(regel2Omschrijving) || parseAmountLoose(regel2BedragBron) !== 0;
  const regelRows = [];

  if (regel1Omschrijving || regel1Bedrag) {
    regelRows.push(
      `<tr><td style="padding:2px 0;">${escapeHtml(regel1Omschrijving || '-')}</td><td style="padding:2px 0;text-align:right;white-space:nowrap;">${escapeHtml(regel1Bedrag || '-')}</td></tr>`
    );
  }
  if (toonRegel2) {
    regelRows.push(
      `<tr><td style="padding:2px 0;">${escapeHtml(regel2Omschrijving || '-')}</td><td style="padding:2px 0;text-align:right;white-space:nowrap;">${escapeHtml(regel2Bedrag || '-')}</td></tr>`
    );
  }
  if (regelRows.length === 0) {
    regelRows.push('<tr><td style="padding:2px 0;">-</td><td style="padding:2px 0;text-align:right;">-</td></tr>');
  }

  const totaalBron = pickMergeFieldValue(mergeFields, ['Bedrag']) || pickMergeFieldValue(mergeFields, ['Totaalbedrag']);
  const totaalBedrag = totaalBron
    ? formatAmountNl(totaalBron)
    : formatAmountNl(parseAmountLoose(regel1BedragBron) + parseAmountLoose(regel2BedragBron));

  return [
    '<table role="presentation" width="100%" style="border-collapse:collapse;width:100%;margin:0;">',
    '<tbody>',
    ...regelRows,
    '<tr><td></td><td style="padding-top:6px;"><div style="border-top:1px solid #000000;width:9ch;margin-left:auto;"></div></td></tr>',
    `<tr><td style="padding-top:4px;"></td><td style="padding-top:4px;text-align:right;white-space:nowrap;"><strong>${escapeHtml(totaalBedrag)}</strong></td></tr>`,
    '</tbody>',
    '</table>',
  ].join('');
}

export function renderTabRows(html) {
  const source = String(html || '');
  if (!/\{TAB_R\}|\{TAB\}/i.test(source)) {
    return source;
  }

  const normalized = source
    .replace(/<\/div>\s*<div>/gi, '<br>')
    .replace(/<div>/gi, '')
    .replace(/<\/div>/gi, '<br>')
    .replace(/<\/p>\s*<p>/gi, '<br>')
    .replace(/<p>/gi, '')
    .replace(/<\/p>/gi, '<br>');
  const parts = normalized.split(/<br\s*\/?>/gi).map((part) => String(part || '').replace(/&nbsp;/gi, ' ').trim());
  const lines = [];

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    const prev = parts[index - 1] || '';
    const next = parts[index + 1] || '';
    const prevHasTab = /\{TAB_R\}|\{TAB\}/i.test(prev);
    const nextHasTab = /\{TAB_R\}|\{TAB\}/i.test(next);
    const nextIsTab = /\{TAB_R\}|\{TAB\}/i.test(next);

    if (!part) {
      if ((prevHasTab && nextHasTab) || nextIsTab) {
        continue;
      }
      lines.push({ kind: 'plain', html: '' });
      continue;
    }

    const tabMatch = part.match(/\{TAB_R\}|\{TAB\}/i);
    if (!tabMatch || tabMatch.index === undefined) {
      lines.push({ kind: 'plain', html: part });
      continue;
    }

    const tabToken = tabMatch[0];
    const tabIndex = tabMatch.index;
    lines.push({
      kind: 'tab',
      left: String(part.slice(0, tabIndex) || '').trim(),
      right: String(part.slice(tabIndex + tabToken.length) || '').trim(),
      rightAlign: tabToken.toUpperCase() === '{TAB_R}',
    });
  }

  const outParts = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (line.kind === 'tab') {
      const rows = [];
      while (index < lines.length && lines[index].kind === 'tab') {
        const tabLine = lines[index];
        rows.push({ left: tabLine.left, right: tabLine.right, rightAlign: tabLine.rightAlign });
        index += 1;
      }
      const hasRightAlign = rows.some((row) => row.rightAlign);
      const rowsHtml = rows
        .map(
          (row) =>
            `<tr><td style="text-align:left;vertical-align:top;color:#000000;padding:0 ${row.rightAlign ? '12px' : '4px'} 0 0;white-space:nowrap;">${row.left}</td><td style="text-align:${row.rightAlign ? 'right' : 'left'};white-space:nowrap;vertical-align:top;color:#000000;padding:0;">${row.right}</td></tr>`
        )
        .join('');
      outParts.push(
        `<table role="presentation" ${hasRightAlign ? 'width="100%"' : ''} style="border-collapse:collapse;${hasRightAlign ? 'width:100%;' : 'width:auto;'}"><tbody>${rowsHtml}</tbody></table>`
      );
      continue;
    }
    outParts.push(line.html);
    index += 1;
  }

  return outParts.join('<br>').replace(/(?:<br\s*\/?>\s*){4,}/gi, '<br><br><br>');
}

export function renderTemplate(template, mergeFields) {
  const source = applyTemplateConditionals(String(template || ''), mergeFields || {});
  if (!source.includes('{')) {
    return source;
  }

  return source.replace(/\{([^{}]+)\}/g, (fullMatch, token) => {
    const rawToken = String(token || '').trim();
    if (!rawToken) {
      return fullMatch;
    }

    const keyword = rawToken.toLowerCase();
    if (keyword === 'else' || keyword === 'endif' || keyword.startsWith('if ')) {
      return '';
    }

    const wanted = normalizeTemplateKey(rawToken);
    if (wanted === 'factuurblok') {
      const explicit = pickMergeFieldValue(mergeFields, ['FACTUUR_BLOK']);
      if (explicit) {
        const explicitText = String(explicit).trim();
        if (!/^\{\s*FACTUUR_BLOK\s*\}$/i.test(explicitText) && explicitText !== 'FACTUUR_BLOK') {
          return explicit;
        }
      }
      return buildFactuurBlokHtml(mergeFields);
    }

    const yearSliceMatch = rawToken.match(/^(.+?)\s*\[\s*[-âˆ’â€‘]4\s*:\s*\]\s*$/);
    if (yearSliceMatch) {
      const baseToken = String(yearSliceMatch[1] || '').trim();
      const baseValue = resolveTemplateToken(mergeFields || {}, baseToken);
      if (baseValue !== null) {
        const yearMatch = String(baseValue).match(/(19\d{2}|20\d{2}|21\d{2})/);
        if (yearMatch) {
          return yearMatch[1];
        }
        const digitsOnly = String(baseValue).replace(/\D/g, '');
        if (digitsOnly.length >= 4) {
          return digitsOnly.slice(-4);
        }
      }
      return '';
    }

    const value = resolveTemplateToken(mergeFields || {}, rawToken);
    if (value !== null) {
      return value;
    }

    return fullMatch;
  });
}
