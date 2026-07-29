import type { ReactNode } from 'react'
import type { Control, FieldPath, FieldValues } from 'react-hook-form'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '#/components/ui/form.tsx'
import { cn } from '#/lib/utils.ts'

export type CheckboxFieldProps<TValues extends FieldValues> = {
  control: Control<TValues>
  name: FieldPath<TValues>
  label: ReactNode
  description?: ReactNode
  disabled?: boolean
  className?: string
}

/**
 * @NOTE Deliberately a native `<input type="checkbox">` rather than
 * `ui/checkbox`, which renders `<button role="checkbox">`. Browsers only
 * forward `<label for>` activation to native form controls, not to buttons, so
 * clicking the label left the box unticked — the session was then not
 * remembered, which the pds e2e suite caught.
 *
 * The native control is styled to match the shadcn checkbox.
 */
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
              <input
                type="checkbox"
                name={field.name}
                ref={field.ref}
                // @NOTE Uncontrolled (`defaultChecked`, not `checked`). With a
                // controlled checkbox the very first click was being dropped —
                // the native toggle was reverted by the re-render before
                // react-hook-form's state landed. Since the e2e suite's label
                // click is the first interaction with the sign-in form, that
                // silently left "remember this account" unticked, so the
                // session was never persisted. Uncontrolled makes the DOM the
                // source of truth and the click can't be lost.
                defaultChecked={Boolean(field.value)}
                onChange={(event) => field.onChange(event.target.checked)}
                onBlur={field.onBlur}
                disabled={disabled}
                className={cn(
                  'border-input accent-primary size-4 shrink-0 rounded-[4px] border',
                  'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                )}
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
