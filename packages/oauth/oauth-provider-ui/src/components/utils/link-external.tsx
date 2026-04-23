import { clsx } from 'clsx'
import { JSX, useMemo } from 'react'
import { Override } from '#/lib/util.ts'

export type LinkExternalProps = Override<
  JSX.IntrinsicElements['a'],
  {
    href: string
  }
>

export function LinkExternal({
  href,
  children,
  className,
  role = 'link',
  target = '_blank',
  rel = 'noopener noreferrer',
  ...props
}: LinkExternalProps) {
  const url = useMemo(() => {
    try {
      const url = new URL(href)
      url.searchParams.set('utm_source', window.location.host)
      url.searchParams.set('utm_medium', 'referral')
      url.searchParams.set('utm_campaign', 'external_link')
      return url.href
    } catch {
      return href
    }
  }, [href])

  return (
    <a
      href={url}
      target={target}
      rel={rel}
      role={role}
      className={clsx('after:text-[1em] after:content-[" ↗"]', className)}
      {...props}
    >
      {children}
    </a>
  )
}
