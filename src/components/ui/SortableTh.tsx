import type { ReactNode } from 'react';
import type { SortDirection } from '../../lib/sort';

interface SortableThProps {
  label: ReactNode;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
  className?: string;
}

export default function SortableTh({ label, active, direction, onClick, className = '' }: SortableThProps) {
  return (
    <th className={className} aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors ${
          active
            ? 'bg-dc-blue-50 text-dc-blue-600 border border-dc-blue-100'
            : 'text-dc-gray-400 hover:text-dc-gray-500 hover:bg-dc-gray-50'
        }`}
      >
        <span>{label}</span>
        <span className={`text-[10px] leading-none ${active ? 'text-dc-blue-500' : 'text-dc-gray-300'}`}>
          {active ? (direction === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  );
}
