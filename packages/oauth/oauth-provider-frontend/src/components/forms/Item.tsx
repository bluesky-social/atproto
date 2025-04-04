import React from 'react'
import clsx from 'clsx'

export function Item({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={clsx('space-y-2', className)}>{children}</div>
}
