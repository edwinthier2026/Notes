interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  cancelLabel?: string;
  confirmLabel?: string;
  confirming?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  cancelLabel = 'Annuleren',
  confirmLabel = 'Oke',
  confirming = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-xl border border-dc-gray-100 p-6">
        <h2 className="text-lg font-semibold text-dc-gray-500 mb-2">{title}</h2>
        <p className="text-sm text-dc-gray-400">{message}</p>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-medium transition-colors dc-cancel-green-btn">
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={confirming}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors dc-confirm-red-btn disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {confirming ? 'Bezig...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
