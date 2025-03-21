import React from 'react'
import { Link as RouterLink, LinkComponentProps } from '@tanstack/react-router'
import { clsx } from 'clsx'

export type LinkProps = LinkComponentProps & {
  label?: string
}

export function Link({ children, label, ...rest }: LinkProps) {
  return (
    <RouterLink {...rest} aria-label={label || rest.href || rest.to}>
      {children}
    </RouterLink>
  )
}

export function InlineLink({ children, className, ...rest }: LinkProps) {
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

export function staticClick(
  onClick: (e: React.MouseEvent) => void,
): Partial<LinkComponentProps> {
  return {
    to: '.',
    onClick(e) {
      e.preventDefault()
      onClick(e)
    },
  }
}

Link.staticClick = staticClick
InlineLink.staticClick = staticClick
