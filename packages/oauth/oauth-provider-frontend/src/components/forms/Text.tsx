import { clsx } from 'clsx'
import { InputHTMLAttributes } from 'react'

export type TextProps = InputHTMLAttributes<HTMLInputElement> & {
  name: string
  value: string
  invalid?: boolean
  disabled?: boolean
}

export function Text({ disabled, invalid, ...rest }: TextProps) {
  return (
    <input
      {...rest}
      id={`field-${rest.name}`}
      disabled={disabled}
      className={clsx([
        'text-md block w-full rounded-md border-2 px-4 py-2.5 focus:shadow-sm focus:outline-none',
        'border-contrast-200 focus:border-primary-500 focus:bg-contrast-25 dark:focus:bg-contrast-50 focus:shadow-primary-600/30',
        invalid &&
          'border-error-300 text-error-900 placeholder-error-300 focus:border-error-500',
        disabled && 'bg-contrast-50 text-contrast-500 cursor-not-allowed',
      ])}
    />
  )
}
