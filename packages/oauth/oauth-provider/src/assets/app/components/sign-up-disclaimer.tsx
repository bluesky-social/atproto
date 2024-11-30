import { HTMLAttributes } from 'react'
import { LinkDefinition } from '../backend-data'
import { clsx } from '../lib/clsx'

export type SignUpDisclaimerProps = {
  links?: readonly LinkDefinition[]
}

export function SignUpDisclaimer({
  links,

  className,
  ...attrs
}: SignUpDisclaimerProps &
  Omit<
    HTMLAttributes<HTMLParagraphElement>,
    keyof SignUpDisclaimerProps | 'children'
  >) {
  const relevantLinks = links?.filter(
    (l) => l.rel === 'privacy-policy' || l.rel === 'terms-of-service',
  )

  return (
    <p className={clsx('text-sm text-slate-500', className)} {...attrs}>
      By creating an account you agree to the{' '}
      {relevantLinks && relevantLinks.length
        ? relevantLinks.map((l, i, a) => (
            <span key={i}>
              {i > 0 && (i < a.length - 1 ? ', ' : ' and ')}
              <a
                href={l.href}
                rel={l.rel}
                target="_blank"
                className="text-brand underline"
              >
                {l.title}
              </a>
            </span>
          ))
        : 'Terms of Service and Privacy Policy'}
      .
    </p>
  )
}
