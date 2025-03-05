import { useState } from 'react'
import { clsx } from '../../lib/clsx.ts'
import { IconCard, IconCardProps } from '../utils/icon-card.tsx'

export type InputContainerProps = IconCardProps

export function InputContainer({
  className,
  icon,
  onFocus,
  onBlur,
  ...props
}: InputContainerProps) {
  const [focused, setFocused] = useState(false)

  return (
    <IconCard
      className={clsx(
        'accent-brand',
        // Background
        'bg-gray-100 focus:bg-slate-200 has-[:focus]:bg-slate-200',
        'dark:bg-slate-800 dark:focus:bg-slate-700 dark:has-[:focus]:bg-slate-700',
        // Border
        'outline-none',
        'border-solid border-2 border-transparent',
        'focus:border-brand has-[:focus]:border-brand',
        'hover:border-gray-400 hover:focus:border-gray-400',
        'dark:hover:border-gray-500 dark:hover:focus:border-gray-500',
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
      icon={
        icon && <div className={focused ? 'text-brand' : undefined}>{icon}</div>
      }
      {...props}
    />
  )
}
