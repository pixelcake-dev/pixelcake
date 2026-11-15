import { useConfirmStore } from '@/store/confirmStore';
import { Button } from './Button';
import { useEscapeToClose } from './useEscapeToClose';
import { useT } from '@/i18n';

/**
 * ConfirmDialog
 * The window of a question with a yes and a no (see store/confirmStore.ts):
 * the question, what a yes brings with it, and two buttons. It lies over any
 * other window, because a question can be asked from inside one. Esc and a
 * click outside it are a no; Enter is the button that says yes, which has
 * the keyboard when the window opens.
 */
const ConfirmDialog = () => {
  const t = useT();
  const pending = useConfirmStore((state) => state.pending);
  const answer = useConfirmStore((state) => state.answer);

  useEscapeToClose(pending !== null, () => answer(false));

  if (!pending) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--bg-modal-backdrop)', zIndex: 6000 }}
      onClick={() => answer(false)}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={pending.detail ? 'confirm-dialog-detail' : undefined}
        className="base-modal confirm-dialog w-full max-w-md bg-[var(--bg-toolbar)] rounded-md shadow-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-5">
          <h3 id="confirm-dialog-title" className="text-base font-semibold tracking-tight">
            {pending.title}
          </h3>
          {pending.detail && (
            <p
              id="confirm-dialog-detail"
              className="mt-2 text-sm text-[var(--text-color-light)] whitespace-pre-line"
            >
              {pending.detail}
            </p>
          )}
        </div>
        <div className="modal-actions px-6 pb-5">
          <Button variant="secondary" onClick={() => answer(false)}>
            {t.common.actions.cancel}
          </Button>
          <Button variant={pending.danger ? 'danger' : 'primary'} autoFocus onClick={() => answer(true)}>
            {pending.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
