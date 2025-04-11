import { clsx } from 'clsx'

export type CheckboxProps = React.InputHTMLAttributes<HTMLInputElement> & {
  name: string
  value: string
  invalid?: boolean
  disabled?: boolean
}

export function Checkbox({ disabled, invalid, ...rest }: CheckboxProps) {
  return (
    <input
      id={`checkbox-${rest.name}`}
      type="checkbox"
      {...rest}
      className={clsx([
        'block h-5 w-5 rounded-md border-2 focus:shadow-sm focus:outline-none',
        'border-contrast-200 focus:border-primary-500 focus:bg-contrast-25 dark:focus:bg-contrast-50 focus:shadow-primary-600/30',
        invalid &&
          'border-error-300 text-error-900 placeholder-error-300 focus:border-error-500',
        disabled && 'bg-contrast-50 text-contrast-500 cursor-not-allowed',
      ])}
    />
  )
}

function Label({
  children,
  name,
}: {
  children: React.ReactNode
  name: string
}) {
  return (
    <label htmlFor={`checkbox-${name}`} className="text-sm">
      {children}
    </label>
  )
}

Checkbox.Label = Label
