import { ReactNode } from 'react'
import {
  UseAsyncActionOptions,
  useAsyncAction,
} from '../../hooks/use-async-action'
import { Override } from '../../lib/util'
import { ApiError } from '../utils/api-error'
import { Button } from './button'
import { FormCard, FormCardProps } from './form-card'

export type { AsyncActionController } from '../../hooks/use-async-action'

type ErrorSlot = (error: Error) => ReactNode
const errorSlotDefault: ErrorSlot = (error) => <ApiError error={error} />

export type FormCardAsyncProps = Override<
  Override<
    Omit<FormCardProps, 'cancel' | 'actions' | 'prepend'>,
    Pick<UseAsyncActionOptions, 'ref' | 'onLoading' | 'onError'>
  >,
  {
    invalid?: boolean
    disabled?: boolean

    onSubmit: (signal: AbortSignal) => void | PromiseLike<void>
    submitLabel?: string

    onCancel?: () => void
    cancelLabel?: string

    errorSlot?: ErrorSlot
  }
>

export function FormCardAsync({
  invalid,
  disabled,

  onSubmit,
  submitLabel,

  onCancel = undefined,
  cancelLabel,

  errorSlot = errorSlotDefault,

  // UseAsyncActionOptions
  ref,
  onLoading,
  onError,

  // FormCardProps
  children,
  ...props
}: FormCardAsyncProps) {
  const { run, loading, error } = useAsyncAction(onSubmit, {
    ref,
    onError,
    onLoading,
  })

  // @TODO translate button labels

  return (
    <FormCard
      {...props}
      onSubmit={(event) => {
        event.preventDefault()

        if (!event.currentTarget.reportValidity()) return

        if (!disabled && !invalid) void run()
      }}
      disabled={disabled || loading}
      prepend={error != null ? errorSlot(error) : undefined}
      cancel={
        onCancel && (
          <Button onClick={onCancel}>{cancelLabel || 'Cancel'}</Button>
        )
      }
      actions={
        <Button
          color="brand"
          type="submit"
          loading={loading}
          disabled={disabled}
        >
          {submitLabel || 'Submit'}
        </Button>
      }
    >
      {children}
    </FormCard>
  )
}
