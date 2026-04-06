export type SortDirection = 'asc' | 'desc';

export interface SortState<K extends string> {
  key: K;
  direction: SortDirection;
}

export function nextSortState<K extends string>(current: SortState<K>, key: K): SortState<K> {
  if (current.key !== key) {
    return { key, direction: 'asc' };
  }
  return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
}

export function compareByDirection(a: number, direction: SortDirection): number {
  return direction === 'asc' ? a : -a;
}

export function compareStrings(a: string, b: string, direction: SortDirection): number {
  return compareByDirection(a.localeCompare(b, 'nl', { sensitivity: 'base', numeric: true }), direction);
}

export function compareNumbers(a: number, b: number, direction: SortDirection): number {
  return compareByDirection(a - b, direction);
}
