import { clsx } from 'clsx'
import { JSX } from 'react'
import { Override } from '#/lib/util.ts'

export type ButtonProps = Override<
  JSX.IntrinsicElements['button'],
  {
    color?: 'primary' | 'grey' | 'darkGrey' | 'error'
    loading?: boolean
    transparent?: boolean
    shape?: 'padded' | 'rounded' | 'circle'
    size?: 'sm' | 'md' | 'lg'
  }
>

const TEXT_SIZES = {
  sm: 'text-sm',
  md: 'text-md',
  lg: 'text-lg',
} as const

const PADDING_SIZES = {
  rounded: {
    sm: 'px-4 py-1',
    md: 'px-6 py-2',
    lg: 'px-8 py-3',
  },
  padded: {
    sm: 'p-1 px-2',
    md: 'p-2',
    lg: 'p-3',
  },
  circle: {
    sm: 'size-6',
    md: 'size-8',
    lg: 'size-10',
  },
} as const

export function Button({
  color = 'grey',
  transparent = false,
  loading = undefined,
  shape = 'rounded',
  size = 'md',

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
        'flex items-center justify-center',
        PADDING_SIZES[shape][size],
        TEXT_SIZES[size],

        // Transition
        'transition duration-300 ease-in-out',

        // Outline
        'outline-none',
        'focus:ring-primary focus:ring-2 focus:ring-offset-1 focus:ring-offset-white dark:focus:ring-offset-black',

        // Color
        color === 'primary'
          ? clsx(
              'accent-slate-100',
              transparent
                ? 'text-primary bg-transparent'
                : 'bg-primary text-primary-contrast',
            )
          : null,
        color === 'grey'
          ? clsx(
              'accent-primary',
              'text-slate-600 dark:text-slate-300',
              'hover:bg-gray-200 dark:hover:bg-gray-700',
              transparent ? 'bg-transparent' : 'bg-gray-100 dark:bg-gray-800',
            )
          : undefined,
        color === 'darkGrey'
          ? clsx(
              'accent-primary',
              'text-slate-600 dark:text-slate-300',
              'hover:bg-gray-300 dark:hover:bg-gray-600',
              transparent ? 'bg-transparent' : 'bg-gray-200 dark:bg-gray-700',
            )
          : undefined,
        color === 'error'
          ? clsx(
              'accent-red-100',
              transparent
                ? 'text-error bg-transparent'
                : 'bg-error text-error-contrast',
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
