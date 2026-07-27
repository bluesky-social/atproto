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
 * @NOTE Several dialogs (deactivate, reactivate, revoke session) previously
 * used `SmartForm` with `validate={() => ({})}` purely to get its action row
 * and pending/error handling. This keeps that shape without each of them
 * needing its own `useForm` boilerplate.
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
