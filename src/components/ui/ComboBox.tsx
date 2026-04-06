import { useEffect, useMemo, useRef, useState, type CSSProperties, type WheelEvent } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { createPortal } from 'react-dom';

export type ComboBoxOption = {
  value: string;
  label: string;
  subtitle?: string;
  searchText?: string;
  disabled?: boolean;
};

function normalizeComboText(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, ' ');
}

function resolveComboOption(options: ComboBoxOption[], rawValue: string): ComboBoxOption | null {
  const raw = normalizeComboText(rawValue);
  if (!raw) {
    return null;
  }

  let best: ComboBoxOption | null = null;
  let bestScore = -1;

  for (const option of options) {
    const valueNorm = normalizeComboText(option.value);
    const labelNorm = normalizeComboText(option.label);
    const subtitleNorm = normalizeComboText(option.subtitle || '');
    const searchNorm = normalizeComboText(option.searchText || '');

    let score = -1;
    if (raw === valueNorm) {
      score = 100;
    } else if (raw === labelNorm) {
      score = 90;
    } else if (subtitleNorm && raw === subtitleNorm) {
      score = 80;
    } else if (labelNorm && (labelNorm.includes(raw) || raw.includes(labelNorm))) {
      score = 70;
    } else if (valueNorm && (valueNorm.includes(raw) || raw.includes(valueNorm))) {
      score = 60;
    } else if (searchNorm && (searchNorm.includes(raw) || raw.includes(searchNorm))) {
      score = 50;
    }

    if (score > bestScore) {
      best = option;
      bestScore = score;
    }
  }

  return bestScore >= 0 ? best : null;
}

type ComboBoxProps = {
  value: string;
  onChange: (value: string) => void;
  options: ComboBoxOption[];
  placeholder: string;
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  buttonClassName?: string;
  dropdownClassName?: string;
  sortOptions?: boolean;
  focusSelectedOnOpen?: boolean;
};

export default function ComboBox({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  searchable = true,
  searchPlaceholder = 'Zoek...',
  emptyText = 'Geen resultaten',
  className = '',
  buttonClassName = '',
  dropdownClassName = '',
  sortOptions = true,
  focusSelectedOnOpen = true,
}: ComboBoxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const firstOptionRef = useRef<HTMLButtonElement | null>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});

  const sortedOptions = useMemo(() => {
    if (!sortOptions) {
      return options;
    }
    const emptyValueOptions = options.filter((option) => option.value.trim() === '');
    const normalOptions = options
      .filter((option) => option.value.trim() !== '')
      .slice()
      .sort((a, b) => a.label.localeCompare(b.label, 'nl', { sensitivity: 'base', numeric: true }));
    return [...emptyValueOptions, ...normalOptions];
  }, [options, sortOptions]);

  const selected = useMemo(() => {
    const direct = sortedOptions.find((option) => option.value === value);
    if (direct) {
      return direct;
    }
    return resolveComboOption(sortedOptions, value);
  }, [sortedOptions, value]);

  const visibleOptions = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) {
      return sortedOptions;
    }
    return sortedOptions.filter((option) => {
      const haystack = `${option.label} ${option.subtitle || ''} ${option.searchText || ''}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [sortedOptions, query]);

  useEffect(() => {
    const updateMenuPosition = () => {
      if (!open || !triggerRef.current) {
        return;
      }
      const rect = triggerRef.current.getBoundingClientRect();
      const margin = 8;
      const gap = 4;
      const viewportWidth = window.innerWidth;
      const clampedWidth = Math.min(rect.width, Math.max(160, viewportWidth - margin * 2 - 2));
      const maxLeft = Math.max(margin, viewportWidth - clampedWidth - margin);
      const clampedLeft = Math.min(Math.max(rect.left, margin), maxLeft);
      const spaceBelow = Math.max(120, window.innerHeight - rect.bottom - margin);
      const spaceAbove = Math.max(120, rect.top - margin);
      const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;
      const maxHeight = Math.min(320, openUp ? spaceAbove : spaceBelow);

      if (openUp) {
        setMenuStyle({
          position: 'fixed',
          left: clampedLeft,
          bottom: window.innerHeight - rect.top + gap,
          width: clampedWidth,
          boxSizing: 'border-box',
          zIndex: 10000,
          maxHeight,
        });
        return;
      }

      setMenuStyle({
        position: 'fixed',
        left: clampedLeft,
        top: rect.bottom + gap,
        width: clampedWidth,
        boxSizing: 'border-box',
        zIndex: 10000,
        maxHeight,
      });
    };

    updateMenuPosition();
    if (!open) {
      return;
    }

    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [open]);

  const findSelectedButton = (list: HTMLDivElement): HTMLButtonElement | null => {
    const buttons = Array.from(list.querySelectorAll<HTMLButtonElement>('button[data-combo-value]')).filter(
      (button) => !button.disabled
    );
    if (buttons.length === 0) {
      return null;
    }

    const canonicalValue = visibleOptions.some((option) => option.value === value) ? value : selected?.value || '';
    if (canonicalValue) {
      const byValue = buttons.find((button) => (button.dataset.comboValue || '') === canonicalValue);
      if (byValue) {
        return byValue;
      }
    }

    const selectedLabel = selected?.label ? normalizeComboText(selected.label) : '';
    if (selectedLabel) {
      const byLabel = buttons.find((button) => normalizeComboText(button.dataset.comboLabel || '') === selectedLabel);
      if (byLabel) {
        return byLabel;
      }
    }

    // Final fallback: fuzzy match using current raw value (for legacy label/text-loaded states).
    const raw = normalizeComboText(value || '');
    if (raw) {
      const byRaw = buttons.find((button) => {
        const optionValue = normalizeComboText(button.dataset.comboValue || '');
        const optionLabel = normalizeComboText(button.dataset.comboLabel || '');
        return raw === optionValue || raw === optionLabel || optionLabel.includes(raw) || raw.includes(optionLabel);
      });
      if (byRaw) {
        return byRaw;
      }
    }

    return null;
  };

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (!open) {
        return;
      }
      const target = event.target as Node;
      const insideRoot = Boolean(rootRef.current && rootRef.current.contains(target));
      const insideDropdown = Boolean(dropdownRef.current && dropdownRef.current.contains(target));
      if (!insideRoot && !insideDropdown) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  useEffect(() => {
    if (disabled) {
      setOpen(false);
    }
  }, [disabled]);

  // Projectwide reliability: if a loaded value matches label/text instead of option.value
  // (common with Ninox link fields), normalize it to the canonical option.value automatically.
  useEffect(() => {
    if (!value || disabled) {
      return;
    }
    const direct = sortedOptions.find((option) => option.value === value);
    if (direct) {
      return;
    }
    const resolved = resolveComboOption(sortedOptions, value);
    if (resolved && resolved.value !== value) {
      onChange(resolved.value);
    }
  }, [disabled, onChange, sortedOptions, value]);

  useEffect(() => {
    if (!open || !searchable) {
      return;
    }
    if (value.trim() !== '') {
      return;
    }
    requestAnimationFrame(() => {
      searchInputRef.current?.focus({ preventScroll: true });
    });
  }, [open, searchable, value]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflowX = html.style.overflowX;
    const prevBodyOverflowX = body.style.overflowX;
    html.style.overflowX = 'hidden';
    body.style.overflowX = 'hidden';

    return () => {
      html.style.overflowX = prevHtmlOverflowX;
      body.style.overflowX = prevBodyOverflowX;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (!listRef.current) {
      return;
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const list = listRef.current;
        if (!list) {
          return;
        }
        if (!focusSelectedOnOpen) {
          list.scrollTop = 0;
          if (!searchable) {
            const firstEnabled = list.querySelector<HTMLButtonElement>('button:not(:disabled)');
            firstEnabled?.focus({ preventScroll: true });
          }
          return;
        }
        const isEmptyValue = value.trim() === '';
        if (isEmptyValue) {
          list.scrollTop = 0;
          if (searchable) {
            return;
          }
          const firstEnabled = list.querySelector<HTMLButtonElement>('button:not(:disabled)');
          if (firstEnabled) {
            firstEnabled.focus({ preventScroll: true });
          } else {
            firstOptionRef.current?.focus({ preventScroll: true });
          }
          return;
        }

        const selectedButton = findSelectedButton(list);
        if (!selectedButton) {
          list.scrollTop = 0;
          return;
        }

        selectedButton.scrollIntoView({ block: 'nearest' });
        if (!searchable) {
          selectedButton.focus({ preventScroll: true });
        }
      });
    });
  }, [focusSelectedOnOpen, open, searchable, value, selected?.value, selected?.label, visibleOptions]);

  const handleSelect = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
    setQuery('');
  };

  const handleToggleOpen = () => {
    setOpen((current) => {
      const next = !current;
      if (next) {
        setQuery('');
      }
      return next;
    });
  };

  const handleWheelCapture = (event: WheelEvent<HTMLDivElement>) => {
    event.stopPropagation();
    const list = listRef.current;
    if (!list) {
      return;
    }
    event.preventDefault();
    list.scrollTop += event.deltaY;
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={handleToggleOpen}
        className={`w-full min-w-0 rounded-lg border border-dc-gray-200 px-3 py-2 text-sm text-left text-dc-gray-500 inline-flex items-center justify-between gap-2 ${
          disabled ? 'bg-dc-gray-50 text-dc-gray-300 cursor-not-allowed' : 'bg-white'
        } ${buttonClassName}`}
      >
        <span className="min-w-0 flex-1 truncate">{selected?.label || placeholder}</span>
        <ChevronDown size={14} className={`shrink-0 text-dc-gray-300 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open &&
        !disabled &&
        createPortal(
          <div
            ref={dropdownRef}
            style={menuStyle}
            onWheelCapture={handleWheelCapture}
            className={`max-w-[calc(100vw-16px)] border border-dc-gray-200 rounded-lg bg-white shadow-lg overflow-x-hidden ${dropdownClassName}`}
          >
          {searchable && (
            <div className="p-2 border-b border-dc-gray-100">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dc-gray-300" />
                <input
                  ref={searchInputRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full rounded-md border border-dc-gray-200 pl-7 pr-2 py-1.5 text-sm outline-none focus:border-dc-blue-500"
                />
              </div>
            </div>
          )}
          <div ref={listRef} className="max-h-56 overflow-y-auto overscroll-contain">
            {visibleOptions.map((option, index) => {
              const isSelected = option.value === (selected?.value ?? value);
              const shouldFocusFirst = !selected && index === 0;
              return (
              <button
                key={option.value}
                type="button"
                data-combo-value={option.value}
                data-combo-label={option.label}
                ref={shouldFocusFirst ? firstOptionRef : null}
                disabled={option.disabled}
                onClick={() => handleSelect(option.value)}
                className={`w-full text-left px-3 py-2 border-b border-dc-gray-50 last:border-b-0 disabled:opacity-60 disabled:cursor-not-allowed ${
                  isSelected ? 'bg-dc-blue-500 text-white hover:bg-dc-blue-600' : 'hover:bg-dc-gray-50'
                }`}
              >
                <div className={`text-sm font-medium truncate ${isSelected ? 'text-white' : 'text-dc-gray-500'}`}>{option.label}</div>
                {option.subtitle && <div className={`text-xs truncate ${isSelected ? 'text-white/90' : 'text-dc-gray-300'}`}>{option.subtitle}</div>}
              </button>
            );
            })}
            {visibleOptions.length === 0 && <div className="px-3 py-2 text-xs text-dc-gray-300">{emptyText}</div>}
          </div>
          </div>,
          document.body
        )}
    </div>
  );
}
