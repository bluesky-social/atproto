import { Form } from '@base-ui/react/form'
import { Trans } from '@lingui/react/macro'
import { Loader2Icon } from 'lucide-react'
import type {
  ComponentProps,
  ComponentPropsWithRef,
  MouseEventHandler,
  ReactNode,
} from 'react'
import { ErrorNotice } from '#/components/feedback/error-notice.tsx'
import {
  AsyncButton,
  type AsyncButtonProps,
} from '#/components/forms/async-button.tsx'
import { Button } from '#/components/ui/button.tsx'
import { useAsyncAction } from '#/hooks/use-async-action.ts'
import { composeEventHandlers } from '#/lib/compose-event-handlers'
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

export type ActionButtonProps = ComponentProps<typeof Button> & {
  /**
   * Runs the action on click, disabling the button and showing a spinner while
   * it is in flight — see `AsyncButton`.
   */
  action?: AsyncButtonProps['action']
}

/**
 * A button sized for an action row — a touch taller than the stock button so
 * the primary action is an easy tap on a phone. Shared with the sign-in picker
 * so every screen's actions read as one set.
 */
export function ActionButton({
  action,
  className,
  ...props
}: ActionButtonProps) {
  const classes = cn('text-action h-10', className)

  return action ? (
    <AsyncButton {...props} action={action} className={classes} />
  ) : (
    <Button {...props} className={classes} />
  )
}

type SubmitVariant = 'default' | 'destructive' | 'secondary'

export type FormShellValues<TValues extends Record<string, unknown>> = (
  values: Partial<TValues>,
) => void
export type FormShellHandler<TValues extends Record<string, unknown>> = (
  values: TValues,
  signal: AbortSignal,
) => void | PromiseLike<void>

export type FormValues = Record<string, FormDataEntryValue>

export interface FormShellProps<
  TValues extends Record<string, unknown> = FormValues,
> extends ComponentPropsWithRef<'form'> {
  /** Receives the form's values, and a signal that aborts on unmount/supersede. */
  handler: FormShellHandler<TValues>

  /**
   * Called on every edit with the form's current values, for callers that must
   * survive unmounting — the sign-up wizard restores un-submitted input from it.
   */
  onValues?: FormShellValues<TValues>

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
  renderError?: null | false | ((error: unknown) => ReactNode)
  onLoadingChange?: (loading: boolean) => void
}

/**
 * The frame every form shares: the action row, and the root error.
 *
 * Validation is the browser's own — fields declare native constraints, and an
 * invalid submit is blocked with the browser's bubble, in the browser's
 * locale. Submission runs through `useAsyncAction`, which aborts superseded or
 * unmounted requests and retains the last error until a later submit succeeds.
 */
export function FormShell<TValues extends FormValues>({
  handler,
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
  onLoadingChange,
  renderError = (error) => <ErrorNotice key="error" error={error} />,

  // Form.Props
  children,
  className,
  onSubmit,
  onReset,

  ...props
}: FormShellProps<TValues>) {
  const action = useAsyncAction<[TValues]>(
    (signal, values) => handler(values, signal),
    { onLoadingChange },
  )

  const busy = action.loading || loadingProp
  const disabled = Boolean(disabledProp || busy)

  return (
    <Form
      {...props}
      // Allows using the ref to call "form.reset()" which will reset the error
      // state of the form (instead of the native behavior that consists of
      // resetting all the default values).
      onReset={composeEventHandlers(onReset, (event) => {
        event.preventDefault()
        action.reset()
      })}
      inert={disabled}
      // @TODO `Form` defaults to noValidate, which leaves any control outside a
      // `Field.Root` (the handle field, the remember checkbox) with no
      // validation at all. Re-enabling the browser's own gate means every
      // constraint blocks submission with a native, browser-locale bubble. We
      // should consider properly using the validation API provided Base UI
      // instead.
      noValidate={false}
      className={cn('flex flex-col gap-4', className)}
      // @TODO Base UI provides a "onFormSubmit" handler that gets values from
      // all controls registered through `Field.Root`. Some fields (the remember
      // checkbox, a hidden input, a composite field's controls) never appears
      // in them as they are not registered through `Field.Root`. We should
      // refactor all the fields to be registered through `Field.Root` so that
      // the onFormSubmit handler receives a complete set of values.
      // onFormSubmit={run}
      onSubmit={composeEventHandlers(onSubmit, (event) => {
        event.preventDefault()
        if (submittable) {
          void action.run(getFormValues(event.currentTarget) as TValues)
        }
      })}
      // @NOTE `onInput`, not `onChange`: the native change event on a text
      // input waits for blur, so a keystroke-by-keystroke mirror has to read
      // the element on input. The values live on the element — there is no
      // store to subscribe to.
      onInput={(event) => {
        onValues?.(getFormValues(event.currentTarget) as Partial<TValues>)
      }}
    >
      <div key="children" className="space-y-4">
        {children}
      </div>

      {action.error != null && renderError && renderError(action.error)}

      <div key="actions" className={actionRow}>
        {submitLabel && (
          <ActionButton
            type="submit"
            variant={submitVariant}
            disabled={disabled || !submittable}
          >
            {busy && <Loader2Icon className="animate-spin" aria-hidden />}
            {submitLabel}
          </ActionButton>
        )}
        {actions}
        {onCancel && cancelLabel ? (
          <ActionButton type="button" variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </ActionButton>
        ) : null}
        {onBack && backLabel ? (
          <ActionButton type="button" variant="secondary" onClick={onBack}>
            {backLabel}
          </ActionButton>
        ) : null}
      </div>
    </Form>
  )
}

function getFormValues(form: HTMLFormElement): FormValues {
  const formData = new FormData(form)
  return Object.fromEntries(formData)
}
