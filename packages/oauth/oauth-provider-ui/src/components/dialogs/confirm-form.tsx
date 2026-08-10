import type { ReactNode } from 'react'
import {
  FormShell,
  type FormShellProps,
} from '#/components/forms/form-shell.tsx'
type EmptyValues = Record<string, never>

export type ConfirmFormProps = Omit<FormShellProps<EmptyValues>, 'onSubmit'> & {
  handler: (signal: AbortSignal) => void | PromiseLike<void>
  children?: ReactNode
}

/**
 * A form with no fields — just explanatory content and the submit/cancel row.
 *
 * Gives the confirm-only dialogs (deactivate, reactivate, revoke session)
 * `FormShell`'s action row and pending/error handling.
 */
export function ConfirmForm({ handler, children, ...props }: ConfirmFormProps) {
  return (
    <FormShell<EmptyValues>
      {...props}
      onSubmit={(_values, signal) => handler(signal)}
    >
      {children}
    </FormShell>
  )
}
