import { Form } from '@base-ui/react/form'
import { Trans } from '@lingui/react/macro'
import { Loader2Icon } from 'lucide-react'
import { type MouseEventHandler, type ReactNode, type Ref, useRef } from 'react'
import { ErrorNotice } from '#/components/feedback/error-notice.tsx'
import { Button } from '#/components/ui/button.tsx'
import { useAsyncAction } from '#/hooks/use-async-action.ts'
import { apiErrorParser } from '#/lib/api-error-parser.ts'
import { cn } from '#/lib/utils.ts'

/**
 * Layout for a row of form actions: stacked where a row would crowd, then a
 * right-aligned group from `sm` up, primary last. Buttons in a hand-rolled
 * group want `w-full sm:w-auto` to match.
 */
export const actionRow = [
  'flex flex-col items-stretch gap-2',
  'sm:flex-row-reverse sm:flex-wrap sm:items-center sm:justify-start',
].join(' ')

type SubmitVariant = 'default' | 'destructive' | 'secondary'

export type FormShellProps<TValues extends Record<string, unknown>> = {
  /** Receives the form's values, and a signal that aborts on unmount/supersede. */
  onSubmit: (values: TValues, signal: AbortSignal) => void | PromiseLike<void>

  /**
   * Called on every edit with the form's current values, for callers that must
   * survive unmounting — the sign-up wizard restores un-submitted input from it.
   */
  onValues?: (values: Partial<TValues>) => void

  submitLabel?: ReactNode
  submitVariant?: SubmitVariant
  submittable?: boolean

  onCancel?: MouseEventHandler<HTMLButtonElement>
  cancelLabel?: ReactNode

  onBack?: () => void
  backLabel?: ReactNode

  actions?: ReactNode
  loading?: boolean
  disabled?: boolean
  hideError?: boolean
  onLoadingChange?: (loading: boolean) => void

  children?: ReactNode
  className?: string
  ref?: Ref<HTMLFormElement>
}

/**
 * The frame every form shares: the action row, and the root error.
 *
 * Validation is the browser's own — fields declare native constraints, and an
 * invalid submit is blocked with the browser's bubble, in the browser's
 * locale. Submission runs through `useAsyncAction`, which aborts superseded or
 * unmounted requests and retains the last error until a later submit succeeds.
 */
export function FormShell<TValues extends Record<string, unknown>>({
  onSubmit,
  onValues,

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

  children,
  className,
  ref,
}: FormShellProps<TValues>) {
  const { run, loading, error } = useAsyncAction<[TValues]>(
    (signal, values) => onSubmit(values, signal),
    { onLoadingChange },
  )

  const busy = loading || loadingProp
  const disabled = Boolean(disabledProp || busy)

  const formRef = useRef<HTMLFormElement>(null)

  return (
    <Form
      ref={(element) => {
        formRef.current = element
        if (typeof ref === 'function') ref(element)
        else if (ref) ref.current = element
      }}
      inert={disabled}
      // @NOTE `Form` defaults to noValidate, which leaves any control outside
      // a `Field.Root` (the handle field, the remember checkbox) with no
      // validation at all. Re-enabling the browser's own gate means every
      // constraint blocks submission with a native, browser-locale bubble.
      noValidate={false}
      className={cn('flex flex-col gap-4', className)}
      // @NOTE The values Base UI passes here cover only controls registered
      // through `Field.Root` — a plain named input (the remember checkbox, a
      // hidden input, a composite field's controls) never appears in them. The
      // element itself is the complete record, so read it instead.
      onFormSubmit={() => {
        const element = formRef.current
        if (!element) return
        run(Object.fromEntries(new FormData(element)) as TValues)
      }}
      // @NOTE `onInput`, not `onChange`: the native change event on a text
      // input waits for blur, so a keystroke-by-keystroke mirror has to read
      // the element on input. The values live on the element — there is no
      // store to subscribe to.
      onInput={
        onValues &&
        ((event) => {
          const data = new FormData(event.currentTarget)
          onValues(Object.fromEntries(data) as Partial<TValues>)
        })
      }
    >
      <div key="children" className="space-y-4">
        {children}
      </div>

      {error && !hideError && (
        <ErrorNotice key="error" error={error} parser={apiErrorParser} />
      )}

      <div key="actions" className={actionRow}>
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
