import type { ReactNode } from 'react'
import { cn } from '#/lib/utils.ts'

export type CheckboxFieldProps = {
  name: string
  label: ReactNode
  description?: ReactNode
  defaultChecked?: boolean
  disabled?: boolean
  className?: string
}

/**
 * @NOTE Deliberately a native `<input type="checkbox">` rather than
 * the shadcn checkbox primitive, which renders `<button role="checkbox">`.
 * Browsers forward
 * `<label for>` activation only to native form controls, not to buttons, so
 * with the primitive a click on the label leaves the box unticked.
 *
 * The native control is styled to match the shadcn checkbox.
 */
export function CheckboxField({
  name,
  label,
  description,
  defaultChecked,
  disabled,
  className,
}: CheckboxFieldProps) {
  return (
    <div className={className}>
      <div className="flex items-start gap-3">
        <input
          id={name}
          type="checkbox"
          name={name}
          defaultChecked={defaultChecked}
          disabled={disabled}
          className={cn(
            'border-input accent-primary size-4 shrink-0 rounded-[4px] border',
            'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        />
        <div className="grid gap-1 leading-none">
          <label htmlFor={name} className="text-sm font-normal leading-snug">
            {label}
          </label>
          {description && (
            <p className="text-muted-foreground text-sm font-normal leading-normal">
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
