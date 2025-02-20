import { JSX, ReactNode } from 'react'
import { clsx } from '../../lib/clsx.ts'
import { Override } from '../../lib/util.ts'

export type InputLayoutProps = Override<
  JSX.IntrinsicElements['div'],
  {
    icon: ReactNode
    append?: ReactNode
  }
>

export function InputLayout({
  icon,
  append,

  // HTMLDivElement
  className,
  children,
  ...props
}: InputLayoutProps) {
  return (
    <div
      {...props}
      className={clsx(
        // Layout
        'pl-1 pr-2', // Less padding on the left because icon will provide some
        'min-h-12',
        'max-w-full',
        'flex items-center justify-stretch',
        // Border
        'rounded-lg',
        // Font
        'text-slate-600 dark:text-slate-300',
        className,
      )}
    >
      {icon && (
        <div
          aria-hidden
          className={clsx(
            'self-start shrink-0 grow-0',
            'w-8 h-12',
            'flex items-center justify-center',
            'text-slate-500',
          )}
        >
          {icon}
        </div>
      )}
      <div className="flex-auto relative">{children}</div>
      {append && (
        <div className="grow-0 shrink-0 flex items-center">{append}</div>
      )}
    </div>
  )
}
