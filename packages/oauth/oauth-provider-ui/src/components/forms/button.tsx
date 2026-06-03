import { clsx } from 'clsx'
import { JSX } from 'react'
import { Override } from '#/lib/util.ts'

export type ButtonColor =
  | 'primary'
  | 'gray'
  | 'darkGrey'
  | 'error'
  | 'warning'
  | 'info'
  | 'success'

export type ButtonColoring = 'transparent' | 'bordered' | 'default'

export type ButtonProps = Override<
  JSX.IntrinsicElements['button'],
  {
    color?: ButtonColor
    loading?: boolean
    /** Alias for `coloring="transparent"` */
    transparent?: boolean
    /** Alias for `coloring="bordered"` */
    bordered?: boolean
    coloring?: ButtonColoring
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
    sm: 'py-1 px-2',
    md: 'py-2 px-3',
    lg: 'py-3 px-4',
  },
  circle: {
    sm: 'size-6',
    md: 'size-8',
    lg: 'size-10',
  },
} as const

const COLORING: Record<
  ButtonColor,
  Record<ButtonColoring, string | string[]>
> = {
  primary: {
    bordered:
      'border-primary bg-primary/10 hover:bg-primary/20 text-primary border-2',
    transparent: 'text-primary hover:bg-primary/10 bg-transparent',
    default:
      'bg-primary text-primary-contrast hover:bg-primary-600 dark:hover:bg-primary-400',
  },
  gray: {
    bordered:
      'text-text-light border-2 border-gray-100 bg-gray-100/10 hover:bg-gray-100/20',
    transparent: 'text-text-light bg-transparent hover:bg-gray-500/10',
    default:
      'bg-gray-100 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-600',
  },
  darkGrey: {
    bordered:
      'border-gray text-gray border-2 bg-gray-700/10 hover:bg-gray-700/20',
    transparent: 'text-gray bg-transparent hover:bg-gray-700/10',
    default:
      'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600',
  },
  error: {
    bordered: 'border-error text-error bg-error/10 hover:bg-error/20 border-2',
    transparent: 'text-error hover:bg-error/10 bg-transparent',
    default:
      'bg-error-500 dark:bg-error-700 text-error-contrast hover:bg-error-600 dark:hover:bg-error-400',
  },
  success: {
    bordered:
      'border-success text-success bg-success/10 hover:bg-success/20 border-2',
    transparent: 'text-success hover:bg-success/10 bg-transparent',
    default:
      'bg-success-500 dark:bg-success-700 text-success-contrast hover:bg-success-600 dark:hover:bg-success-400',
  },
  warning: {
    bordered:
      'border-warning text-warning bg-warning/10 hover:bg-warning/20 border-2',
    transparent: 'text-warning hover:bg-warning/10 bg-transparent',
    default:
      'bg-warning-500 dark:bg-warning-700 text-warning-contrast hover:bg-warning-600 dark:hover:bg-warning-400',
  },
  info: {
    bordered: 'border-info text-info bg-info/10 hover:bg-info/20 border-2',
    transparent: 'text-info hover:bg-info/10 bg-transparent',
    default:
      'bg-info-500 dark:bg-info-700 text-info-contrast hover:bg-info-600 dark:hover:bg-info-400',
  },
}

export function Button({
  color = 'gray',
  transparent = false,
  bordered = false,
  coloring = transparent ? 'transparent' : bordered ? 'bordered' : 'default',
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
        'box-border',
        PADDING_SIZES[shape][size],
        TEXT_SIZES[size],
        COLORING[color][coloring],

        // Transition
        'transition duration-300 ease-in-out',

        // Outline
        'outline-none',
        'focus:ring-primary focus:ring-2 focus:ring-offset-1 focus:ring-offset-white dark:focus:ring-offset-black',

        'disabled:opacity-50',
        className,
      )}
    >
      {children}
    </button>
  )
}
