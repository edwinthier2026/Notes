export function normalizeSearchText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function parseSearchTerms(input: string): string[] {
  const normalized = normalizeSearchText(input.trim());
  if (!normalized) return [];
  return normalized
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function matchesAllTerms(haystack: string, terms: string[]): boolean {
  if (terms.length === 0) return true;
  const source = normalizeSearchText(haystack);
  return terms.every((term) => source.includes(term));
}
