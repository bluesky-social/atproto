import { Link as RouterLink, LinkComponentProps } from '@tanstack/react-router'
import { clsx } from 'clsx'
import { ButtonStyleProps, useButtonStyles } from '#/components/Button'

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
