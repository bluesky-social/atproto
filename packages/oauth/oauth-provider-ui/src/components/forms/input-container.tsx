import { clsx } from 'clsx'
import { JSX, ReactNode, useState } from 'react'
import { Override } from '../../lib/util.ts'

export type InputContainerProps = Override<
  JSX.IntrinsicElements['div'],
  {
    icon: ReactNode
    append?: ReactNode
    bellow?: ReactNode
    actionable?: boolean
  }
>

export function InputContainer({
  icon,
  append,
  bellow,
  actionable,

  // div
  className,
  children,
  onFocus,
  onBlur,
  ...props
}: InputContainerProps) {
  const [hasFocus, setHasFocus] = useState(false)

  actionable ??= props.onClick != null

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

        // Transition
        'transition duration-300 ease-in-out',

        // Outline
        'outline-none',
        'focus:ring-primary focus:ring-2 focus:ring-offset-1 focus:ring-offset-white dark:focus:ring-offset-black',
        'has-focus:ring-primary has-focus:ring-2 has-focus:ring-offset-1 has-focus:ring-offset-white dark:has-focus:ring-offset-black',

        // Background
        'bg-gray-100 dark:bg-gray-800',
        actionable
          ? 'cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700'
          : undefined,

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

          // Font
          'text-slate-600 dark:text-slate-300',
        )}
      >
        {icon && (
          <div
            className={clsx(
              'flex shrink-0 grow-0 items-center justify-center',
              'mx-2',
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
