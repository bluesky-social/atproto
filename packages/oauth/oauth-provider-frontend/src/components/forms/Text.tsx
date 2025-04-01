import React from 'react'
import { clsx } from 'clsx'

export type TextProps = React.InputHTMLAttributes<HTMLInputElement> & {
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
        'block w-full px-4 py-2.5 border-2 rounded-md focus:shadow-sm focus:outline-none text-md',
        'border-contrast-200 focus:border-primary-500 focus:bg-contrast-25 dark:focus:bg-contrast-50 focus:shadow-primary-600/30',
        invalid &&
          'border-error-300 text-error-900 placeholder-error-300 focus:border-error-500',
        disabled && 'bg-contrast-50 text-contrast-500 cursor-not-allowed',
      ])}
    />
  )
}
