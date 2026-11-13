import { Trans, useLingui } from '@lingui/react/macro'
import { useCallback, useRef, useState } from 'react'
import { CheckboxField } from '#/components/forms/fields/checkbox-field.tsx'
import { IdentifierField } from '#/components/forms/fields/identifier-field.tsx'
import { PasswordField } from '#/components/forms/fields/password-field.tsx'
import { TokenField } from '#/components/forms/fields/token-field.tsx'
import {
  FormShell,
  type FormShellProps,
} from '#/components/forms/form-shell.tsx'
import { Button } from '#/components/ui/button.tsx'
import {
  InvalidCredentialsError,
  SecondAuthenticationFactorRequiredError,
} from '#/lib/api.ts'
import { normalizeIdentifier } from '#/lib/form-patterns.ts'
import { isValidDomain } from '#/lib/handle.ts'
import type { Override } from '#/lib/util'

export type SignInData = {
  identifier: string
  password: string
  remember?: boolean
  emailOtp?: string
}

export type SignInFormProps = Override<
  FormShellProps<SignInData>,
  {
    identifierDefault?: string
    identifierReadonly?: boolean
    rememberDefault?: boolean
    disableRemember?: boolean
    domains?: readonly string[]

    onValues?: never
    onForgotPassword?: (emailHint?: string) => void
  }
>

export function SignInForm({
  identifierDefault = '',
  identifierReadonly = false,
  rememberDefault = false,
  disableRemember = false,
  domains: availableDomains = [],

  onForgotPassword,
  handler,

  // FormShellProps
  submittable = true,
  submitLabel,
  ...props
}: SignInFormProps) {
  const { t } = useLingui()
  const domains = availableDomains.filter(isValidDomain)

  const [secondFactorError, setSecondFactorError] =
    useState<null | SecondAuthenticationFactorRequiredError>(null)

  const [emailOtp, setEmailOtp] = useState('')

  const prevValuesRef = useRef<{
    identifier?: string
    password?: string
  }>({})
  const clearSecondFactor = useCallback(() => {
    setEmailOtp('')
    setSecondFactorError(null)
  }, [])

  return (
    <FormShell<{
      identifier: string
      password: string
      remember?: 'on'
      emailOtp?: string
    }>
      {...props}
      submitLabel={
        submitLabel ??
        (secondFactorError ? (
          <Trans context="verb">Confirm</Trans>
        ) : (
          <Trans context="verb">Sign in</Trans>
        ))
      }
      // The second factor is only required once the server has asked for it,
      // which is component state rather than something the schema can express.
      submittable={submittable && (!secondFactorError || Boolean(emailOtp))}
      onValues={(next) => {
        const prev = prevValuesRef.current
        prevValuesRef.current = next
        if (
          next.password !== prev.password ||
          next.identifier !== prev.identifier
        ) {
          clearSecondFactor()
        }
      }}
      handler={async (values, signal) => {
        const data: SignInData = {
          identifier: normalizeIdentifier(values.identifier, domains),
          password: values.password,
        }

        if (!disableRemember) {
          data.remember = values.remember != null
        } else {
          // allow the server to determine the default remember behavior (based
          // on the list of accounts signed into the device)
        }

        if (secondFactorError && values.emailOtp) {
          data[secondFactorError.type] = values.emailOtp
        }

        // Wrap the handler to catch 2FA required errors and display the second
        // factor form instead of the error.
        try {
          return await handler(data, signal)
        } catch (err) {
          if (err instanceof SecondAuthenticationFactorRequiredError) {
            setSecondFactorError(err)

            // Prevent rethrowing (avoiding to display an error message) unless
            // the error regards the same 2FA type and hint as the current one,
            // in which case it means the provided OTP was incorrect and should
            // be displayed as an error message on the form.
            const shouldThrow =
              secondFactorError != null &&
              secondFactorError.hint === err.hint &&
              secondFactorError.type === err.type

            if (!shouldThrow) return
          } else if (err instanceof InvalidCredentialsError) {
            // If the username/password are not valid, clear the second factor
            // as valid credentials are a pre-requisite for 2FA.
            clearSecondFactor()
          }

          // Any thrown err will be displayed by the form
          throw err
        }
      }}
    >
      <IdentifierField
        name="identifier"
        domains={domains}
        defaultValue={identifierDefault}
        enterKeyHint="next"
        required
        // @NOTE readOnly, not disabled: a disabled control is omitted from the
        // form values entirely, which would submit without a username.
        readOnly={identifierReadonly}
        autoFocus={!identifierReadonly}
      />

      <PasswordField
        name="password"
        label={<Trans>Password</Trans>}
        placeholder={t`Enter your password`}
        enterKeyHint={secondFactorError ? 'next' : 'done'}
        autoFocus={identifierReadonly}
        required
        labelAction={
          onForgotPassword && (
            <Button
              type="button"
              variant="link"
              className="text-foreground h-auto p-0 text-sm font-normal"
              onClick={(event) => {
                const { form } = event.currentTarget
                const formData = form ? new FormData(form) : null
                const identifier = formData?.get('identifier')
                const hint =
                  typeof identifier === 'string' // not a File / null / undefined
                    ? normalizeIdentifier(identifier, domains)
                    : undefined
                onForgotPassword(hint)
              }}
              aria-label={t`Reset your password`}
            >
              <Trans>Forgot?</Trans>
            </Button>
          )
        }
      />

      {/* @NOTE A quiet line rather than a boxed alert: the phishing reminder
        should be read once, not compete with the fields. */}
      <p role="note" className="text-muted-foreground text-sm leading-snug">
        <Trans>Only enter your password on sites you trust.</Trans>
      </p>

      {!disableRemember && (
        <CheckboxField
          name="remember"
          defaultChecked={rememberDefault}
          label={<Trans>Remember this account on this device</Trans>}
        />
      )}

      {secondFactorError && (
        <div key="2fa">
          <TokenField
            name="emailOtp"
            value={emailOtp}
            onChange={(event) => setEmailOtp(event.currentTarget.value)}
            label={<Trans>2FA Confirmation</Trans>}
            title={t`Confirmation code`}
            enterKeyHint="done"
            required
            autoFocus
            // @TODO If we ever support "totp", adapt the check here:
            data-1p-ignore={secondFactorError.type === 'emailOtp'}
          />

          <p className="text-muted-foreground mt-3 text-sm leading-snug">
            <Trans>
              Check your {secondFactorError.hint} email for a login code and
              enter it here.
            </Trans>
          </p>
        </div>
      )}
    </FormShell>
  )
}
