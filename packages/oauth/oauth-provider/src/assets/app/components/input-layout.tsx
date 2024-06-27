import { forwardRef, HTMLAttributes, ReactNode } from 'react'
import { clsx } from '../lib/clsx'
import { Override } from '../lib/util'

export type InputLayoutProps = Override<
  HTMLAttributes<HTMLDivElement>,
  {
    icon?: ReactNode
    append?: ReactNode
  }
>

export const InputLayout = forwardRef<HTMLDivElement, InputLayoutProps>(
  ({ className, icon, append, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx(
          // Layout
          'pl-1 pr-2', // Less padding on the left because icon will provide some
          'min-h-12',
          'flex items-center justify-stretch',
          // Border
          'rounded-lg',
          // Font
          'text-gray-700',
          'dark:text-gray-100',
          className,
        )}
        {...props}
      >
        <div
          className={clsx(
            'self-start shrink-0 grow-0',
            'w-8 h-12',
            'flex items-center justify-center',
            'text-gray-500',
          )}
        >
          {icon}
        </div>
        <div className="flex-auto relative">{children}</div>
        {append && <div className="grow-0 shrink-0">{append}</div>}
      </div>
    )
  },
)
