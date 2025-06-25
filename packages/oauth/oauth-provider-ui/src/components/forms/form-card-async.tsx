import { Trans } from '@lingui/react/macro'
import { FormEvent, ReactNode, useCallback } from 'react'
import {
  UseAsyncActionOptions,
  useAsyncAction,
} from '../../hooks/use-async-action.ts'
import { Override } from '../../lib/util.ts'
import { ErrorCard } from '../utils/error-card.tsx'
import { Button } from './button.tsx'
import { FormCard, FormCardProps } from './form-card.tsx'

export type { AsyncActionController } from '../../hooks/use-async-action.ts'

export type ErrorRender = (data: { error: Error }) => ReactNode
export const errorRenderDefault: ErrorRender = ({ error }) => (
  <ErrorCard error={error} />
)

export type FormCardAsyncProps = Override<
  Override<
    Omit<FormCardProps, 'cancel' | 'actions' | 'prepend'>,
    Pick<UseAsyncActionOptions, 'ref' | 'onLoading' | 'onError'>
  >,
  {
    invalid?: boolean
    disabled?: boolean

    onSubmit: (signal: AbortSignal) => void | PromiseLike<void>
    submitLabel?: ReactNode

    onCancel?: () => void
    cancelLabel?: ReactNode

    errorRender?: ErrorRender
  }
>

export function FormCardAsync({
  invalid,
  disabled,

  onSubmit,
  submitLabel,

  onCancel = undefined,
  cancelLabel,

  errorRender = errorRenderDefault,

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

  const doSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      if (!event.currentTarget.reportValidity()) return

      if (!disabled && !invalid) void run()
    },
    [disabled, invalid, run],
  )

  return (
    <FormCard
      {...props}
      onSubmit={doSubmit}
      disabled={disabled || loading}
      prepend={error != null ? errorRender({ error }) : undefined}
      cancel={
        onCancel && (
          <Button onClick={onCancel}>
            {cancelLabel || <Trans>Cancel</Trans>}
          </Button>
        )
      }
      actions={
        <Button
          color="primary"
          type="submit"
          loading={loading}
          disabled={disabled}
        >
          {submitLabel || <Trans>Submit</Trans>}
        </Button>
      }
    >
      {children}
    </FormCard>
  )
}
