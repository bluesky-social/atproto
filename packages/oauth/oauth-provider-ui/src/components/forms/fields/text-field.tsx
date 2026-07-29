import type { JSX, ReactNode } from 'react'
import type { Control, FieldPath, FieldValues } from 'react-hook-form'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '#/components/forms/form.tsx'
import { Input } from '#/components/ui/input.tsx'
import type { Override } from '#/lib/util.ts'
import { cn } from '#/lib/utils.ts'

export type FieldBaseProps<TValues extends FieldValues> = {
  control: Control<TValues>
  /**
   * The field key. react-hook-form derives the rendered `name` attribute from
   * it, so these keys are part of the package's public contract rather than an
   * internal detail — see CLAUDE.md.
   */
  name: FieldPath<TValues>
  label?: ReactNode
  description?: ReactNode
  /** Leading adornment rendered inside the input frame. */
  icon?: ReactNode
  /** Trailing adornment rendered inside the input frame. */
  append?: ReactNode
  /** Extra content rendered under the input (e.g. a strength meter). */
  below?: ReactNode
}

export type TextFieldProps<TValues extends FieldValues> = Override<
  Omit<JSX.IntrinsicElements['input'], 'name' | 'form'>,
  FieldBaseProps<TValues>
>

export function TextField<TValues extends FieldValues>({
  control,
  name,
  label,
  description,
  icon,
  append,
  below,
  className,
  ...props
}: TextFieldProps<TValues>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          {label && <FormLabel>{label}</FormLabel>}
          <div className="relative flex items-center">
            {icon && (
              <span
                aria-hidden
                className="text-muted-foreground pointer-events-none absolute left-3 flex items-center"
              >
                {icon}
              </span>
            )}
            <FormControl>
              <Input
                {...props}
                {...field}
                value={field.value ?? ''}
                className={cn(icon && 'pl-10', append && 'pr-10', className)}
              />
            </FormControl>
            {append && (
              <span className="absolute right-1 flex items-center">
                {append}
              </span>
            )}
          </div>
          {below}
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
