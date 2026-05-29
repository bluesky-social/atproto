import { Trans } from '@lingui/react/macro'
import { FormEvent, ReactNode, useCallback } from 'react'
import { errorCardRender } from '#/components/utils/error-card.tsx'
import { useAsyncAction } from '#/hooks/use-async-action.ts'
import { apiErrorParser } from '#/lib/api-error-parser.ts'
import { ErrorParser } from '#/lib/error-parser.ts'
import { Override } from '#/lib/util.ts'
import { Button } from './button.tsx'
import { FormCard, FormCardProps } from './form-card.tsx'

export type ErrorRenderer = (props: {
  error: unknown
  parser: ErrorParser
}) => ReactNode

export type { ErrorParser }
export { errorCardRender }

export type FormCardAsyncProps = Override<
  Omit<FormCardProps, 'cancel'>,
  {
    invalid?: boolean
    disabled?: boolean
    append?: ReactNode
    onLoading?: (loading: boolean) => void

    onSubmit: () => void | PromiseLike<void>
    submitLabel?: ReactNode

    onCancel?: () => void
    cancelLabel?: ReactNode

    hideError?: boolean
    errorParser?: ErrorParser
    errorRender?: ErrorRenderer
  }
>

export function FormCardAsync({
  invalid,
  disabled,
  onLoading,

  onSubmit,
  submitLabel = <Trans>Submit</Trans>,

  onCancel = undefined,
  cancelLabel = <Trans>Cancel</Trans>,

  // @TODO decouple this component from "api" by injecting this as a prop where relevant.
  hideError = false,
  errorParser = apiErrorParser,
  errorRender = errorCardRender,

  // FormCardProps
  children,
  actions,
  append,
  onReset,
  ...props
}: FormCardAsyncProps) {
  // @NOTE not using useMutation because we might not have a client context
  const { run, loading, error, reset } = useAsyncAction(onSubmit, {
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
      onReset={(event) => {
        onReset?.(event)

        // By default, form.reset() will clear all its inputs. This component
        // overrides this behavior by resetting the async state instead.
        if (!event.defaultPrevented) {
          event.preventDefault()
          reset()
        }
      }}
      disabled={disabled || loading}
      append={
        <>
          {append}
          {error != null && !hideError
            ? errorRender({ error, parser: errorParser })
            : null}
        </>
      }
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
