import { clsx } from 'clsx'
import { useMemo } from 'react'

type ButtonVariantProps = {
  color?: 'primary' | 'secondary'
  size?: 'sm' | 'md' | 'lg'
}
type ButtonStateProps = {
  disabled?: boolean
}

export function Button({
  children,
  color = 'primary',
  size = 'md',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> &
  ButtonVariantProps &
  ButtonStateProps & {
    children: React.ReactNode
  }) {
  const cn = useButtonStyles({ color, size, disabled: rest.disabled })
  return (
    <button
      {...rest}
      aria-disabled={rest.disabled ? 'true' : 'false'}
      className={clsx(cn, rest.className)}
    >
      {children}
    </button>
  )
}

function Text({ children }: { children: React.ReactNode }) {
  return <span>{children}</span>
}

Button.Text = Text

export type ButtonStyleProps = ButtonVariantProps & ButtonStateProps

export function useButtonStyles({ color, size, disabled }: ButtonStyleProps) {
  return useMemo(() => {
    return clsx([
      'flex-1 flex items-center justify-center text-center rounded-md font-medium',
      size === 'sm' && ['px-3 h-7 space-x-1', 'text-sm'],
      size === 'md' && ['px-5 h-10 space-x-1', 'text-md'],
      size === 'lg' && ['px-6 h-12 space-x-2', 'text-md'],
      color === 'primary' && [
        disabled
          ? ['bg-primary-400 text-primary-100', 'cursor-not-allowed']
          : [
              'bg-primary text-primary-contrast',
              'focus:outline-none focus:shadow-sm focus:shadow-primary-700/30',
            ],
      ],
      color === 'secondary' && [
        disabled
          ? ['bg-contrast-300 text-white/50', 'cursor-not-allowed']
          : [
              'bg-contrast-500 dark:bg-contrast-300 text-white',
              'hover:bg-contrast-600 focus:bg-contrast-600 dark:hover:bg-contrast-400 dark:focus:bg-contrast-400',
              'focus:outline-none focus:shadow-sm focus:shadow-contrast-700/30',
            ],
      ],
    ])
  }, [])
}
