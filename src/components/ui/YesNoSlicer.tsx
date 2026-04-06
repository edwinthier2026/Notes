type YesNoSlicerProps = {
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  trueLabel?: string;
  falseLabel?: string;
  className?: string;
};

export default function YesNoSlicer({
  value,
  onChange,
  disabled = false,
  trueLabel = 'Ja',
  falseLabel = 'Nee',
  className = '',
}: YesNoSlicerProps) {
  return (
    <div className={`flex gap-1 bg-white border border-dc-gray-200 rounded-lg p-1 ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(true)}
        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
          value ? 'bg-dc-blue-500 text-white' : 'text-dc-gray-400 hover:text-dc-gray-500 hover:bg-dc-gray-50'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        {trueLabel}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(false)}
        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
          !value ? 'bg-dc-blue-500 text-white' : 'text-dc-gray-400 hover:text-dc-gray-500 hover:bg-dc-gray-50'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        {falseLabel}
      </button>
    </div>
  );
}
