import { clsx } from 'clsx'
import { type JSX, useMemo } from 'react'
import type { Override } from '#/lib/util.ts'

export type LinkExternalProps = Override<
  JSX.IntrinsicElements['a'],
  {
    noUtm?: boolean
  }
>

export function LinkExternal({
  href: hrefInput,
  children,
  className,
  noUtm = false,
  role = 'link',
  target = '_blank',
  rel = 'noopener noreferrer',
  'aria-disabled': ariaDisabled = !hrefInput,
  ...props
}: LinkExternalProps) {
  const href = useMemo(() => {
    if (noUtm) return hrefInput
    if (!hrefInput) return undefined

    try {
      const url = new URL(hrefInput)
      url.searchParams.set('utm_source', window.location.host)
      url.searchParams.set('utm_medium', 'referral')
      url.searchParams.set('utm_campaign', 'external_link')
      return url.href
    } catch {
      return hrefInput
    }
  }, [noUtm, hrefInput])

  return (
    <a
      href={href}
      target={target}
      rel={rel}
      role={role}
      className={clsx(
        'after:text-[1em] after:content-[" ↗"]',
        !href && 'cursor-not-allowed opacity-50',
        className,
      )}
      aria-disabled={ariaDisabled}
      {...props}
    >
      {children}
    </a>
  )
}
