import { Trans } from '@lingui/react/macro'
import { HTMLAttributes } from 'react'
import { LinkDefinition } from '../../../backend-types.ts'
import { clsx } from '../../../lib/clsx.ts'
import { Override } from '../../../lib/util.ts'

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
    (l) =>
      l.href && (l.rel === 'privacy-policy' || l.rel === 'terms-of-service'),
  )

  return (
    <p
      className={clsx('text-sm text-slate-500 dark:text-slate-400', className)}
      {...attrs}
    >
      <Trans>
        By creating an account you agree to the{' '}
        {relevantLinks && relevantLinks.length ? (
          relevantLinks.map((l, i, a) => (
            <span key={i}>
              {i > 0 && (i < a.length - 1 ? ', ' : <Trans> and </Trans>)}
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
        ) : (
          <Trans>Terms of Service and Privacy Policy</Trans>
        )}
        .
      </Trans>
    </p>
  )
}
