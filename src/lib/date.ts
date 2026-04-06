export function formatDateDdMmYyyy(value: string | Date | null | undefined): string {
  if (!value) {
    return '-';
  }

  if (value instanceof Date) {
    const day = String(value.getDate()).padStart(2, '0');
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const year = value.getFullYear();
    return `${day}/${month}/${year}`;
  }

  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }

  const slashMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const first = Number(slashMatch[1]);
    const second = Number(slashMatch[2]);
    const year = slashMatch[3];
    // Projectstandard: slash-datums zijn altijd dd/mm/yyyy.
    if (first >= 1 && first <= 31 && second >= 1 && second <= 12) {
      return `${String(first).padStart(2, '0')}/${String(second).padStart(2, '0')}/${year}`;
    }
    // Als bron toch mm/dd levert (tweede deel > 12), corrigeer naar dd/mm.
    if (second > 12 && first >= 1 && first <= 12) {
      return `${String(second).padStart(2, '0')}/${String(first).padStart(2, '0')}/${year}`;
    }
  }

  // Voorkom locale-afhankelijke parsing van slash-datums.
  if (value.includes('/')) {
    return value;
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = parsed.getFullYear();
    return `${day}/${month}/${year}`;
  }

  return value;
}

export function normalizeEditableDateInput(value: string | null | undefined): string {
  const raw = (value || '').trim();
  if (!raw || raw === '-' || raw === '--/--/----') {
    return '';
  }
  return raw;
}

export function isValidDdMmYyyy(value: string | null | undefined): boolean {
  const raw = normalizeEditableDateInput(value);
  if (!raw) {
    return false;
  }
  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) {
    return false;
  }
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const probe = new Date(year, month - 1, day);
  return (
    Number.isFinite(day) &&
    Number.isFinite(month) &&
    Number.isFinite(year) &&
    probe.getFullYear() === year &&
    probe.getMonth() === month - 1 &&
    probe.getDate() === day
  );
}

export function normalizeDateToIso(value: string | null | undefined): string {
  const raw = normalizeEditableDateInput(value);
  if (!raw) {
    return new Date().toISOString().slice(0, 10);
  }

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const first = Number(slashMatch[1]);
    const second = Number(slashMatch[2]);
    const year = slashMatch[3];
    let day = first;
    let month = second;
    // Projectstandard: slash-datums zijn dd/mm/yyyy.
    // Corrigeer alleen wanneer bron aantoonbaar mm/dd geeft.
    if (second > 12 && first >= 1 && first <= 12) {
      day = second;
      month = first;
    }
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return new Date().toISOString().slice(0, 10);
}

export function todayDdMmYyyy(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  return `${day}/${month}/${year}`;
}

export function todayDdMmYyyyAtTime(time?: string): string {
  if (time && /^\d{2}:\d{2}$/.test(time.trim())) {
    return `${todayDdMmYyyy()} ${time.trim()}`;
  }
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${todayDdMmYyyy()} ${hh}:${mm}`;
}

export function normalizeDateTimeToIso(value: string | null | undefined): string {
  const raw = (value || '').trim();
  if (!raw) {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T12:00:00`;
  }

  const isoWithTime = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (isoWithTime) {
    const seconds = isoWithTime[6] || '00';
    return `${isoWithTime[1]}-${isoWithTime[2]}-${isoWithTime[3]}T${isoWithTime[4]}:${isoWithTime[5]}:${seconds}`;
  }

  const nlWithTime = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
  if (nlWithTime) {
    return `${nlWithTime[3]}-${nlWithTime[2]}-${nlWithTime[1]}T${nlWithTime[4]}:${nlWithTime[5]}:00`;
  }

  const dateOnly = normalizeDateToIso(raw);
  return `${dateOnly}T12:00:00`;
}

export function formatDateTimeDdMmYyyyHhMm(value: string | Date | null | undefined): string {
  if (!value) {
    return '-';
  }

  if (value instanceof Date) {
    const day = String(value.getDate()).padStart(2, '0');
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const year = value.getFullYear();
    const hh = String(value.getHours()).padStart(2, '0');
    const mm = String(value.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hh}:${mm}`;
  }

  const nlWithTime = value.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::\d{2})?$/);
  if (nlWithTime) {
    return `${nlWithTime[1]}/${nlWithTime[2]}/${nlWithTime[3]} ${nlWithTime[4]}:${nlWithTime[5]}`;
  }

  const isoWithTime = value.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (isoWithTime) {
    return `${isoWithTime[3]}/${isoWithTime[2]}/${isoWithTime[1]} ${isoWithTime[4]}:${isoWithTime[5]}`;
  }

  return formatDateDdMmYyyy(value);
}
