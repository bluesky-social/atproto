import { forwardRef, useState } from 'react'
import { clsx } from '../lib/clsx'
import { InputLayout, InputLayoutProps } from './input-layout'

export type InputContainerProps = InputLayoutProps

export const InputContainer = forwardRef<HTMLDivElement, InputContainerProps>(
  ({ className, onFocus, icon, onBlur, ...props }, ref) => {
    const [focused, setFocused] = useState(false)

    return (
      <InputLayout
        ref={ref}
        className={clsx(
          // Background
          'bg-gray-100 has-[:focus]:bg-slate-200',
          'dark:bg-slate-800 dark:has-[:focus]:bg-slate-700',
          // Border
          'outline-none',
          'border-solid border-2 border-transparent hover:border-gray-400 has-[:focus]:border-brand hover:has-[:focus]:border-brand',
          'dark:hover:border-gray-500',
          className,
        )}
        onFocus={(event) => {
          onFocus?.(event)
          if (!event.defaultPrevented) setFocused(true)
        }}
        onBlur={(event) => {
          onBlur?.(event)
          if (!event.defaultPrevented) setFocused(false)
        }}
        icon={<div className={focused ? 'text-brand' : undefined}>{icon}</div>}
        {...props}
      />
    )
  },
)
