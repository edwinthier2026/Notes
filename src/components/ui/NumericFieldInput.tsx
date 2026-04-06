import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { normalizeDutchNumberInput } from '../../lib/amount';

interface NumericFieldInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  fractionDigits?: number;
  placeholder?: string;
}

function toEditableRawValue(value: string): string {
  const input = String(value ?? '').trim();
  if (!input) {
    return '';
  }

  const sign = input.startsWith('-') ? '-' : input.startsWith('+') ? '+' : '';
  const unsigned = sign ? input.slice(1) : input;
  const normalized = unsigned.replace(/\./g, '');
  const parts = normalized.split(',');
  const integerDigits = (parts[0] || '').replace(/\D/g, '') || '0';
  const fractionDigits = (parts[1] || '').replace(/\D/g, '');

  if (!fractionDigits || /^0+$/.test(fractionDigits)) {
    return sign + integerDigits;
  }

  return sign + integerDigits + ',' + fractionDigits;
}

function sanitizeRawInput(value: string): string {
  const input = String(value ?? '').replace(/\s+/g, '');
  if (!input) {
    return '';
  }

  const sign = input.startsWith('-') ? '-' : input.startsWith('+') ? '+' : '';
  const unsigned = sign ? input.slice(1) : input;
  const cleaned = unsigned.replace(/[^\d,]/g, '');
  const firstComma = cleaned.indexOf(',');
  if (firstComma === -1) {
    return sign + cleaned;
  }

  const integerPart = cleaned.slice(0, firstComma).replace(/,/g, '');
  const fractionPart = cleaned.slice(firstComma + 1).replace(/,/g, '');
  return sign + integerPart + ',' + fractionPart;
}

function formatFixedDutchDisplay(rawValue: string, fractionDigits = 2): string {
  const raw = sanitizeRawInput(rawValue);
  if (!raw) {
    return '';
  }

  const sign = raw.startsWith('-') ? '-' : raw.startsWith('+') ? '+' : '';
  const unsigned = sign ? raw.slice(1) : raw;
  const [integerPartRaw, fractionPartRaw = ''] = unsigned.split(',', 2);
  const integerDigits = integerPartRaw.replace(/\D/g, '');
  const fractionOnly = fractionPartRaw.replace(/\D/g, '').slice(0, Math.max(0, fractionDigits));

  const formattedInteger = new Intl.NumberFormat('nl-NL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(Number(integerDigits || '0'));

  const paddedFraction = fractionDigits > 0
    ? (fractionOnly + '0'.repeat(fractionDigits)).slice(0, fractionDigits)
    : '';

  return fractionDigits > 0
    ? sign + formattedInteger + ',' + paddedFraction
    : sign + formattedInteger;
}

function isEditableCharacter(char: string): boolean {
  return /[\d,+-]/.test(char);
}

function countEditableCharacters(value: string): number {
  return Array.from(value).filter(isEditableCharacter).length;
}

function resolveCaretPosition(formattedValue: string, editableCount: number): number {
  if (editableCount <= 0) {
    return 0;
  }

  let seen = 0;
  for (let index = 0; index < formattedValue.length; index += 1) {
    if (!isEditableCharacter(formattedValue[index] || '')) {
      continue;
    }
    seen += 1;
    if (seen >= editableCount) {
      return index + 1;
    }
  }

  return formattedValue.length;
}

export default function NumericFieldInput({
  value,
  onChange,
  disabled = false,
  readOnly = false,
  fractionDigits = 2,
  placeholder = '',
}: NumericFieldInputProps) {
  const [rawValue, setRawValue] = useState(() => toEditableRawValue(value));
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pendingCaretRef = useRef<number | null>(null);

  useEffect(() => {
    if (!focused) {
      setRawValue(toEditableRawValue(value));
    }
  }, [value, focused]);

  const displayValue = useMemo(() => formatFixedDutchDisplay(rawValue, fractionDigits), [rawValue, fractionDigits]);

  useLayoutEffect(() => {
    if (!focused || pendingCaretRef.current === null || !inputRef.current) {
      return;
    }

    const nextCaret = pendingCaretRef.current;
    inputRef.current.setSelectionRange(nextCaret, nextCaret);
    pendingCaretRef.current = null;
  }, [displayValue, focused]);

  if (readOnly) {
    return (
      <input
        value={value}
        disabled={disabled}
        readOnly
        placeholder={placeholder}
        className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm text-right outline-none focus:border-dc-blue-500 disabled:bg-dc-gray-50 disabled:text-dc-gray-300 read-only:bg-dc-gray-50 read-only:text-dc-gray-400"
      />
    );
  }

  return (
    <input
      ref={inputRef}
      value={displayValue}
      disabled={disabled}
      inputMode={fractionDigits > 0 ? 'decimal' : 'numeric'}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        pendingCaretRef.current = null;
        onChange(normalizeDutchNumberInput(displayValue, fractionDigits));
      }}
      onChange={(e) => {
        const nextInputValue = e.target.value;
        const selectionStart = e.target.selectionStart ?? nextInputValue.length;
        const editableCount = countEditableCharacters(nextInputValue.slice(0, selectionStart));
        const nextRaw = sanitizeRawInput(nextInputValue);
        const nextDisplay = formatFixedDutchDisplay(nextRaw, fractionDigits);

        pendingCaretRef.current = resolveCaretPosition(nextDisplay, editableCount);
        setRawValue(nextRaw);
        onChange(nextDisplay);
      }}
      placeholder={placeholder}
      className="w-full rounded-lg border border-dc-gray-200 bg-white px-3 py-2 text-sm text-right text-dc-gray-500 outline-none focus:border-dc-blue-500 disabled:bg-dc-gray-50 disabled:text-dc-gray-300"
    />
  );
}
