import { Trans } from '@lingui/react/macro'
import { useState } from 'react'
import { IdentifierField } from '#/components/forms/fields/identifier-field.tsx'
import {
  FormShell,
  type FormShellProps,
} from '#/components/forms/form-shell.tsx'
import { useCombinedRef } from '#/hooks/use-merged-refs'
import { UnknownAtprotoAccountError } from '#/lib/api'
import { isIdentifier, normalizeIdentifier } from '#/lib/form-patterns'
import { ErrorNotice } from './feedback/error-notice'

export type ResetPasswordRequestData = {
  identifier: string
}

export type ResetPasswordRequestFormProps =
  FormShellProps<ResetPasswordRequestData> & {
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
  const [formEl, ref] = useCombinedRef<HTMLFormElement>(null)

  return (
    <FormShell<{
      identifier: string
    }>
      {...props}
      ref={ref}
      submittable={submittable && isSubmittable}
      onValues={(values) => {
        const identifier = values.identifier
          ? normalizeIdentifier(values.identifier, domains)
          : undefined
        setIsSubmittable(!!identifier)
        formEl?.reset()
        return onValues?.({ identifier })
      }}
      handler={(values, signal) => {
        const identifier = normalizeIdentifier(values.identifier, domains)
        if (isIdentifier(identifier)) return handler({ identifier }, signal)
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
    </FormShell>
  )
}

function isUnknownAtprotoAccountErrorWithIssuer(
  error: unknown,
): error is UnknownAtprotoAccountError & {
  issuer: NonNullable<UnknownAtprotoAccountError['issuer']>
} {
  return error instanceof UnknownAtprotoAccountError && error.issuer != null
}
