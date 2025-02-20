import { HTMLAttributes } from 'react'
import { LinkDefinition } from '../../../backend-data'
import { clsx } from '../../../lib/clsx'
import { Override } from '../../../lib/util'

export type SignUpDisclaimerProps = Override<
  Omit<HTMLAttributes<HTMLParagraphElement>, 'children'>,
  {
    links?: readonly LinkDefinition[]
  }
>

export function SignUpDisclaimer({
  links,

  // HTMLAttributes<HTMLParagraphElement>
  className,
  ...attrs
}: SignUpDisclaimerProps) {
  const relevantLinks = links?.filter(
    (l) => l.rel === 'privacy-policy' || l.rel === 'terms-of-service',
  )

  return (
    <p
      className={clsx('text-sm text-slate-500 dark:text-slate-400', className)}
      {...attrs}
    >
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
