import { Trans, useLingui } from '@lingui/react/macro'
import { AtIcon } from '@phosphor-icons/react'
import { Ref, useCallback, useRef, useState } from 'react'
import { Button } from '#/components/forms/button.tsx'
import { FormField } from '#/components/forms/form-field.tsx'
import { InputCheckbox } from '#/components/forms/input-checkbox.tsx'
import { InputPassword } from '#/components/forms/input-password.tsx'
import { InputText } from '#/components/forms/input-text.tsx'
import { InputToken } from '#/components/forms/input-token.tsx'
import { FormHandler, SmartForm } from '#/components/forms/smart-form.tsx'
import { Admonition } from '#/components/utils/admonition.tsx'
import { useMergedRefs } from '#/hooks/use-merged-refs.ts'
import {
  InvalidCredentialsError,
  SecondAuthenticationFactorRequiredError,
} from '#/lib/api.ts'
import { isValidDomain } from '#/lib/handle.ts'
import { Override } from '#/lib/util.ts'
import { FormCardProps } from './forms/form-card.tsx'

export type SignInData = {
  username: string
  password: string
  remember?: boolean
  emailOtp?: string
}

export type SignInValues = {
  username: string
  password: string
  remember?: boolean
  otp?: string | null
}

export type SignInFormProps = Override<
  FormCardProps,
  {
    usernameDefault?: string
    usernameReadonly?: boolean
    rememberDefault?: boolean
    disableRemember?: boolean
    domains?: readonly string[]

    onForgotPassword?: (emailHint?: string) => void
    onSignIn: (
      data: SignInData,
      signal: AbortSignal,
    ) => void | PromiseLike<void>

    ref?: Ref<FormHandler<SignInData, SignInValues>>
  }
>

export function SignInForm({
  usernameDefault = '',
  usernameReadonly = false,
  rememberDefault = false,
  disableRemember = false,
  domains: availableDomains = [],

  onForgotPassword,
  onSignIn,

  // FormCard
  ...props
}: SignInFormProps) {
  const { t } = useLingui()
  const ref = useRef<FormHandler<SignInData, SignInValues> | null>(null)
  const refMerged = useMergedRefs(props.ref, ref)
  const domains = availableDomains.filter(isValidDomain)

  const [secondFactorError, setSecondFactorError] =
    useState<null | SecondAuthenticationFactorRequiredError>(null)

  const clearSecondFactor = useCallback(() => {
    ref.current?.set('otp', null)
    setSecondFactorError(null)
  }, [])

  return (
    <SmartForm
      {...props}
      ref={refMerged}
      submitLabel={
        secondFactorError ? (
          <Trans context="verb">Confirm</Trans>
        ) : (
          <Trans context="verb">Sign in</Trans>
        )
      }
      values={{
        username: usernameDefault,
        password: '',
        remember: rememberDefault,
        otp: null as string | null,
      }}
      onValues={(next, prev) => {
        if (
          prev.username !== next.username ||
          prev.password !== next.password
        ) {
          clearSecondFactor()
        }
      }}
      validate={(values): undefined | SignInData => {
        const { username, password, otp, remember } = values

        if (!username || !password) return
        if (secondFactorError && !otp) return

        return {
          username,
          password,
          remember: !disableRemember && remember,
          ...(secondFactorError && otp
            ? { [secondFactorError.type]: otp }
            : {}),
        }
      }}
      handler={async (data: SignInData, signal) => {
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
      fields={({ values, loading, set, setterFor }) => (
        <>
          <FormField disabled={loading} label={<Trans>Identifier</Trans>}>
            <InputText
              icon={<AtIcon aria-hidden weight="bold" className="w-5" />}
              name="username"
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
              disabled={usernameReadonly}
              autoFocus={!usernameReadonly}
              // email, handle (full domain), or DID
              pattern="([^@]+@[^@]+|[^.@]+(\.[^.@]+)+)|did:[a-z0-9]+:.+"
              value={values.username}
              onChange={(event) => set('username', event.target.value)}
              onBlur={(event) => {
                if (usernameReadonly) return
                let value = event.target.value.trim().toLowerCase()
                if (value.startsWith('@')) {
                  value = value.slice(1)
                }
                if (
                  value.length > 0 &&
                  !value.startsWith('did:') &&
                  !value.includes('@') &&
                  !value.includes('.') &&
                  domains.length > 0
                ) {
                  set('username', `${value}${domains[0]}`)
                }
              }}
            />
          </FormField>

          <FormField disabled={loading} label={<Trans>Password</Trans>}>
            <InputPassword
              name="password"
              defaultValue={values.password}
              onPassword={setterFor('password')}
              append={
                onForgotPassword && (
                  <Button
                    className="text-sm"
                    type="button"
                    color="darkGrey"
                    onClick={() => {
                      onForgotPassword(
                        values.username?.includes('@')
                          ? values.username
                          : undefined,
                      )
                    }}
                    aria-label={t`Reset your password`}
                  >
                    <Trans>Forgot?</Trans>
                  </Button>
                )
              }
              enterKeyHint={secondFactorError ? 'next' : 'done'}
              disabled={loading}
              autoFocus={usernameReadonly}
              required
            />
          </FormField>

          <Admonition role="note" title={<Trans>Warning</Trans>}>
            <Trans>
              Verify the website address before entering your password. Only
              sign in on sites you recognize and trust.
            </Trans>
          </Admonition>

          {!disableRemember && (
            <InputCheckbox
              name="remember"
              title={t`Remember this account on this device`}
              enterKeyHint={secondFactorError ? 'next' : 'done'}
              checked={values.remember}
              onChange={(event) => set('remember', event.target.checked)}
            >
              <Trans>Remember this account on this device</Trans>
            </InputCheckbox>
          )}

          {secondFactorError && (
            <FormField
              key="2fa"
              disabled={loading}
              label={<Trans>2FA Confirmation</Trans>}
            >
              <div>
                <InputToken
                  title={t`Confirmation code`}
                  enterKeyHint="done"
                  required
                  autoFocus={true}
                  defaultValue={values.otp ?? ''}
                  onToken={setterFor('otp')}
                />

                <p className="text-text-light text-sm">
                  <Trans>
                    Check your {secondFactorError.hint} email for a login code
                    and enter it here.
                  </Trans>
                </p>
              </div>
            </FormField>
          )}
        </>
      )}
    />
  )
}
