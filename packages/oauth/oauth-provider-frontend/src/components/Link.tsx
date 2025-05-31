import {
  Link as RouterLink,
  type LinkComponentProps,
} from '@tanstack/react-router'
import { clsx } from 'clsx'
import { type ReactNode } from 'react'
import { type ButtonStyleProps, useButtonStyles } from '#/components/Button'

export type LinkProps = LinkComponentProps & {
  label?: string
  children?: ReactNode | string
}

export function Link({ children, label, ...rest }: LinkProps) {
  const isExternal = !rest.to && rest.href
  const Component = isExternal ? 'a' : RouterLink

  return (
    <Component {...rest} aria-label={label || rest.href || rest.to}>
      {children}
    </Component>
  )
}

export function InlineLink({ children, className, ...rest }: LinkProps) {
  return (
    <Link
      {...rest}
      className={clsx([
        'text-primary-500',
        'hover:underline',
        'focus:underline focus:outline-none',
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

export function ButtonLink({
  children,
  color = 'primary',
  size = 'md',
  disabled,
  ...rest
}: LinkProps & ButtonStyleProps) {
  const cn = useButtonStyles({ color, size, disabled })
  return (
    <Link {...rest} className={cn}>
      {children}
    </Link>
  )
}
