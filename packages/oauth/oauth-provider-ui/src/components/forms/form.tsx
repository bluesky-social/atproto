import {
  type ComponentProps,
  type ReactElement,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useId,
} from 'react'
import {
  Controller,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
  FormProvider,
  type UseFormReturn,
  useFormContext,
  useFormState,
} from 'react-hook-form'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '#/components/ui/field.tsx'

/** The `<form>` element, inside react-hook-form's context. */
function Form<TValues extends FieldValues>({
  form,
  ...props
}: ComponentProps<'form'> & { form: UseFormReturn<TValues> }) {
  return (
    <FormProvider {...form}>
      <form {...props} />
    </FormProvider>
  )
}

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = { name: TName }

const FormFieldContext = createContext<FormFieldContextValue>(
  {} as FormFieldContextValue,
)

function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({ ...props }: ControllerProps<TFieldValues, TName>) {
  return (
    <FormFieldContext value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext>
  )
}

type FormItemContextValue = { id: string }

const FormItemContext = createContext<FormItemContextValue>(
  {} as FormItemContextValue,
)

function useFormField() {
  const fieldContext = useContext(FormFieldContext)
  const itemContext = useContext(FormItemContext)
  const { getFieldState } = useFormContext()
  const formState = useFormState({ name: fieldContext.name })
  const fieldState = getFieldState(fieldContext.name, formState)

  if (!fieldContext) {
    throw new Error('useFormField should be used within <FormField>')
  }

  const { id } = itemContext

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  }
}

function FormItem({ className, ...props }: ComponentProps<'div'>) {
  const id = useId()

  return (
    <FormItemContext value={{ id }}>
      <Field data-slot="form-item" className={className} {...props} />
    </FormItemContext>
  )
}

function FormLabel({ className, ...props }: ComponentProps<typeof FieldLabel>) {
  const { error, formItemId } = useFormField()

  return (
    <FieldLabel
      data-slot="form-label"
      data-error={!!error}
      className={className}
      htmlFor={formItemId}
      {...props}
    />
  )
}

/**
 * Wires the accessibility attributes onto whatever control it wraps.
 *
 * @NOTE Uses `cloneElement` rather than a Slot primitive. Base UI's equivalent
 * is `useRender`, which expects to own the rendered element, whereas here the
 * child is already a fully-formed input.
 */
function FormControl({ children }: { children: ReactElement }) {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField()

  if (!isValidElement(children)) return children

  return cloneElement(children as ReactElement<Record<string, unknown>>, {
    id: formItemId,
    'aria-describedby': error
      ? `${formDescriptionId} ${formMessageId}`
      : `${formDescriptionId}`,
    'aria-invalid': !!error,
  })
}

function FormDescription({ className, ...props }: ComponentProps<'p'>) {
  const { formDescriptionId } = useFormField()

  return (
    <FieldDescription
      data-slot="form-description"
      id={formDescriptionId}
      className={className}
      {...props}
    />
  )
}

function FormMessage({ className, ...props }: ComponentProps<'div'>) {
  const { error, formMessageId } = useFormField()
  const body = error ? String(error?.message ?? '') : props.children

  if (!body) return null

  return (
    <FieldError
      data-slot="form-message"
      id={formMessageId}
      className={className}
      {...props}
    >
      {body}
    </FieldError>
  )
}

export {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useFormField,
}
