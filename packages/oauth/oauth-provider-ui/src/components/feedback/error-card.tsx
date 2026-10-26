import { CircleAlertIcon } from 'lucide-react'
import type { JSX } from 'react'
import { cn } from '#/lib/utils.ts'

export type ErrorCardProps = JSX.IntrinsicElements['div']

export function ErrorCard({
  className,
  children,
  role = 'alert',
  ...props
}: ErrorCardProps) {
  return (
    <div
      {...props}
      role={role}
      className={cn(
        'text-destructive flex items-start gap-3 text-sm leading-snug',
        className,
      )}
    >
      <CircleAlertIcon aria-hidden className="mt-px size-4 shrink-0" />

      <div className="flex min-w-0 flex-1 flex-col gap-2">{children}</div>
    </div>
  )
}
