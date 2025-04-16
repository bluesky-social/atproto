import { clsx } from 'clsx'
import { JSX, ReactNode, useState } from 'react'
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
          'min-h-12 w-full',
          'flex items-center justify-stretch',
          // Border
          'rounded-lg',
          bellow ? 'rounded-bl-none rounded-br-none' : undefined,
          'outline-hidden',
          'border-2 border-solid border-transparent',
          'focus:border-primary has-focus:border-primary',
          'hover:border-gray-400 hover:focus:border-gray-400',
          'dark:hover:border-gray-500 dark:hover:focus:border-gray-500',
          // Background
          'has-focus:bg-slate-200 bg-gray-100 focus:bg-slate-200',
          'dark:has-focus:bg-slate-700 dark:bg-slate-800 dark:focus:bg-slate-700',
          // Font
          'text-slate-600 dark:text-slate-300',
          'accent-primary',
        )}
      >
        {icon && (
          <div
            className={clsx(
              'shrink-0 grow-0',
              'mx-1',
              hasFocus ? 'text-primary' : 'text-slate-500',
            )}
          >
            {icon}
          </div>
        )}

        {children}

        <div className="ml-1 flex shrink-0 grow-0 items-center">{append}</div>
      </div>
      {bellow && (
        <div
          className={clsx(
            // Layout
            'space-x-2 px-3 py-2',
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
