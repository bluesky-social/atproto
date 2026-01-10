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
          'block size-4 rounded-md border-2',
          'accent-primary',
          'transition duration-300 ease-in-out',
          'outline-none',
          'focus:ring-primary focus:ring-2 focus:ring-offset-1 focus:ring-offset-white dark:focus:ring-offset-black',
          invalid && 'accent-error focus:border-error',
          disabled && 'bg-contrast-50 text-contrast-500 cursor-not-allowed',
          className,
        ])}
      />
    )
  },
)

Checkbox.displayName = 'Checkbox'
