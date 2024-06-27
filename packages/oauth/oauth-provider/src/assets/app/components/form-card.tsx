import { FormHTMLAttributes, forwardRef, ReactNode } from 'react'
import { InfoCard } from './info-card'
import { clsx } from '../lib/clsx'
import { Override } from '../lib/util'

export type FormCardProps = Override<
  FormHTMLAttributes<HTMLFormElement>,
  {
    title?: ReactNode
    append?: ReactNode
    disabled?: boolean
    error?: ReactNode
    cancel?: ReactNode
    actions?: ReactNode
  }
>

export const FormCard = forwardRef<HTMLFormElement, FormCardProps>(
  (
    {
      actions,
      cancel,
      append,
      className,
      disabled,
      children,
      error,
      title,
      ...props
    },
    ref,
  ) => {
    return (
      <form ref={ref} className={clsx('flex flex-col', className)} {...props}>
        {title && (
          <p
            key="title"
            className="font-medium mb-1 text-slate-600 dark:text-slate-400"
          >
            {title}
          </p>
        )}

        <fieldset className="flex flex-col space-y-4" disabled={disabled}>
          {children}
        </fieldset>

        {append && (
          <div key="append" className="mt-4">
            {append}
          </div>
        )}

        {error && (
          <InfoCard key="error" role="alert" className="mt-4">
            {error}
          </InfoCard>
        )}

        {(actions || cancel) && (
          <div
            key="buttons"
            className="py-4 flex flex-wrap flex-row-reverse items-center justify-end space-x-reverse space-x-2"
          >
            {actions}
            <div className="flex-auto" />
            {cancel}
          </div>
        )}
      </form>
    )
  },
)
