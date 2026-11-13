import type { ReactElement, ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#/components/ui/dialog.tsx'
import { cn } from '#/lib/utils.ts'

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

        {children}
      </DialogContent>
    </Dialog>
  )
}
