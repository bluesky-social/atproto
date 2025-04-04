import { clsx } from 'clsx'
import { ReactNode } from 'react'

export function Item({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={clsx('space-y-2', className)}>{children}</div>
}
