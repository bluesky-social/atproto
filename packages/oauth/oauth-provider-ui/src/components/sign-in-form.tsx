import { Trans, useLingui } from '@lingui/react/macro'
import { AtSignIcon } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { Notice } from '#/components/feedback/notice.tsx'
import { CheckboxField } from '#/components/forms/fields/checkbox-field.tsx'
import { PasswordField } from '#/components/forms/fields/password-field.tsx'
import { TextField } from '#/components/forms/fields/text-field.tsx'
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
import { SIGN_IN_IDENTIFIER_PATTERN } from '#/lib/form-patterns.ts'
import { isValidDomain } from '#/lib/handle.ts'

// @NOTE `username`, not `identifier`: the key becomes the rendered `name`,
// which is a public contract.
type Values = {
  username: string
  password: string
  remember?: string
  otp?: string
}

export type SignInData = {
  username: string
  password: string
  remember?: boolean
  emailOtp?: string
}

export type SignInFormProps = Omit<
  FormShellProps<Values>,
  'onSubmit' | 'submitLabel'
> & {
  usernameDefault?: string
  usernameReadonly?: boolean
  rememberDefault?: boolean
  disableRemember?: boolean
  domains?: readonly string[]

  onForgotPassword?: (emailHint?: string) => void
  onSignIn: (data: SignInData, signal: AbortSignal) => void | PromiseLike<void>
}

export function SignInForm({
  usernameDefault = '',
  usernameReadonly = false,
  rememberDefault = false,
  disableRemember = false,
  domains: availableDomains = [],

  onForgotPassword,
  onSignIn,

  ...props
}: SignInFormProps) {
  const { t } = useLingui()
  const domains = availableDomains.filter(isValidDomain)

  const [secondFactorError, setSecondFactorError] =
    useState<null | SecondAuthenticationFactorRequiredError>(null)

  const formRef = useRef<HTMLFormElement>(null)
  const [otp, setOtp] = useState('')

  const clearSecondFactor = useCallback(() => {
    setOtp('')
    setSecondFactorError(null)
  }, [])

  return (
    <FormShell<Values>
      {...props}
      ref={formRef}
      submitLabel={
        secondFactorError ? (
          <Trans context="verb">Confirm</Trans>
        ) : (
          <Trans context="verb">Sign in</Trans>
        )
      }
      // The second factor is only required once the server has asked for it,
      // which is component state rather than something the schema can express.
      submittable={!secondFactorError || Boolean(otp)}
      onSubmit={async (values, signal) => {
        const data: SignInData = {
          username: values.username,
          password: values.password,
          remember: !disableRemember && values.remember != null,
          ...(secondFactorError && values.otp
            ? { [secondFactorError.type]: values.otp }
            : {}),
        }

        // Wrap the handler to catch 2FA required errors and display the second
        // factor form instead of the error.
        try {
          await onSignIn(data, signal)
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
      <TextField
        name="username"
        defaultValue={usernameDefault}
        pattern={SIGN_IN_IDENTIFIER_PATTERN}
        label={<Trans>Identifier</Trans>}
        icon={<AtSignIcon className="size-5" />}
        type="text"
        title={t`Username or email address`}
        autoCapitalize="none"
        autoCorrect="off"
        autoComplete="username"
        spellCheck="false"
        dir="auto"
        enterKeyHint="next"
        required
        readOnly={usernameReadonly}
        // @NOTE readOnly, not disabled: a disabled control is omitted from the
        // form values entirely, which would submit without a username.
        autoFocus={!usernameReadonly}
        onBlur={(event) => {
          clearSecondFactor()
          if (usernameReadonly) return
          let value = event.target.value.trim().toLowerCase()
          if (value.startsWith('@')) value = value.slice(1)
          if (
            value.length > 0 &&
            !value.startsWith('did:') &&
            !value.includes('@') &&
            !value.includes('.') &&
            domains.length > 0
          ) {
            event.target.value = `${value}${domains[0]}`
          }
        }}
      />

      <PasswordField
        name="password"
        label={<Trans>Password</Trans>}
        enterKeyHint={secondFactorError ? 'next' : 'done'}
        autoFocus={usernameReadonly}
        required
        onBlur={() => clearSecondFactor()}
        labelAction={
          onForgotPassword && (
            <Button
              type="button"
              variant="link"
              className="text-foreground h-auto p-0 text-sm font-normal"
              onClick={() => {
                const value = formRef.current?.querySelector<HTMLInputElement>(
                  'input[name="username"]',
                )?.value
                onForgotPassword(value?.includes('@') ? value : undefined)
              }}
              aria-label={t`Reset your password`}
            >
              <Trans>Forgot?</Trans>
            </Button>
          )
        }
      />

      <Notice role="note" title={<Trans>Warning</Trans>}>
        <Trans>
          Verify the website address before entering your password. Only sign in
          on sites you recognize and trust.
        </Trans>
      </Notice>

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
            name="otp"
            value={otp}
            onChange={(event) => setOtp(event.currentTarget.value)}
            label={<Trans>2FA Confirmation</Trans>}
            title={t`Confirmation code`}
            enterKeyHint="done"
            required
            autoFocus
          />

          <p className="text-muted-foreground text-sm">
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
