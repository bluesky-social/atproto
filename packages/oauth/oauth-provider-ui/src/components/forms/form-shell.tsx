import { Trans } from '@lingui/react/macro'
import { Loader2Icon } from 'lucide-react'
import type { JSX, MouseEventHandler, ReactNode } from 'react'
import type { FieldValues, UseFormReturn } from 'react-hook-form'
import { ErrorNotice } from '#/components/feedback/error-notice.tsx'
import { Form } from '#/components/forms/form.tsx'
import { Button } from '#/components/ui/button.tsx'
import { useAsyncAction } from '#/hooks/use-async-action.ts'
import { apiErrorParser } from '#/lib/api-error-parser.ts'
import type { Override } from '#/lib/util.ts'
import { cn } from '#/lib/utils.ts'

type SubmitVariant = 'default' | 'destructive' | 'secondary'

export type FormShellProps<TValues extends FieldValues> = Override<
  Omit<JSX.IntrinsicElements['form'], 'onSubmit'>,
  {
    /** The `useForm(...)` return value. Field components read it via context. */
    form: UseFormReturn<TValues>

    /**
     * Async submit handler. Receives the validated values and an `AbortSignal`
     * that fires if the form unmounts or a newer submit supersedes this one.
     */
    onSubmit: (values: TValues, signal: AbortSignal) => void | PromiseLike<void>

    submitLabel?: ReactNode
    submitVariant?: SubmitVariant
    /** When false the submit button is disabled. */
    submittable?: boolean

    onCancel?: MouseEventHandler<HTMLButtonElement>
    cancelLabel?: ReactNode

    onBack?: () => void
    backLabel?: ReactNode

    /** Extra controls rendered alongside the submit button. */
    actions?: ReactNode

    /** Pending state from outside the form (e.g. an in-flight resend). */
    loading?: boolean
    disabled?: boolean
    hideError?: boolean

    /** Mirrors the in-flight state to a parent (e.g. to block dialog dismissal). */
    onLoadingChange?: (loading: boolean) => void
  }
>

/**
 * The frame every form shares: the action row, and the root error.
 *
 * Field state and validation come from react-hook-form; submission runs through
 * `useAsyncAction`, which aborts superseded or unmounted requests and retains
 * the last error until a later submit succeeds. Errors render via `ErrorNotice`
 * and `apiErrorParser`, so typed OAuth payloads keep their user-facing message.
 */
export function FormShell<TValues extends FieldValues>({
  form,
  onSubmit,

  submitLabel = <Trans>Submit</Trans>,
  submitVariant = 'default',
  submittable = true,

  onCancel,
  cancelLabel = <Trans>Cancel</Trans>,

  onBack,
  backLabel = <Trans>Back</Trans>,

  actions,
  loading: loadingProp = false,
  disabled: disabledProp = false,
  hideError = false,
  onLoadingChange,

  // form
  inert,
  children,
  className,
  ...props
}: FormShellProps<TValues>) {
  const { run, loading, error } = useAsyncAction<[TValues]>(
    (signal, values) => onSubmit(values, signal),
    { onLoadingChange },
  )

  const busy = loading || loadingProp
  const disabled = Boolean(inert || disabledProp || busy)

  return (
    <Form
      {...props}
      form={form}
      action={undefined}
      inert={disabled}
      className={cn('flex flex-col gap-4', className)}
      onSubmit={form.handleSubmit((values) => run(values))}
    >
      <div key="children" className="space-y-4">
        {children}
      </div>

      {error && !hideError && (
        <ErrorNotice key="error" error={error} parser={apiErrorParser} />
      )}

      <div
        key="actions"
        className="flex flex-row-reverse flex-wrap items-center justify-start gap-2"
      >
        {submitLabel && (
          <Button
            type="submit"
            variant={submitVariant}
            disabled={disabled || !submittable}
          >
            {busy && <Loader2Icon className="animate-spin" aria-hidden />}
            {submitLabel}
          </Button>
        )}
        {actions}
        <div className="flex-auto" />
        {onCancel && cancelLabel ? (
          <Button type="button" variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
        ) : null}
        {onBack && backLabel ? (
          <Button type="button" variant="secondary" onClick={onBack}>
            {backLabel}
          </Button>
        ) : null}
      </div>
    </Form>
  )
}
