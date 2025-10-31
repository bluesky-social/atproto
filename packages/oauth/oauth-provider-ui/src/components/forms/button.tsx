import { clsx } from 'clsx'
import { JSX } from 'react'
import { Override } from '../../lib/util.ts'

export type ButtonProps = Override<
  JSX.IntrinsicElements['button'],
  {
    color?: 'primary' | 'grey'
    loading?: boolean
    transparent?: boolean
    shape?: 'padded' | 'rounded' | 'circle'
  }
>

export function Button({
  color = 'grey',
  transparent = false,
  loading = undefined,
  shape = 'rounded',

  // button
  children,
  className,
  type = 'button',
  role = 'Button',
  disabled = false,
  ...props
}: ButtonProps) {
  const actionable = type === 'submit' || props.onClick != null

  return (
    <button
      role={role}
      type={type}
      disabled={disabled || loading === true}
      tabIndex={props?.tabIndex ?? (actionable ? 0 : -1)}
      {...props}
      className={clsx(
        'touch-manipulation overflow-hidden',
        'truncate tracking-wide',
        actionable ? 'cursor-pointer' : null,
        shape === 'circle' ? 'rounded-full' : 'rounded-md',
        shape === 'circle' ? 'size-8' : null,
        shape === 'rounded'
          ? 'px-6 py-2'
          : shape === 'padded'
            ? 'p-2'
            : undefined,

        // Transition
        'transition duration-300 ease-in-out',

        // Outline
        'outline-none',
        'focus:ring-primary focus:ring-2 focus:ring-offset-1 focus:ring-offset-white dark:focus:ring-offset-black',

        // Background & Text
        color === 'primary'
          ? clsx(
              'accent-slate-100',
              transparent
                ? 'text-primary bg-transparent'
                : 'bg-primary text-primary-contrast',
            )
          : color === 'grey'
            ? clsx(
                'accent-primary',
                'text-slate-600 dark:text-slate-300',
                'hover:bg-gray-200 dark:hover:bg-gray-700',
                transparent ? 'bg-transparent' : 'bg-gray-100 dark:bg-gray-800',
              )
            : undefined,
        'disabled:opacity-50',
        className,
      )}
    >
      {children}
    </button>
  )
}
