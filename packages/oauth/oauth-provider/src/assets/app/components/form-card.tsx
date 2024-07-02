import { FormHTMLAttributes, forwardRef, ReactNode } from 'react'
import { InfoCard } from './info-card'
import { clsx } from '../lib/clsx'
import { Override } from '../lib/util'

export type FormCardProps = Override<
  FormHTMLAttributes<HTMLFormElement>,
  {
    append?: ReactNode
    error?: ReactNode
    cancel?: ReactNode
    actions?: ReactNode
  }
>

export const FormCard = forwardRef<HTMLFormElement, FormCardProps>(
  ({ actions, cancel, append, className, children, error, ...props }, ref) => {
    return (
      <form
        ref={ref}
        className={clsx('flex flex-col py-4 space-y-4', className)}
        {...props}
      >
        <div className="space-y-4">{children}</div>

        {append && <div key="append">{append}</div>}

        {error && (
          <InfoCard key="error" role="alert">
            {error}
          </InfoCard>
        )}

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
  },
)
