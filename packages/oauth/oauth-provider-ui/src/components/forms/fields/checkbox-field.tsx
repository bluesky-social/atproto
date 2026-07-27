import type { ReactNode } from 'react'
import type { Control, FieldPath, FieldValues } from 'react-hook-form'
import { Checkbox } from '#/components/ui/checkbox.tsx'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '#/components/ui/form.tsx'

export type CheckboxFieldProps<TValues extends FieldValues> = {
  control: Control<TValues>
  name: FieldPath<TValues>
  label: ReactNode
  description?: ReactNode
  disabled?: boolean
  className?: string
}

export function CheckboxField<TValues extends FieldValues>({
  control,
  name,
  label,
  description,
  disabled,
  className,
}: CheckboxFieldProps<TValues>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <div className="flex items-start gap-3">
            <FormControl>
              <Checkbox
                // @NOTE `name` is forwarded so the rendered input keeps the key
                // the pds e2e suite selects on (e.g. `remember`).
                name={field.name}
                checked={Boolean(field.value)}
                onCheckedChange={field.onChange}
                onBlur={field.onBlur}
                ref={field.ref}
                disabled={disabled}
              />
            </FormControl>
            <div className="grid gap-1 leading-none">
              <FormLabel className="font-normal">{label}</FormLabel>
              {description && <FormDescription>{description}</FormDescription>}
            </div>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
