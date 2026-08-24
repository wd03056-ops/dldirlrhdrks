type DeleteConfirmModalProps = {
  isOpen: boolean
  title?: string
  heading?: string
  description?: string
  onClose: () => void
  onConfirm: () => void
}

export default function DeleteConfirmModal({
  isOpen,
  title,
  heading = '일정 삭제',
  description,
  onClose,
  onConfirm,
}: DeleteConfirmModalProps) {
  if (!isOpen) return null

  const message =
    description ??
    (title
      ? `‘${title}’ 일정을 삭제할까요?\n삭제하면 되돌릴 수 없어요.`
      : '삭제할까요? 삭제하면 되돌릴 수 없어요.')

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-sm space-y-5 rounded-3xl bg-white p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div>
          <h2 className="text-lg font-bold text-black">{heading}</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-neutral-500">
            {message}
          </p>
        </div>

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-neutral-300 bg-neutral-50 py-3.5 text-sm font-medium text-neutral-600"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-black py-3.5 text-sm font-medium text-white"
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  )
}
