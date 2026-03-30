import { clsx } from 'clsx'
import { JSX, ReactNode } from 'react'
import { Override } from '#/lib/util.ts'

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
  className,
  ...props
}: FormCardProps) {
  return (
    <form
      inert={inert}
      className={clsx('flex flex-col gap-4', className)}
      {...props}
    >
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
    </form>
  )
}
