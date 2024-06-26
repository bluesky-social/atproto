import { forwardRef, HTMLAttributes, ReactNode, useState } from 'react'
import { clsx } from '../lib/clsx'

export const InputContainer = forwardRef<
  HTMLDivElement,
  {
    className?: string
    icon?: ReactNode
    children?: ReactNode
  } & HTMLAttributes<HTMLDivElement>
>(({ className, icon, children, onFocus, onBlur, ...props }, ref) => {
  const [focused, setFocused] = useState(false)

  return (
    <div
      ref={ref}
      className={clsx(
        'px-1 h-12 flex flex-wrap items-center justify-stretch',
        'rounded-lg',
        'bg-gray-100 dark:bg-slate-800 has-[:focus]:bg-slate-700',
        'border-solid border-2 border-transparent hover:border-gray-400 dark:hover:border-gray-500 has-[:focus]:border-brand hover:has-[:focus]:border-brand',
        className,
      )}
      onFocus={(event) => {
        setFocused(true)
        onFocus?.(event)
      }}
      onBlur={(event) => {
        setFocused(false)
        onBlur?.(event)
      }}
      {...props}
    >
      {icon && (
        <div
          className={clsx(
            'w-8 max-h-10 flex items-center justify-center',
            focused ? 'text-brand' : 'text-gray-500',
          )}
        >
          {icon}
        </div>
      )}
      <div className="w-[1px] min-w-0 flex-auto relative">{children}</div>
    </div>
  )
})
