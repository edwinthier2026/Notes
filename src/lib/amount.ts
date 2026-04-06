export function parseDutchNumber(value: string): number | null {
  const input = value.trim().replace(/\s+/g, '');
  if (!input) {
    return null;
  }

  if (/^[+-]?\d{1,3}(\.\d{3})*(,\d+)?$/.test(input)) {
    const normalized = input.replace(/\./g, '').replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (/^[+-]?\d+(,\d+)?$/.test(input)) {
    const normalized = input.replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (/^[+-]?\d+(\.\d+)?$/.test(input)) {
    const parsed = Number(input);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function formatDutchNumber(value: number, fractionDigits = 2): string {
  return new Intl.NumberFormat('nl-NL', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatDutchNumberInputLive(value: string, fractionDigits = 2): string {
  const raw = String(value ?? '').replace(/\s+/g, '');
  if (!raw) {
    return '';
  }

  const sign = raw.startsWith('-') ? '-' : raw.startsWith('+') ? '+' : '';
  const unsigned = sign ? raw.slice(1) : raw;
  if (!unsigned) {
    return sign;
  }

  const hasComma = unsigned.includes(',');
  const endsWithComma = unsigned.endsWith(',');

  if (!hasComma) {
    const integerDigits = unsigned.replace(/\D/g, '');
    if (!integerDigits) {
      return sign;
    }
    return sign + new Intl.NumberFormat('nl-NL', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      useGrouping: true,
    }).format(Number(integerDigits));
  }

  const [integerPartRaw, fractionPartRaw = ''] = unsigned.split(',', 2);
  const integerDigits = integerPartRaw.replace(/\D/g, '');
  const fractionDigitsOnly = fractionPartRaw.replace(/\D/g, '').slice(0, Math.max(0, fractionDigits));

  const formattedInteger = integerDigits
    ? new Intl.NumberFormat('nl-NL', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
        useGrouping: true,
      }).format(Number(integerDigits))
    : '0';

  if (endsWithComma && !fractionDigitsOnly) {
    return sign + formattedInteger + ',';
  }

  return sign + formattedInteger + (fractionDigitsOnly ? ',' + fractionDigitsOnly : '');
}

export function normalizeDutchNumberInput(value: string, fractionDigits = 2): string {
  const parsed = parseDutchNumber(value);
  if (parsed === null) {
    return value;
  }
  return formatDutchNumber(parsed, fractionDigits);
}
