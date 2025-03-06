import { JSX, ReactNode, useState } from 'react'
import { clsx } from '../../lib/clsx.ts'
import { Override } from '../../lib/util.ts'

export type InputContainerProps = Override<
  JSX.IntrinsicElements['div'],
  {
    icon: ReactNode
    append?: ReactNode
    bellow?: ReactNode
  }
>

export function InputContainer({
  icon,
  append,
  bellow,

  // div
  className,
  children,
  onFocus,
  onBlur,
  ...props
}: InputContainerProps) {
  const [hasFocus, setHasFocus] = useState(false)

  return (
    <div
      {...props}
      onFocus={(event) => {
        onFocus?.(event)
        if (!event.defaultPrevented) setHasFocus(true)
      }}
      onBlur={(event) => {
        onBlur?.(event)
        if (!event.defaultPrevented) setHasFocus(false)
      }}
      className={clsx(
        // Layout
        'min-h-12',
        'max-w-full',
        'overflow-hidden',
        // Border
        'rounded-lg',
        className,
      )}
    >
      <div
        className={clsx(
          // Layout
          'px-1',
          'w-full min-h-12',
          'flex items-center justify-stretch',
          // Border
          'rounded-lg',
          bellow ? 'rounded-br-none rounded-bl-none' : undefined,
          'outline-none',
          'border-solid border-2 border-transparent',
          'focus:border-brand has-[:focus]:border-brand',
          'hover:border-gray-400 hover:focus:border-gray-400',
          'dark:hover:border-gray-500 dark:hover:focus:border-gray-500',
          // Background
          'bg-gray-100 focus:bg-slate-200 has-[:focus]:bg-slate-200',
          'dark:bg-slate-800 dark:focus:bg-slate-700 dark:has-[:focus]:bg-slate-700',
          // Font
          'text-slate-600 dark:text-slate-300',
          'accent-brand',
        )}
      >
        {icon && (
          <div
            className={clsx(
              'shrink-0 grow-0',
              'mx-1',
              hasFocus ? 'text-brand' : 'text-slate-500',
            )}
          >
            {icon}
          </div>
        )}

        {children}

        <div className="ml-1 grow-0 shrink-0 flex items-center">{append}</div>
      </div>
      {bellow && (
        <div
          className={clsx(
            // Layout
            'px-3 py-2 space-x-2',
            'flex flex-row items-center gap-1',
            // Border
            'rounded-br-2 rounded-bl-2',
            // Background
            'bg-gray-200 dark:bg-slate-700',
            // Font
            'text-gray-700 dark:text-gray-300',
            'text-sm italic',
          )}
        >
          {bellow}
        </div>
      )}
    </div>
  )
}
