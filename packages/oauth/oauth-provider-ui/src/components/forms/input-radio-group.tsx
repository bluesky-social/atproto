import { clsx } from 'clsx'
import { JSX, ReactNode, useId } from 'react'
import { Override } from '#/lib/util.ts'

export type RadioGroupOption<T> = {
  value: T
  label: ReactNode
  description?: ReactNode
  disabled?: boolean
}

export type RadioGroupProps<T> = Override<
  Omit<JSX.IntrinsicElements['div'], 'children'>,
  {
    options: ReadonlyArray<RadioGroupOption<T>>
    value?: T
    onChange?: (value: T) => void
    /**
     * The HTML `name` attribute for the radio inputs. If omitted, a unique name
     * will be generated internally. This is necessary to ensure that multiple
     * `InputRadioGroup` components can coexist without interfering with each
     * other.
     */
    name?: string
    /**
     * Maximum number of columns to render on wider screens. Below the `sm`
     * breakpoint the options always stack vertically (one per row), and on
     * larger screens they are laid out in a grid that wraps as needed. The
     * actual column count is `min(maxColumns, options.length)`. `1` meaning
     * "always vertical".
     */
    maxColumns?: 1 | 2 | 3 | 4
  }
>

export function InputRadioGroup<T>({
  value,
  onChange,
  options,
  maxColumns = options.length % 3 === 0 ? 3 : 2,
  name: nameProp,

  // fieldset
  className,
  ...props
}: RadioGroupProps<T>) {
  const reactId = useId()
  const name = nameProp ?? `radio-group-${reactId}`

  const columns = Math.min(maxColumns, options.length) as 1 | 2 | 3 | 4

  return (
    <div
      {...props}
      className={clsx(
        'grid grid-cols-1 gap-2',
        columns >= 2 && 'sm:grid-cols-2',
        columns >= 3 && 'md:grid-cols-3',
        columns >= 4 && 'lg:grid-cols-4',
        className,
      )}
    >
      {options.map((option, index) => {
        const checked = !option.disabled && option.value === value
        const inputId = `${name}-${index}`
        const labelText = option.label
        const descriptionText = option.description
        const descriptionId = descriptionText
          ? `${inputId}-description`
          : undefined

        return (
          <label
            key={inputId}
            htmlFor={inputId}
            className={clsx(
              'flex flex-1 items-start gap-2',
              'rounded-lg px-3 py-2',
              'border-contrast-25 dark:border-contrast-50 border-2',
              'transition duration-200 ease-in-out',
              'has-[:focus-visible]:ring-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-offset-1 has-[:focus-visible]:ring-offset-white dark:has-[:focus-visible]:ring-offset-black',
              option.disabled
                ? 'text-text-light cursor-not-allowed opacity-60'
                : 'cursor-pointer',
              checked
                ? 'bg-primary/10 text-text-default border-primary/0 ring-primary ring-2 ring-offset-1 ring-offset-white dark:ring-offset-black'
                : 'text-text-light hover:bg-gray-100 dark:hover:bg-gray-800',
            )}
          >
            <input
              type="radio"
              id={inputId}
              name={name}
              checked={checked}
              disabled={option.disabled}
              aria-describedby={descriptionId}
              onChange={(event) => {
                if (event.target.checked && !option.disabled) {
                  onChange?.(option.value)
                }
              }}
              className="accent-primary mt-1 shrink-0"
            />
            <span className="flex flex-col gap-0.5">
              <span>{labelText}</span>
              {descriptionText && (
                <span
                  id={descriptionId}
                  className="text-text-light leading-snug"
                >
                  {descriptionText}
                </span>
              )}
            </span>
          </label>
        )
      })}
    </div>
  )
}
