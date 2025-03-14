import { JSX, ReactNode } from 'react'
import { Override } from '../../lib/util.ts'

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
  disabled,

  // form
  inert = disabled,
  ...props
}: FormCardProps) {
  return (
    <form {...props} inert={inert} className="flex flex-col space-y-4">
      {prepend && <div key="prepend">{prepend}</div>}

      <div key="children" className="space-y-4">
        {children}
      </div>

      {append && <div key="append">{append}</div>}

      {(actions || cancel) && (
        <div
          key="buttons"
          className="flex flex-wrap flex-row-reverse items-center justify-end space-x-reverse space-x-2"
        >
          {actions}
          <div className="flex-auto" />
          {cancel}
        </div>
      )}
    </form>
  )
}
