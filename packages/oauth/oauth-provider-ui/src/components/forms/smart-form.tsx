import { composeEventHandlers } from '@radix-ui/primitive'
import { ReactNode, Ref, useImperativeHandle, useMemo, useState } from 'react'
import { FormCard, FormCardProps } from '#/components/forms/form-card.tsx'
import { useStableCallback } from '#/hooks/use-stable-callback.ts'
import { Override } from '#/lib/util.ts'
import { useAsyncAction } from '../../hooks/use-async-action.ts'

export type SmartFormData = Record<string, unknown>

export type SetField<TValues> = <K extends keyof TValues>(
  key: K,
  value: TValues[K] | undefined,
) => void

export type SetterFor<TValues> = <K extends keyof TValues>(
  key: K,
) => (value: TValues[K] | undefined) => void

/**
 * Compute the submit payload from the current raw input values. Return
 * `undefined` to mark the form as not submittable yet (the submit button
 * becomes disabled).
 */
export type ValidateData<TValues, TData> = (
  values: Partial<TValues>,
) => TData | undefined

/**
 * Imperative handle exposed via `SmartForm`'s `ref`. Use it from a parent that
 * needs to read or mutate form state outside of a `fields` render — e.g. to
 * clear a field when an external event invalidates it.
 *
 * @example
 * ```tsx
 * const formRef = useRef<FormHandler<SignInData, SignInValues> | null>(null)
 *
 * const clearOtp = () => formRef.current?.set('otp', null)
 *
 * return <SmartForm ref={formRef} ... />
 * ```
 */
export type FormHandler<TData extends SmartFormData, TValues = TData> = {
  /**
   * Live snapshot of every field's input value.
   *
   * @example
   * ```tsx
   * <InputEmailAddress email={values.email} ... />
   * ```
   */
  values: Readonly<Partial<TValues>>

  /** Result of `validate(values)` — `undefined` while the form is not submittable. */
  data: TData | undefined

  /** Update a single field. Triggers a re-render and re-runs `validate()`. */
  set: SetField<TValues>

  /**
   * Get a stable setter for a specific field, e.g. `setterFor('email')`.
   * Useful for wiring inputs without inline lambdas.
   *
   * @example
   * ```tsx
   * <InputEmailAddress onEmail={setterFor('email')} ... />
   * ```
   */
  setterFor: SetterFor<TValues>

  /** Error thrown by the most recent `handler` invocation, if any. */
  error: Error | undefined

  /** True while a `handler` invocation is in flight. */
  loading: boolean

  /** Reset form state to the initial values. */
  reset: () => void
}

export type SmartFormProps<
  TData extends SmartFormData,
  TValues = TData,
> = Override<
  FormCardProps,
  {
    /**
     * Compute the submit payload from the current input values. Returning
     * `undefined` marks the form as not submittable (the submit button is
     * disabled until this returns a value).
     */
    validate: ValidateData<TValues, TData>

    /** Async submit handler. Fires when the form submits with a defined `validate()` result. */
    handler: (data: TData, signal: AbortSignal) => void | PromiseLike<void>

    /** Initial input values. Keys define the field set. */
    values?: Partial<TValues>

    /**
     * Listener fired after every `set()` with the new and old input values.
     * Useful for mirroring the form's pending (un-submitted) values back to a
     * parent — e.g. so a parent step can pre-fill the next step, or react to
     * an input change before the user submits.
     */
    onValues?: (
      newValues: Partial<TValues>,
      oldValues: Partial<TValues>,
    ) => void

    /**
     * Listener fired when the in-flight `handler` state flips. Useful for a
     * parent that needs to reflect the loading state — e.g. a dialog that
     * should not be dismissable while a submit is pending.
     */
    onLoadingChange?: (loading: boolean) => void

    /**
     * Imperative handle to the form's internal state. Use it from a parent
     * that needs to read or mutate fields outside of the `fields` render —
     * e.g. to clear a field when an external event invalidates it.
     */
    ref?: Ref<FormHandler<TData, TValues>>

    /**
     * Render the form's input fields. Receives the live `FormHandler` —
     * destructure `values`, `set`/`setterFor`, `loading`, `error`, or `data`
     * as needed. Called on every state update.
     */
    fields: (form: FormHandler<TData, TValues>) => ReactNode
  }
>

/**
 * `FormCard` + controlled state. Owns input values, derives the submit payload
 * via `validate`, and runs `handler` on submit. The `fields` render-prop
 * receives a `FormHandler` for wiring inputs.
 *
 * Use this directly when the wrapper component needs to do real work around
 * the form — translating its own bespoke props into `validate`/`handler`,
 * holding extra state that influences submission, or intercepting errors. The
 * wrapper's public API is then unrelated to `SmartForm`.
 *
 * @see {@link WrappedSmartFormProps} for the simpler case where the wrapper is
 *   a pure pass-through (just supplying `validate` + `fields`) and exposes the
 *   underlying `SmartForm` props to its callers.
 *
 * @example
 * ```tsx
 * type MyFormData = { email: string }
 *
 * export type MyFormProps = {
 *   email?: string
 *   onEmailChange?: (email: string) => void
 *   submit: (data: MyFormData, signal: AbortSignal) => void | PromiseLike<void>
 * }
 *
 * function MyForm({ email, onEmailChange, submit }: MyFormProps) {
 *   const formHandler = useRef<FormHandler<MyFormData> | null>(null)
 *
 *   useEffect(() => {
 *     const interval = setInterval(() => {
 *       // Example of using the form ref to clear a field after an external
 *       // event.
 *       formHandler.current?.reset()
 *     }, 30_000)
 *     return () => clearInterval(interval)
 *   }, [])
 *
 *   return (
 *     <SmartForm
 *       ref={formHandler}
 *       values={{ email: email ?? '' }}
 *       validate={({ email }) => {
 *         if (email) return { email }
 *       }}
 *       onValues={(next, prev) => {
 *         if (prev.email !== next.email) {
 *           onEmailChange?.(next.email)
 *         }
 *       }}
 *       handler={async (data, signal) => {
 *         await submit(data, signal)
 *       }}
 *       fields={({ values, set }) => (
 *         <FormField label="Email">
 *           <InputEmailAddress
 *             value={values.email}
 *             onChange={(e) => set('email', e.target.value)}
 *           />
 *         </FormField>
 *       )}
 *     />
 *   )
 * }
 * ```
 */
export function SmartForm<TData extends SmartFormData, TValues = TData>({
  fields,
  ref,
  values: initialValues = {},
  onValues,
  onLoadingChange,
  handler,
  validate,
  children,
  ...props
}: SmartFormProps<TData, TValues>) {
  const [values, setValues] = useState<Partial<TValues>>(initialValues)

  const data = useMemo(() => validate(values), [validate, values])

  const { run, loading, error, reset } = useAsyncAction(
    async (signal) => {
      if (data) return handler(data, signal)
      // The `submittable` prop below should prevent this from happening.
      else throw new Error('Form data is not valid')
    },
    { onLoadingChange },
  )

  const set = useStableCallback<SetField<TValues>>((key, value) => {
    // Skip the state update if the value didn't actually change. Only
    // sound for primitive values.
    if (values[key] !== value) {
      // Reset async error/loading state whenever the user changes any input.
      reset()

      setValues({ ...values, [key]: value })
      onValues?.({ ...values, [key]: value }, values)
    }
  })

  const setterFor = useStableCallback<SetterFor<TValues>>(
    (key) => (value) => set(key, value),
  )

  const form = useMemo(
    () => ({ values, data, set, setterFor, loading, error, reset }),
    [values, data, set, setterFor, loading, error, reset],
  )

  useImperativeHandle(ref, () => form, [form])

  return (
    <FormCard
      {...props}
      error={props.error ?? error}
      loading={props.loading || loading}
      submittable={props.submittable !== false && data != null}
      onSubmit={composeEventHandlers(props.onSubmit, (event) => {
        event.preventDefault()
        void run()
      })}
      // Override the default form reset behavior (which would set inputs back
      // to their HTML `defaultValue`) since state is managed here.
      onReset={composeEventHandlers(props.onReset, (event) => {
        event.preventDefault()
        reset()
      })}
    >
      {fields(form)}
      {children}
    </FormCard>
  )
}

/**
 * Props type for a wrapper component built on `SmartForm`. Omits the
 * internals (`fields`, `validate`) which the wrapper is expected to supply.
 *
 * @example
 * ```tsx
 * export type ResetPasswordRequestData = { email: string }
 * export type ResetPasswordRequestFormProps =
 *   WrappedSmartFormProps<ResetPasswordRequestData> & {
 *     emailDefault?: string
 *   }
 *
 * export function ResetPasswordRequestForm({
 *   emailDefault,
 *   ...props
 * }: ResetPasswordRequestFormProps) {
 *   return (
 *     <SmartForm
 *       {...props}
 *       values={{ email: emailDefault ?? '' }}
 *       validate={({ email }) => (email ? { email } : undefined)}
 *       fields={({ values, setterFor }) => (
 *         <FormField label="Email">
 *           <InputEmailAddress
 *             name="email"
 *             defaultValue={values.email}
 *             onEmail={setterFor('email')}
 *           />
 *         </FormField>
 *       )}
 *     />
 *   )
 * }
 * ```
 */
export type WrappedSmartFormProps<
  TData extends SmartFormData,
  TValues = TData,
> = Omit<SmartFormProps<TData, TValues>, 'fields' | 'validate'>
