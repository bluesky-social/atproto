import { clsx } from 'clsx'
import { JSX, ReactNode, createContext, useContext, useMemo } from 'react'
import { Override } from '#/lib/util.ts'

export type FormContextValue = {
  disabled: boolean
}

export const FormContext = createContext<FormContextValue>({
  disabled: false,
})
FormContext.displayName = 'FormContext'

export function useFormContext() {
  return useContext(FormContext)
}

export type FormCardProps = Override<
  JSX.IntrinsicElements['form'],
  {
    disabled?: boolean
    append?: ReactNode
    prepend?: ReactNode
    cancel?: ReactNode
    actions?: ReactNode
  }
>

export function FormCard({
  actions,
  cancel,
  append,
  children,
  prepend,
  disabled: disabledProp = false,

  // form
  inert = disabledProp,
  className,
  ...props
}: FormCardProps) {
  // The form is disabled when either the `disabled` or `inert` prop is true.
  const disabled = disabledProp || inert

  const contextValue = useMemo<FormContextValue>(
    () => ({ disabled }),
    [disabled],
  )

  return (
    <form
      inert={inert}
      className={clsx('flex flex-col gap-4', className)}
      {...props}
    >
      <FormContext value={contextValue}>
        {prepend && <div key="prepend">{prepend}</div>}

        <div key="children" className="space-y-4">
          {children}
        </div>

        {append && <div key="append">{append}</div>}

        {(actions || cancel) && (
          <div
            key="buttons"
            className="flex flex-row-reverse flex-wrap items-center justify-end space-x-2 space-x-reverse"
          >
            {actions}
            <div className="flex-auto" />
            {cancel}
          </div>
        )}
      </FormContext>
    </form>
  )
}
