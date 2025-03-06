import { JSX, ReactNode, useState } from 'react'
import { clsx } from '../../lib/clsx.ts'
import { Override } from '../../lib/util.ts'

export type InputContainerProps = Override<
  JSX.IntrinsicElements['div'],
  {
    icon: ReactNode
    append?: ReactNode
  }
>

export function InputContainer({
  icon,
  append,

  // div
  className,
  children,
  onFocus,
  onBlur,
  ...props
}: InputContainerProps) {
  const [focused, setFocused] = useState(false)

  return (
    <div
      {...props}
      onFocus={(event) => {
        onFocus?.(event)
        if (!event.defaultPrevented) setFocused(true)
      }}
      onBlur={(event) => {
        onBlur?.(event)
        if (!event.defaultPrevented) setFocused(false)
      }}
      className={clsx(
        // Layout
        'pl-1 pr-2', // Less padding on the left because icon will provide some
        'min-h-12',
        'max-w-full',
        'flex items-center justify-stretch',
        // Font
        'text-slate-600 dark:text-slate-300',
        'accent-brand',
        // Background
        'bg-gray-100 focus:bg-slate-200 has-[:focus]:bg-slate-200',
        'dark:bg-slate-800 dark:focus:bg-slate-700 dark:has-[:focus]:bg-slate-700',
        // Border
        'rounded-lg',
        'outline-none',
        'border-solid border-2 border-transparent',
        'focus:border-brand has-[:focus]:border-brand',
        'hover:border-gray-400 hover:focus:border-gray-400',
        'dark:hover:border-gray-500 dark:hover:focus:border-gray-500',
        className,
      )}
    >
      {icon && (
        <div
          className={clsx(
            'self-start shrink-0 grow-0',
            'w-8 h-12',
            'flex items-center justify-center',
            focused ? 'text-brand' : 'text-slate-500',
          )}
        >
          {icon}
        </div>
      )}
      <div className="flex-auto relative">{children}</div>
      {append && (
        <div className="ml-1 grow-0 shrink-0 flex items-center">{append}</div>
      )}
    </div>
  )
}
