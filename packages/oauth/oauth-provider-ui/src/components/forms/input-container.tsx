import { clsx } from 'clsx'
import { JSX, KeyboardEvent, MouseEvent, ReactNode, useState } from 'react'
import { Override } from '#/lib/util.ts'

export type InputContainerProps = Override<
  JSX.IntrinsicElements['div'],
  {
    icon: ReactNode
    append?: ReactNode
    bellow?: ReactNode
    actionable?: boolean
    transparent?: boolean
    onAction?: (
      event: KeyboardEvent<HTMLDivElement> | MouseEvent<HTMLDivElement>,
    ) => void
  }
>

export function InputContainer({
  icon,
  append,
  bellow,
  actionable,
  transparent,
  onAction,

  // div
  className,
  children,
  onFocus,
  onBlur,
  onClick,
  onKeyDown,
  tabIndex,
  ...props
}: InputContainerProps) {
  const [hasFocus, setHasFocus] = useState(false)

  actionable ??= onAction != null || onClick != null
  tabIndex ??= actionable ? 0 : -1

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
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (
          onAction &&
          !event.defaultPrevented &&
          event.target === event.currentTarget &&
          (event.key === 'Enter' || event.key === ' ')
        ) {
          onAction?.(event)
        }
      }}
      onClick={(event) => {
        onClick?.(event)
        if (onAction && !event.defaultPrevented) {
          onAction?.(event)
        }
      }}
      tabIndex={tabIndex}
      role={actionable ? 'button' : undefined}
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
        'has-[input[type="text"]:focus,input[type="password"]:focus]:ring-primary',
        'has-[input[type="text"]:focus,input[type="password"]:focus]:ring-2',
        'has-[input[type="text"]:focus,input[type="password"]:focus]:ring-offset-1',
        'has-[input[type="text"]:focus,input[type="password"]:focus]:ring-offset-white',
        'dark:has-[input[type="text"]:focus,input[type="password"]:focus]:ring-offset-black',
        tabIndex !== -1 && [
          'cursor-pointer',
          'focus:ring-primary',
          'focus:ring-2',
          'focus:ring-offset-1',
          'focus:ring-offset-white',
          'dark:focus:ring-offset-black',
        ],

        // Background
        transparent ? 'bg-transparent' : 'bg-gray-100 dark:bg-gray-800',
        tabIndex !== -1 && 'hover:bg-gray-200 dark:hover:bg-gray-700',

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
          'text-text-default',
        )}
      >
        {icon && (
          <div
            className={clsx(
              'flex shrink-0 grow-0 items-center justify-center',
              'mx-2',
              hasFocus ? 'text-primary' : 'text-text-light',
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
            'text-text-light',
            'text-sm italic',
          )}
        >
          {bellow}
        </div>
      )}
    </div>
  )
}
