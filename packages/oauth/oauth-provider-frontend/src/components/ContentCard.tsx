import React from 'react'
import clsx from 'clsx'

export function ContentCard({
  children,
  size = 'narrow',
}: {
  children: React.ReactNode
  size?: 'full' | 'narrow'
}) {
  const maxWidth = size === 'full' ? 600 : 400
  return (
    <div
      className={clsx([
        'mx-auto rounded-lg border p-5 md:p-7 shadow-xl dark:shadow-2xl',
        'border-contrast-25 dark:border-contrast-50 shadow-contrast-500/20 dark:shadow-contrast-0/50',
      ])}
      style={{
        maxWidth,
      }}
    >
      {children}
    </div>
  )
}
