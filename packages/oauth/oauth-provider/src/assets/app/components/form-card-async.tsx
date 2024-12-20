import { FormEventHandler, ReactNode, useEffect } from 'react'
import { useAsyncAction } from '../hooks/use-async-action'
import { Override } from '../lib/util'
import { Button } from './button'
import { FormCard, FormCardProps } from './form-card'

export type FormCardAsyncProps = Override<
  Omit<FormCardProps, 'cancel' | 'actions' | 'error'>,
  {
    onSubmit: FormEventHandler<HTMLFormElement>
    submitLabel?: ReactNode
    submitAria?: string

    onCancel?: () => void
    cancelLabel?: ReactNode
    cancelAria?: string

    onLoading?: (loading: boolean) => void
    onError?: (error: Error | undefined) => void

    errorMessageFallback?: ReactNode
    errorSlot?: (error: Error) => null | undefined | ReactNode
  }
>

export default function FormCardAsync({
  onSubmit,
  submitAria = 'Submit',
  submitLabel = submitAria,

  onCancel = undefined,
  cancelAria = 'Cancel',
  cancelLabel = cancelAria,

  errorMessageFallback = 'An unknown error occurred',
  errorSlot,
  onLoading,
  onError,

  children,

  ...props
}: FormCardAsyncProps) {
  const { run, loading, error } = useAsyncAction(onSubmit)

  useEffect(() => {
    onLoading?.(loading)
  }, [onLoading, loading])

  useEffect(() => {
    onError?.(error)
  }, [onError, error])

  return (
    <FormCard
      {...props}
      onSubmit={run}
      error={error ? errorSlot?.(error) || errorMessageFallback : undefined}
      cancel={
        onCancel && (
          <Button aria-label={cancelAria} onClick={onCancel}>
            {cancelLabel}
          </Button>
        )
      }
      actions={
        <Button
          color="brand"
          type="submit"
          aria-label={submitAria}
          loading={loading}
        >
          {submitLabel}
        </Button>
      }
    >
      {children}
    </FormCard>
  )
}
