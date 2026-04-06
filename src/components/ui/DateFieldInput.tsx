import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Calendar } from 'lucide-react';
import { formatDateDdMmYyyy } from '../../lib/date';

interface DateFieldInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  iconOnly?: boolean;
  buttonClassName?: string;
  buttonTitle?: string;
}

export default function DateFieldInput({
  value,
  onChange,
  disabled = false,
  placeholder = 'dd/mm/yyyy',
  className = '',
  iconOnly = false,
  buttonClassName = '',
  buttonTitle = 'Open kalender',
}: DateFieldInputProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const calendarRef = useRef<HTMLDivElement | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarStyle, setCalendarStyle] = useState<CSSProperties | null>(null);
  const rawValue = value.trim();

  const parseDdMmYyyyToIso = (input: string): string => {
    const trimmed = input.trim();
    const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
      return `${iso[1]}-${iso[2]}-${iso[3]}`;
    }
    const nl = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!nl) {
      return '';
    }
    const day = Number(nl[1]);
    const month = Number(nl[2]);
    const year = Number(nl[3]);
    const probe = new Date(year, month - 1, day);
    if (
      !Number.isFinite(day) ||
      !Number.isFinite(month) ||
      !Number.isFinite(year) ||
      probe.getFullYear() !== year ||
      probe.getMonth() !== month - 1 ||
      probe.getDate() !== day
    ) {
      return '';
    }
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const parseIsoToDate = (iso: string): Date | null => {
    const match = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      return null;
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const probe = new Date(year, month - 1, day);
    if (
      !Number.isFinite(year) ||
      !Number.isFinite(month) ||
      !Number.isFinite(day) ||
      probe.getFullYear() !== year ||
      probe.getMonth() !== month - 1 ||
      probe.getDate() !== day
    ) {
      return null;
    }
    return probe;
  };

  const formatIso = (date: Date): string =>
    `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  const selectedDate = useMemo(() => {
    const iso = parseDdMmYyyyToIso(rawValue);
    if (!iso) {
      return null;
    }
    return parseIsoToDate(iso);
  }, [rawValue]);
  const [viewMonth, setViewMonth] = useState<Date>(() => selectedDate || new Date());

  useEffect(() => {
    if (!isCalendarOpen) {
      return;
    }
    setViewMonth(selectedDate || new Date());
  }, [isCalendarOpen, selectedDate]);

  useEffect(() => {
    if (!isCalendarOpen) {
      return;
    }
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current && !rootRef.current.contains(target)) {
        setIsCalendarOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [isCalendarOpen]);

  const updateCalendarPosition = () => {
    if (!isCalendarOpen || !rootRef.current) {
      return;
    }
    const margin = 8;
    const gap = 6;
    const triggerRect = rootRef.current.getBoundingClientRect();
    const panelWidth = calendarRef.current?.offsetWidth || 288;
    const panelHeight = calendarRef.current?.offsetHeight || 320;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const maxLeft = Math.max(margin, viewportWidth - panelWidth - margin);
    const left = Math.min(Math.max(triggerRect.left, margin), maxLeft);

    const fitsBelow = triggerRect.bottom + gap + panelHeight <= viewportHeight - margin;
    const topIfBelow = Math.min(triggerRect.bottom + gap, Math.max(margin, viewportHeight - panelHeight - margin));
    const topIfAbove = Math.max(margin, triggerRect.top - gap - panelHeight);
    const top = fitsBelow ? topIfBelow : topIfAbove;

    setCalendarStyle({
      position: 'fixed',
      left,
      top,
      zIndex: 60,
    });
  };

  useLayoutEffect(() => {
    updateCalendarPosition();
  }, [isCalendarOpen, viewMonth]);

  useEffect(() => {
    if (!isCalendarOpen) {
      return;
    }
    const onViewportChange = () => updateCalendarPosition();
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
    return () => {
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    };
  }, [isCalendarOpen, viewMonth]);

  const normalizeManualDateInput = (input: string): string => {
    const digits = input.replace(/\D/g, '').slice(0, 8);
    if (!digits) {
      return '';
    }
    if (digits.length <= 2) {
      return digits;
    }
    if (digits.length <= 4) {
      return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  };

  const displayValue = rawValue
    ? /^\d{4}-\d{2}-\d{2}([T ].*)?$/.test(rawValue)
      ? formatDateDdMmYyyy(rawValue)
      : rawValue
    : '';

  const openKalender = () => {
    if (disabled) {
      return;
    }
    setIsCalendarOpen(true);
  };

  const monthLabel = viewMonth.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' });
  const monthStart = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const gridStart = new Date(monthStart);
  const startOffset = (monthStart.getDay() + 6) % 7;
  gridStart.setDate(monthStart.getDate() - startOffset);
  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
  const weekdayLabels = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
  const isSameDate = (a: Date | null, b: Date): boolean =>
    Boolean(a) &&
    (a as Date).getFullYear() === b.getFullYear() &&
    (a as Date).getMonth() === b.getMonth() &&
    (a as Date).getDate() === b.getDate();
  const today = new Date();

  const handleSelectDate = (date: Date) => {
    onChange(formatDateDdMmYyyy(formatIso(date)));
    setIsCalendarOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      {!iconOnly ? (
        <input
          value={displayValue}
          disabled={disabled}
          onChange={(e) => onChange(normalizeManualDateInput(e.target.value))}
          onBlur={(e) => {
            const normalized = normalizeManualDateInput(e.target.value);
            const iso = parseDdMmYyyyToIso(normalized);
            if (iso) {
              onChange(formatDateDdMmYyyy(iso));
              return;
            }
            onChange(normalized);
          }}
          placeholder={placeholder}
          className={`w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500 disabled:bg-dc-gray-50 disabled:text-dc-gray-300 disabled:cursor-not-allowed ${disabled ? '' : 'pr-10'} ${className}`}
        />
      ) : null}

      {!disabled && (
        <>
          <button
            type="button"
            onClick={openKalender}
            className={
              iconOnly
                ? buttonClassName || 'rounded-md p-1 text-dc-gray-400 hover:bg-dc-gray-50 hover:text-dc-blue-500'
                : `absolute right-2 top-1/2 -translate-y-1/2 text-dc-gray-400 hover:text-dc-gray-500 ${buttonClassName}`
            }
            aria-label={buttonTitle}
            title={buttonTitle}
          >
            <Calendar size={16} />
          </button>
          {isCalendarOpen && (
            <div ref={calendarRef} style={calendarStyle || undefined} className="w-72 rounded-lg border border-dc-gray-200 bg-white p-3 shadow-lg">
              <div className="mb-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setViewMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                  className="rounded px-2 py-1 text-sm text-dc-gray-400 hover:bg-dc-gray-50 hover:text-dc-gray-500"
                  aria-label="Vorige maand"
                >
                  &lt;
                </button>
                <div className="text-sm font-medium capitalize text-dc-gray-500">{monthLabel}</div>
                <button
                  type="button"
                  onClick={() => setViewMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                  className="rounded px-2 py-1 text-sm text-dc-gray-400 hover:bg-dc-gray-50 hover:text-dc-gray-500"
                  aria-label="Volgende maand"
                >
                  &gt;
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-dc-gray-400">
                {weekdayLabels.map((label, index) => (
                  <div
                    key={`weekday-${label}`}
                    className={index === 5 ? 'text-blue-600' : index === 6 ? 'text-red-600' : undefined}
                  >
                    {label}
                  </div>
                ))}
              </div>

              <div className="mt-1 grid grid-cols-7 gap-1">
                {calendarDays.map((day) => {
                  const inCurrentMonth = day.getMonth() === viewMonth.getMonth();
                  const isSaturday = day.getDay() === 6;
                  const isSunday = day.getDay() === 0;
                  const selected = isSameDate(selectedDate, day);
                  const isToday = isSameDate(today, day);
                  const weekendColor = isSunday ? 'text-red-600' : isSaturday ? 'text-blue-600' : 'text-dc-gray-500';
                  return (
                    <button
                      key={formatIso(day)}
                      type="button"
                      onClick={() => handleSelectDate(day)}
                      className={`h-8 rounded text-sm ${
                        selected
                          ? 'bg-dc-blue-500 text-white'
                          : inCurrentMonth
                          ? `${weekendColor} hover:bg-dc-gray-50`
                          : 'text-dc-gray-300 hover:bg-dc-gray-50'
                      }`}
                    >
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${
                          selected
                            ? 'bg-transparent text-white'
                            : isToday
                            ? 'bg-dc-blue-100 text-dc-blue-700 ring-1 ring-dc-blue-500'
                            : ''
                        }`}
                      >
                        {day.getDate()}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
