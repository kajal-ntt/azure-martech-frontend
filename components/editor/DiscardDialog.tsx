"use client";

export interface DiscardDialogProps {
  readonly isOpen: boolean;
  readonly onDiscard: () => void;
  readonly onKeepEditing: () => void;
}

export default function DiscardDialog({
  isOpen,
  onDiscard,
  onKeepEditing,
}: DiscardDialogProps) {
  if (!isOpen) return null;

  return (
    <dialog
      open
      className="fixed inset-0 z-50 m-0 flex h-screen max-h-none w-screen max-w-none items-center justify-center border-0 bg-black/50 p-0"
      aria-label="Discard changes"
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-5">
        <h2 className="text-base font-semibold text-zinc-900">Discard Changes?</h2>
        <p className="text-sm text-zinc-500">
          You have unsaved changes. Are you sure you want to discard them? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onKeepEditing}
            className="px-4 py-2 rounded-lg border border-zinc-200 text-sm font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors"
          >
            Keep Editing
          </button>
          <button
            onClick={onDiscard}
            className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors shadow-sm shadow-red-600/30"
          >
            Discard Changes
          </button>
        </div>
      </div>
    </dialog>
  );
}
