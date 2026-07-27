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
}: DialogShellProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent role="dialog" className={cn('sm:max-w-md', className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            // @NOTE DialogDescription is a <div> upstream; body copy goes in an
            // explicit <p> so unqualified ensureTextVisibility calls match.
            <DialogDescription>
              <p>{description}</p>
            </DialogDescription>
          )}
        </DialogHeader>

        {children}
      </DialogContent>
    </Dialog>
  )
}
