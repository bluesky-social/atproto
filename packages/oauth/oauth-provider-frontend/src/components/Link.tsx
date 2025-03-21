import React from 'react'
import { Link as RouterLink, LinkComponentProps } from '@tanstack/react-router'
import { clsx } from 'clsx'

export function Link({ children, ...rest }: LinkComponentProps) {
  return <RouterLink {...rest}>{children}</RouterLink>
}

export function InlineLink({
  children,
  className,
  ...rest
}: LinkComponentProps) {
  return (
    <Link
      {...rest}
      className={clsx([
        'text-primary-500',
        'hover:underline',
        'focus:outline-none focus:underline',
        className,
      ])}
    >
      {children}
    </Link>
  )
}
