import { type ReactElement, type ReactNode, createContext, use } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#/components/ui/dialog.tsx'
import { cn } from '#/lib/utils.ts'

/**
 * Layout for a dialog's row of actions, following the shadcn registry's
 * `DialogFooter`: stacked where a row would crowd, a right-aligned row from
 * `sm` up. Buttons in it want `w-full sm:w-auto`.
 *
 * Exported rather than applied by `DialogShell` because the child form owns
 * the row. It expects the row's own order — primary first, as `FormShell`
 * emits — and suppresses that row's spreading spacer, since the registry
 * groups the buttons together instead.
 */
export const dialogActions = [
  'flex flex-col items-stretch gap-2',
  'sm:flex-row-reverse sm:items-center sm:justify-start',
  '[&_[data-slot=form-actions-spacer]]:hidden',
].join(' ')

const InDialogContext = createContext(false)
InDialogContext.displayName = 'InDialogContext'

/**
 * Whether the caller is rendering inside a dialog. `FormShell` reads it to
 * pick `dialogActions` over its own row, since several forms — the handle and
 * email ones especially — render both in a dialog and on an auth page, and
 * only the dialog wants the grouped layout.
 */
export const useInDialog = () => use(InDialogContext)

export type DialogShellProps = {
  /** The element that opens the dialog. */
  trigger: ReactElement
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
  /**
   * When false, the dialog refuses to close — used to stop the user dismissing
   * it while a submit is in flight.
   */
  dismissable?: boolean
}

/**
 * Common frame for the account-manager dialogs.
 *
 * @NOTE No footer of its own — the child form supplies the action row, so its
 * buttons stay wired to the form's own pending and error state.
 */
export function DialogShell({
  trigger,
  title,
  description,
  children,
  open,
  onOpenChange,
  className,
  dismissable = true,
}: DialogShellProps) {
  return (
    <Dialog
      open={open}
      // @NOTE `Dialog.Root` has no `dismissible` prop, so non-dismissable is
      // expressed by rejecting close transitions. Opening is always allowed;
      // only closing is gated.
      onOpenChange={(next) => {
        if (next || dismissable) onOpenChange?.(next)
      }}
    >
      <DialogTrigger render={trigger} />
      {/* @NOTE The height cap is required, not cosmetic: `DialogContent` is
        `fixed` with no cap of its own, and a fixed element cannot be scrolled
        into view — so a tall dialog on a short viewport puts its buttons out of
        reach.

        `*:min-w-0`: `DialogContent` is a grid, and a grid item's default
        `min-width: auto` sizes the track to its widest unbreakable run —
        wider than the popup — instead of letting the content truncate. */}
      <DialogContent
        role="dialog"
        className={cn(
          'max-h-[85vh] overflow-y-auto *:min-w-0 sm:max-w-md',
          className,
        )}
        showCloseButton={dismissable}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            // @NOTE No <p> wrapper here, unlike CardDescription and
            // AlertDescription: `Dialog.Description` already renders one, and
            // wrapping it nests <p> inside <p>.
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>

        <InDialogContext value={true}>{children}</InDialogContext>
      </DialogContent>
    </Dialog>
  )
}
