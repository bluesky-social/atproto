import { Trans } from '@lingui/react/macro'
import { useState } from 'react'
import type { InitiatePasswordResetInput } from '@atproto/oauth-provider-api'
import { IdentifierField } from '#/components/forms/fields/identifier-field.tsx'
import type { RateLimitedFormProps } from '#/components/forms/rate-limited-form.tsx'
import { RateLimitedForm } from '#/components/forms/rate-limited-form.tsx'
import { useCombinedRef } from '#/hooks/use-merged-refs'
import { UnknownAtprotoAccountError, type WithOptionalLocale } from '#/lib/api'
import { asNormalizedIdentifier } from '#/lib/form-patterns'
import { ErrorNotice } from './feedback/error-notice'

export type ResetPasswordRequestData =
  WithOptionalLocale<InitiatePasswordResetInput>

export type ResetPasswordRequestFormProps =
  RateLimitedFormProps<ResetPasswordRequestData> & {
    hint?: string
    domains?: readonly string[]
  }

export function ResetPasswordRequestForm({
  hint,
  domains,

  // FormShellProps
  handler,
  ref: forwardedRef,
  onValues,
  submittable = true,
  ...props
}: ResetPasswordRequestFormProps) {
  const [isSubmittable, setIsSubmittable] = useState(!!hint)
  const [formRef, ref] = useCombinedRef<HTMLFormElement>(null)

  return (
    <RateLimitedForm<{
      identifier: string
    }>
      {...props}
      ref={ref}
      submittable={submittable && isSubmittable}
      onValues={(values) => {
        const identifier = asNormalizedIdentifier(values.identifier, domains)
        setIsSubmittable(!!identifier)
        formRef.current?.reset()
        return onValues?.({ identifier })
      }}
      handler={(values, signal) => {
        const identifier = asNormalizedIdentifier(values.identifier, domains)
        // @TODO use an error that will better render in the UI
        if (!identifier) throw new Error('Invalid identifier')

        return handler({ ...values, identifier }, signal)
      }}
      renderError={(error) => (
        <ErrorNotice error={error}>
          {isUnknownAtprotoAccountErrorWithIssuer(error) && (
            // @NOTE during an oauth flow the user should ideally not be
            // directed out of this domain.
            <p>
              <Trans>
                Visit{' '}
                <a
                  href={error.issuer}
                  rel="noopener noreferrer"
                  className="text-primary cursor-pointer underline"
                >
                  {error.issuer}
                </a>{' '}
                to manage this account.
              </Trans>
            </p>
          )}
        </ErrorNotice>
      )}
    >
      <IdentifierField
        name="identifier"
        required
        defaultValue={hint}
        autoFocus
        domains={domains}
      />
    </RateLimitedForm>
  )
}

function isUnknownAtprotoAccountErrorWithIssuer(
  error: unknown,
): error is UnknownAtprotoAccountError & {
  issuer: NonNullable<UnknownAtprotoAccountError['issuer']>
} {
  return error instanceof UnknownAtprotoAccountError && error.issuer != null
}
