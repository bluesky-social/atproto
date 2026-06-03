import { JSX, ReactNode, useMemo } from 'react'
import { useRandomString } from '#/hooks/use-random-string.ts'
import { Override } from '#/lib/util.ts'
import { FieldsetContext, FieldsetContextValue } from './fieldset-context.js'
import { useFormContext } from './form-context.js'

export type FormFieldProps = Override<
  Omit<JSX.IntrinsicElements['fieldset'], 'aria-labelledby'>,
  {
    label?: ReactNode
  }
>

export function FormField({
  label,
  children,
  disabled: disabledProp = false,
  ...props
}: FormFieldProps) {
  const labelId = useRandomString({ prefix: 'form-field-' })
  const formContext = useFormContext()

  const disabled = formContext.disabled || disabledProp

  const contextValue = useMemo<FieldsetContextValue>(
    () => ({
      disabled,
      labelId: label ? labelId : undefined,
    }),
    [disabled, label, labelId],
  )

  return (
    <fieldset {...props} aria-labelledby={labelId} disabled={disabled}>
      {label && (
        <legend
          id={labelId}
          key="title"
          className="text-text-light mb-1 text-sm font-medium"
        >
          {label}
        </legend>
      )}

      <div className="flex flex-col space-y-4">
        <FieldsetContext value={contextValue}>{children}</FieldsetContext>
      </div>
    </fieldset>
  )
}
