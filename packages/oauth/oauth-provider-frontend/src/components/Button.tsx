import React from 'react'
import { clsx } from 'clsx'

type ButtonVariantProps = {
  color?: 'primary' | 'secondary'
}
type ButtonStateProps = {
  disabled?: boolean
}

export function Button({
  children,
  color = 'primary',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> &
  ButtonVariantProps &
  ButtonStateProps & {
    children: React.ReactNode
  }) {
  const cn = useButtonStyles({ color, disabled: rest.disabled })
  return (
    <button
      {...rest}
      aria-disabled={rest.disabled ? 'true' : 'false'}
      className={cn}
    >
      {children}
    </button>
  )
}

export type ButtonStyleProps = ButtonVariantProps & ButtonStateProps

export function useButtonStyles({ color, disabled }: ButtonStyleProps) {
  return React.useMemo(() => {
    return clsx([
      'flex-1 block text-center px-6 py-3 rounded-md text-md font-medium',
      color === 'primary' && [
        disabled
          ? ['bg-primary-400 text-primary-100', 'cursor-not-allowed']
          : [
              'bg-primary-500 text-white',
              'hover:bg-primary-600 focus:bg-primary-600',
              'focus:outline-none focus:shadow-sm focus:shadow-primary-700/30',
            ],
      ],
    ])
  }, [])
}
