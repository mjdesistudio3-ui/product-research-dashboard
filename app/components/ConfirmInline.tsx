'use client';

/**
 * Inline destructive-action confirm ("Delete? Yes / No") — no modals in V1.
 * The parent toggles between the trigger button and this component.
 */
export default function ConfirmInline({
  onConfirm,
  onCancel,
  what = 'Delete?',
  confirmLabel = 'Yes',
}: {
  onConfirm: () => void;
  onCancel: () => void;
  what?: string;
  confirmLabel?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className="font-medium text-slate-600">{what}</span>
      <button
        type="button"
        onClick={onConfirm}
        className="rounded bg-red-600 px-2 py-0.5 font-semibold text-white hover:bg-red-700"
      >
        {confirmLabel}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="rounded bg-slate-200 px-2 py-0.5 font-medium text-slate-700 hover:bg-slate-300"
      >
        No
      </button>
    </span>
  );
}
