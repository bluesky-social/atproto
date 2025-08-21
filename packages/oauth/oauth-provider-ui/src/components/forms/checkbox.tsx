import { clsx } from 'clsx'
import { ClassAttributes, InputHTMLAttributes, forwardRef } from 'react'
import { Override } from '#/lib/util.ts'

export type CheckboxProps = Override<
  InputHTMLAttributes<HTMLInputElement> & ClassAttributes<HTMLInputElement>,
  {
    type?: never
    invalid?: boolean
  }
>

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, invalid, disabled, ...props }, ref) => {
    return (
      <input
        {...props}
        type="checkbox"
        ref={ref}
        disabled={disabled}
        className={clsx([
          'block size-4 rounded-md border-2 focus:shadow-sm focus:outline-none',
          'border-contrast-200 focus:border-primary-500 focus:bg-contrast-25 dark:focus:bg-contrast-50 focus:shadow-primary-600/30',
          invalid &&
            'border-error-300 text-error-900 placeholder-error-300 focus:border-error-500',
          disabled && 'bg-contrast-50 text-contrast-500 cursor-not-allowed',
          className,
        ])}
      />
    )
  },
)

Checkbox.displayName = 'Checkbox'
