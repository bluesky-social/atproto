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
 * Common frame for the account-manager dialogs, replacing `utils/dialog-simple`.
 *
 * @NOTE The content keeps `role="dialog"` and hosts the form's own action row
 * rather than rendering a footer of its own — the pds e2e suite targets
 * `[role="dialog"] button[type="submit"]`, which resolves to the FormShell
 * submit button rendered inside.
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
      {/* @NOTE `max-h` + `overflow-y-auto` are deliberate additions. Base UI's
        DialogContent is `fixed` and vertically centred with no height cap, so a
        tall dialog (the DNS instructions, the delete-account flow) overflows
        both edges of a short viewport with no way to reach its buttons — a
        fixed element cannot be scrolled into view. The previous DialogSimple
        capped it at 85vh for the same reason. */}
      <DialogContent
        role="dialog"
        className={cn('max-h-[85vh] overflow-y-auto sm:max-w-md', className)}
        showCloseButton={dismissable}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            // @NOTE No explicit <p> wrapper here, unlike CardDescription and
            // AlertDescription: Base UI's Dialog.Description already renders a
            // <p>, so wrapping produced `<p><p>` — invalid nesting that React
            // reports as a hydration error. The e2e's unqualified
            // ensureTextVisibility calls match this <p> directly.
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>

        {children}
      </DialogContent>
    </Dialog>
  )
}
