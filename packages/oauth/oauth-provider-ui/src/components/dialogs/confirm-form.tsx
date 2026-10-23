import {
  FormShell,
  type FormShellProps,
} from '#/components/forms/form-shell.tsx'
import type { Override } from '#/lib/util'
type EmptyValues = Record<string, never>

export type ConfirmFormProps = Override<
  FormShellProps<EmptyValues>,
  {
    handler: (signal: AbortSignal) => void | PromiseLike<void>
  }
>

/**
 * A form with no fields — just explanatory content and the submit/cancel row.
 *
 * Gives the confirm-only dialogs (deactivate, reactivate, revoke session)
 * `FormShell`'s action row and pending/error handling.
 */
export function ConfirmForm({ handler, ...props }: ConfirmFormProps) {
  return (
    <FormShell<EmptyValues>
      {...props}
      handler={(_values, signal) => handler(signal)}
    />
  )
}
