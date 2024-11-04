import { FieldsetHTMLAttributes, forwardRef, ReactNode } from 'react'
import { Override } from '../lib/util'

export type FieldsetCardProps = Override<
  FieldsetHTMLAttributes<HTMLFieldSetElement>,
  {
    title?: ReactNode
  }
>

export const Fieldset = forwardRef<HTMLFieldSetElement, FieldsetCardProps>(
  ({ title, children, ...props }, ref) => (
    <fieldset ref={ref} {...props}>
      {title && (
        <p
          key="title"
          className="mb-1 text-slate-600 dark:text-slate-400 text-sm font-medium"
        >
          {title}
        </p>
      )}

      <div className="flex flex-col space-y-4">{children}</div>
    </fieldset>
  ),
)
