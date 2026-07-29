import type { ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import {
  FormShell,
  type FormShellProps,
} from '#/components/forms/form-shell.tsx'

type EmptyValues = Record<string, never>

export type ConfirmFormProps = Omit<
  FormShellProps<EmptyValues>,
  'form' | 'onSubmit'
> & {
  handler: (signal: AbortSignal) => void | PromiseLike<void>
  children?: ReactNode
}

/**
 * A form with no fields — just explanatory content and the submit/cancel row.
 *
 * Spares the confirm-only dialogs (deactivate, reactivate, revoke session)
 * their own `useForm` boilerplate while keeping `FormShell`'s action row and
 * pending/error handling.
 */
export function ConfirmForm({ handler, children, ...props }: ConfirmFormProps) {
  const form = useForm<EmptyValues>({ defaultValues: {} as EmptyValues })

  return (
    <FormShell
      {...props}
      form={form}
      onSubmit={(_values, signal) => handler(signal)}
    >
      {children}
    </FormShell>
  )
}
