import { Field } from '@base-ui/react/field'
import type { JSX, ReactNode } from 'react'
import { Input } from '#/components/ui/input.tsx'
import type { Override } from '#/lib/util.ts'
import { cn } from '#/lib/utils.ts'

export type FieldBaseProps = {
  /**
   * The rendered `name` attribute, and the key this field contributes to the
   * form's values. Part of the package's public contract — see CLAUDE.md.
   */
  name: string
  label?: ReactNode
  /** Control rendered opposite the label, as the shadcn login blocks place it. */
  labelAction?: ReactNode
  description?: ReactNode
  /** Leading adornment rendered inside the input frame. */
  icon?: ReactNode
  /** Trailing adornment rendered inside the input frame. */
  append?: ReactNode
  /** Extra content rendered under the input (e.g. a strength meter). */
  below?: ReactNode
}

export type TextFieldProps = Override<
  Omit<JSX.IntrinsicElements['input'], 'form'>,
  FieldBaseProps
>

/**
 * @NOTE The constraints are HTML attributes (`required`, `type`, `pattern`,
 * `minLength`), so a failure blocks submission with the browser's own message
 * in the browser's locale. `Field.Error` carries externally-supplied errors.
 */
export function TextField({
  name,
  label,
  labelAction,
  description,
  icon,
  append,
  below,
  className,
  ...props
}: TextFieldProps) {
  return (
    <Field.Root name={name} className="flex flex-col gap-2">
      {label && (
        <div className="flex items-center gap-2">
          <Field.Label className="flex w-fit items-center gap-2 text-sm font-medium leading-snug">
            {label}
          </Field.Label>
          {labelAction && <div className="ml-auto">{labelAction}</div>}
        </div>
      )}

      <div className="relative flex items-center">
        {icon && (
          <span
            aria-hidden
            className="text-muted-foreground pointer-events-none absolute left-3 flex items-center"
          >
            {icon}
          </span>
        )}
        <Field.Control
          {...props}
          name={name}
          render={<Input />}
          className={cn(icon && 'pl-10', append && 'pr-10', className)}
        />
        {append && (
          <span className="absolute right-1 flex items-center">{append}</span>
        )}
      </div>

      {below}

      {description && (
        <Field.Description className="text-muted-foreground text-sm font-normal leading-normal">
          {description}
        </Field.Description>
      )}

      <Field.Error className="text-destructive text-sm font-normal" />
    </Field.Root>
  )
}
