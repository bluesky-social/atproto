import { zodResolver } from '@hookform/resolvers/zod'
import { Trans, useLingui } from '@lingui/react/macro'
import { AtSignIcon } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
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
import { type SignInValues, signInSchema } from '#/lib/form-schemas.ts'
import { isValidDomain } from '#/lib/handle.ts'

export type SignInData = {
  username: string
  password: string
  remember?: boolean
  emailOtp?: string
}

export type SignInFormProps = Omit<
  FormShellProps<SignInValues>,
  'form' | 'onSubmit' | 'submitLabel'
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

  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    mode: 'onBlur',
    defaultValues: {
      username: usernameDefault,
      password: '',
      remember: rememberDefault,
      otp: '',
    },
  })

  const { control, setValue, getValues } = form
  const otp = useWatch({ control, name: 'otp' })

  const clearSecondFactor = useCallback(() => {
    setValue('otp', '')
    setSecondFactorError(null)
  }, [setValue])

  return (
    <FormShell
      {...props}
      form={form}
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
          remember: !disableRemember && values.remember,
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
        control={control}
        name="username"
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
        disabled={usernameReadonly}
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
            setValue('username', `${value}${domains[0]}`)
          }
        }}
      />

      <PasswordField
        control={control}
        name="password"
        label={<Trans>Password</Trans>}
        enterKeyHint={secondFactorError ? 'next' : 'done'}
        autoFocus={usernameReadonly}
        required
        onBlur={() => clearSecondFactor()}
        append={
          onForgotPassword && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-sm"
              onClick={() => {
                const value = getValues('username')
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
          control={control}
          name="remember"
          label={<Trans>Remember this account on this device</Trans>}
        />
      )}

      {secondFactorError && (
        <div key="2fa">
          <TokenField
            control={control}
            name="otp"
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
