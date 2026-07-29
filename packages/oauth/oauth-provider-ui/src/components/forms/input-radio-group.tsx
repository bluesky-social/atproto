import { type JSX, type ReactNode, useId } from 'react'
import { RadioGroup, RadioGroupItem } from '#/components/ui/radio-group.tsx'
import type { Override } from '#/lib/util.ts'
import { cn } from '#/lib/utils.ts'

export type RadioGroupOption<T> = {
  value: T
  label: ReactNode
  description?: ReactNode
  disabled?: boolean
}

export type RadioGroupProps<T> = Override<
  Omit<JSX.IntrinsicElements['div'], 'children' | 'onChange'>,
  {
    options: ReadonlyArray<RadioGroupOption<T>>
    value?: T
    onChange?: (value: T) => void
    name?: string
    /**
     * Maximum number of columns to render on wider screens. Below the `sm`
     * breakpoint the options always stack vertically.
     */
    maxColumns?: 1 | 2 | 3 | 4
  }
>

/** Card-style radio group, built on `ui/radio-group`. */
export function InputRadioGroup<T>({
  value,
  onChange,
  options,
  maxColumns = options.length % 3 === 0 ? 3 : 2,
  name: nameProp,

  className,
  ...props
}: RadioGroupProps<T>) {
  const reactId = useId()
  const name = nameProp ?? `radio-group-${reactId}`

  const columns = Math.min(maxColumns, options.length) as 1 | 2 | 3 | 4
  const selectedIndex = options.findIndex(
    (o) => !o.disabled && o.value === value,
  )

  return (
    <RadioGroup
      {...props}
      name={name}
      value={selectedIndex === -1 ? undefined : String(selectedIndex)}
      onValueChange={(next) => {
        const option = options[Number(next)]
        if (option && !option.disabled) onChange?.(option.value)
      }}
      className={cn(
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
        const descriptionId = option.description
          ? `${inputId}-description`
          : undefined

        return (
          <label
            key={inputId}
            htmlFor={inputId}
            className={cn(
              'flex flex-1 items-start gap-3 rounded-md border px-3 py-2.5',
              'transition-colors',
              'has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-2',
              option.disabled
                ? 'text-muted-foreground cursor-not-allowed opacity-60'
                : 'cursor-pointer',
              checked
                ? 'border-primary bg-accent/50'
                : 'border-input hover:bg-accent/40',
            )}
          >
            <RadioGroupItem
              id={inputId}
              value={String(index)}
              disabled={option.disabled}
              aria-describedby={descriptionId}
              className="mt-0.5"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{option.label}</span>
              {option.description && (
                <span
                  id={descriptionId}
                  className="text-muted-foreground text-xs leading-snug"
                >
                  {option.description}
                </span>
              )}
            </span>
          </label>
        )
      })}
    </RadioGroup>
  )
}
