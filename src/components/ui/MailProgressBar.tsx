type MailProgressBarProps = {
  active: boolean;
  label?: string;
  current?: number;
  total?: number;
  className?: string;
};

export default function MailProgressBar({
  active,
  label = 'Mail wordt verzonden, even geduld...',
  current,
  total,
  className = '',
}: MailProgressBarProps) {
  const hasProgress = typeof current === 'number' && typeof total === 'number' && total > 0;
  const safeCurrent = hasProgress ? Math.max(0, Math.min(total, current)) : 0;
  const percentage = hasProgress ? Math.round((safeCurrent / total) * 100) : 0;
  const progressLabel = hasProgress ? `${safeCurrent} van ${total} (${percentage}%)` : '';
  const showActiveWaitingState = active && hasProgress && safeCurrent === 0;

  if (!active) {
    return (
      <div className={`text-sm text-dc-gray-400 bg-dc-gray-50 border border-dc-gray-200 rounded-lg px-3 py-2 ${className}`}>
        <div className="mb-2">Mail voortgang</div>
        <div className="mb-2 h-[1.25rem] text-xs text-dc-gray-400">&nbsp;</div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-dc-gray-200">
          <div className="h-full w-0 rounded-full bg-blue-500 transition-[width] duration-200 ease-out" />
        </div>
      </div>
    );
  }

  return (
    <div className={`text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 ${className}`}>
      <div className="mb-2">{label}</div>
      <div className="mb-2 h-[1.25rem] text-xs text-blue-700">
        {showActiveWaitingState ? `${progressLabel} - bezig met verzenden...` : progressLabel || '\u00A0'}
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-blue-100">
        {showActiveWaitingState ? (
          <div className="relative h-full w-full overflow-hidden rounded-full">
            <div className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-blue-500/80 animate-pulse" />
          </div>
        ) : hasProgress ? (
          <div
            className="h-full rounded-full bg-blue-500 transition-[width] duration-200 ease-out"
            style={{ width: `${percentage}%` }}
          />
        ) : (
          <div className="h-full w-1/2 rounded-full bg-blue-500 animate-pulse" />
        )}
      </div>
    </div>
  );
}
