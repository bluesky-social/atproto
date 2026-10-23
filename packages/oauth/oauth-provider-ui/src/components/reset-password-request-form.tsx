import { Trans } from '@lingui/react/macro'
import { useRef, useState } from 'react'
import { IdentifierField } from '#/components/forms/fields/identifier-field.tsx'
import {
  FormShell,
  type FormShellProps,
} from '#/components/forms/form-shell.tsx'
import { mergeRefs } from '#/hooks/use-merged-refs'
import { UnknownAtprotoAccountError } from '#/lib/api'
import { IDENTIFIER_REGEX, normalizeIdentifier } from '#/lib/form-patterns'
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
  ref,
  onValues,
  submittable = true,
  ...props
}: ResetPasswordRequestFormProps) {
  const [isSubmittable, setIsSubmittable] = useState(!!hint)
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <FormShell<{
      identifier: string
    }>
      {...props}
      ref={mergeRefs(formRef, ref)}
      submittable={submittable && isSubmittable}
      onValues={(values) => {
        const identifier = values.identifier
          ? normalizeIdentifier(values.identifier, domains)
          : undefined
        setIsSubmittable(!!identifier)
        formRef.current?.reset()
        return onValues?.({ identifier })
      }}
      handler={(values, signal) => {
        const identifier = normalizeIdentifier(values.identifier, domains)
        if (IDENTIFIER_REGEX.test(identifier)) {
          return handler({ identifier }, signal)
        }
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
