import { Trans } from '@lingui/react/macro'
import { clsx } from 'clsx'
import { FormEvent, JSX, MouseEventHandler, ReactNode, useMemo } from 'react'
import { errorCardRender } from '#/components/utils/error-card.tsx'
import { apiErrorParser } from '#/lib/api-error-parser.ts'
import { ErrorParser } from '#/lib/error-parser.ts'
import { Override } from '#/lib/util.ts'
import { Button, ButtonColor } from './button.tsx'
import { FormContext, FormContextValue } from './form-context.tsx'

export type ErrorRenderer = (props: {
  error: unknown
  parser: ErrorParser
}) => ReactNode

export { errorCardRender }
export type { ErrorParser }

export type FormCardProps = Override<
  JSX.IntrinsicElements['form'],
  {
    disabled?: boolean
    loading?: boolean
    actions?: ReactNode

    onSubmit?: (event: FormEvent<HTMLFormElement>) => void
    submitLabel?: ReactNode
    submitColor?: ButtonColor
    submittable?: boolean

    onCancel?: MouseEventHandler<HTMLButtonElement>
    cancelLabel?: ReactNode

    onBack?: () => void
    backLabel?: ReactNode

    error?: Error
    hideError?: boolean
    errorParser?: ErrorParser
    errorRender?: ErrorRenderer
  }
>

export function FormCard({
  disabled: disabledProp = false,
  loading = false,
  actions,

  submitLabel = <Trans>Submit</Trans>,
  submitColor = 'primary',
  submittable = true,

  onCancel = undefined,
  cancelLabel = <Trans>Cancel</Trans>,

  onBack,
  backLabel = <Trans>Back</Trans>,

  error,
  hideError = false,
  // @TODO decouple this component from "api" by injecting this as a prop where relevant.
  errorParser = apiErrorParser,
  errorRender = errorCardRender,

  // form
  inert,
  children,
  onSubmit,
  className,
  ...props
}: FormCardProps) {
  // The form is disabled when either the `disabled` or `inert` prop is true.
  const disabled = Boolean(inert || disabledProp || loading)

  const contextValue = useMemo<FormContextValue>(
    () => ({ disabled }),
    [disabled],
  )

  const errorNode =
    error != null && !hideError
      ? errorRender({ error, parser: errorParser })
      : null

  return (
    <form
      {...props}
      action={undefined}
      inert={disabled}
      className={clsx('flex flex-col gap-4', className)}
      onSubmit={(event) => {
        if (!event.defaultPrevented) {
          // Perform native HTML5 validation.
          const isValid = event.currentTarget.reportValidity()

          if (disabled || !isValid || !submittable) {
            event.preventDefault()
          } else {
            onSubmit?.(event)
          }
        }
      }}
    >
      <FormContext value={contextValue}>
        <div key="children" className="space-y-4">
          {children}
        </div>

        {errorNode && <div key="error">{errorNode}</div>}

        <div
          key="actions"
          className="flex flex-row-reverse flex-wrap items-center justify-start gap-2"
        >
          {submitLabel && (
            <Button
              type="submit"
              color={submitColor}
              loading={loading}
              disabled={disabled || !submittable}
            >
              {submitLabel}
            </Button>
          )}
          {actions}
          <div className="flex-auto" />
          {onCancel && cancelLabel ? (
            <Button onClick={onCancel}>{cancelLabel}</Button>
          ) : null}
          {onBack && backLabel ? (
            <Button onClick={onBack}>{backLabel}</Button>
          ) : null}
        </div>
      </FormContext>
    </form>
  )
}
