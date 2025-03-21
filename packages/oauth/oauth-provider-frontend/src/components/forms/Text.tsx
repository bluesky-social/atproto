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
      id={rest.name}
      className={clsx([
        'block w-full px-3 py-2 border border-contrast-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm',
        invalid &&
          'border-error-300 text-error-900 placeholder-error-300 focus:ring-error-500 focus:border-error-500',
        disabled && 'bg-contrast-50 text-contrast-500 cursor-not-allowed',
      ])}
    />
  )
}
