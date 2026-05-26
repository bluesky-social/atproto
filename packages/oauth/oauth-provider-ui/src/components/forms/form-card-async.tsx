import { Trans } from '@lingui/react/macro'
import { FormEvent, ReactNode, useCallback } from 'react'
import { errorCardRender } from '#/components/utils/error-card.tsx'
import {
  UseAsyncActionOptions,
  useAsyncAction,
} from '#/hooks/use-async-action.ts'
import { Override } from '#/lib/util.ts'
import { Button } from './button.tsx'
import { FormCard, FormCardProps } from './form-card.tsx'

export type { AsyncActionController } from '#/hooks/use-async-action.ts'

export type FormCardAsyncProps = Override<
  Override<
    Omit<FormCardProps, 'cancel'>,
    Pick<UseAsyncActionOptions, 'ref' | 'onLoading' | 'onError'>
  >,
  {
    invalid?: boolean
    disabled?: boolean
    append?: ReactNode

    onSubmit: (signal: AbortSignal) => void | PromiseLike<void>
    submitLabel?: ReactNode

    onCancel?: () => void
    cancelLabel?: ReactNode

    errorRender?: (props: { error: Error }) => ReactNode
  }
>

export function FormCardAsync({
  invalid,
  disabled,

  onSubmit,
  submitLabel = <Trans>Submit</Trans>,

  onCancel = undefined,
  cancelLabel = <Trans>Cancel</Trans>,

  errorRender = errorCardRender,

  // UseAsyncActionOptions
  ref,
  onLoading,
  onError,

  // FormCardProps
  children,
  actions,
  append,
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
      append={[append, error != null ? errorRender({ error }) : undefined]}
      cancel={onCancel && <Button onClick={onCancel}>{cancelLabel}</Button>}
      actions={
        <>
          <Button
            color="primary"
            type="submit"
            loading={loading}
            disabled={disabled}
          >
            {submitLabel}
          </Button>
          {actions}
        </>
      }
    >
      {children}
    </FormCard>
  )
}
