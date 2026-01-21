import { Trans, useLingui } from '@lingui/react/macro'
import { ReactNode, useCallback, useRef, useState } from 'react'
import { Button } from '../../../components/forms/button.tsx'
import { Fieldset } from '../../../components/forms/fieldset.tsx'
import {
  FormCardAsync,
  FormCardAsyncProps,
} from '../../../components/forms/form-card-async.tsx'
import { InputCheckbox } from '../../../components/forms/input-checkbox.tsx'
import { InputPassword } from '../../../components/forms/input-password.tsx'
import { InputText } from '../../../components/forms/input-text.tsx'
import { InputToken } from '../../../components/forms/input-token.tsx'
import { Admonition } from '../../../components/utils/admonition.tsx'
import { AtSymbolIcon } from '../../../components/utils/icons.tsx'
import { AsyncActionController } from '../../../hooks/use-async-action.ts'
import {
  InvalidCredentialsError,
  SecondAuthenticationFactorRequiredError,
} from '../../../lib/api.ts'
import { mergeRefs } from '../../../lib/ref.ts'
import { Override } from '../../../lib/util.ts'

export type SignInFormOutput = {
  username: string
  password: string
  remember?: boolean
}

export type SignInFormProps = Override<
  Omit<FormCardAsyncProps, 'append' | 'onCancel'>,
  {
    usernameDefault?: string
    usernameReadonly?: boolean
    rememberDefault?: boolean

    onBack?: () => void
    backLabel?: ReactNode
    onForgotPassword?: (emailHint?: string) => void
    onSubmit: (
      credentials: SignInFormOutput,
      signal: AbortSignal,
    ) => void | PromiseLike<void>
  }
>

export function SignInForm({
  usernameDefault = '',
  usernameReadonly = false,
  rememberDefault = false,

  onSubmit,
  onBack,
  backLabel,
  onForgotPassword,

  // FormCardAsync
  ref,
  invalid,
  children,
  ...props
}: SignInFormProps) {
  const { t } = useLingui()

  const [username, setUsername] = useState<string>(usernameDefault)
  const [password, setPassword] = useState<string>('')
  const [remember, setRemember] = useState<boolean>(rememberDefault)
  const [otp, setOtp] = useState<string | null>(null)

  const [secondFactor, setSecondFactor] =
    useState<null | SecondAuthenticationFactorRequiredError>(null)

  const [loading, setLoading] = useState(false)

  const formRef = useRef<AsyncActionController>(null)

  const clearSecondFactor = useCallback(() => {
    setOtp(null)
    setSecondFactor(null)
  }, [setOtp, setSecondFactor])

  const resetState = useCallback(() => {
    clearSecondFactor()
    formRef.current?.reset()
  }, [clearSecondFactor, formRef])

  const doSubmit = useCallback(
    async (signal: AbortSignal) => {
      try {
        await onSubmit(
          {
            username,
            password,
            remember,
            ...(secondFactor ? { [secondFactor.type]: otp } : {}),
          },
          signal,
        )
      } catch (err) {
        if (signal.aborted) {
          // If the action was aborted, ignore the error
          return
        }

        if (err instanceof SecondAuthenticationFactorRequiredError) {
          setSecondFactor(err)

          // Do not re-throw 2FA required error to prevent the form from from
          // displaying it. Instead, we handle the error by showing the second
          // factor form.
          return
        }

        if (err instanceof InvalidCredentialsError) {
          // If the username/password are not valid, clear the second factor
          // as valid credentials are a pre-requisite for 2FA.
          clearSecondFactor()
        }

        // Any thrown err will be displayed through the form's errorRender
        throw err
      }
    },
    [username, password, remember, secondFactor, otp, onSubmit],
  )

  return (
    <FormCardAsync
      {...props}
      ref={mergeRefs([ref, formRef])}
      onLoading={setLoading}
      onCancel={onBack}
      cancelLabel={backLabel ?? t`Back`}
      append={children}
      invalid={
        invalid || !username || !password || (secondFactor != null && !otp)
      }
      submitLabel={
        secondFactor ? (
          <Trans context="verb">Confirm</Trans>
        ) : (
          <Trans context="verb">Sign in</Trans>
        )
      }
      onSubmit={doSubmit}
    >
      <Fieldset disabled={loading} label={<Trans>Identifier</Trans>}>
        <InputText
          icon={<AtSymbolIcon className="w-5" />}
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
          value={username}
          onChange={(event) => {
            resetState()
            setUsername(event.target.value)
          }}
        />
      </Fieldset>

      <Fieldset disabled={loading} label={<Trans>Password</Trans>}>
        <InputPassword
          name="password"
          onChange={(event) => {
            resetState()
            setPassword(event.target.value)
          }}
          append={
            onForgotPassword && (
              <Button
                className="text-sm"
                type="button"
                onClick={() => {
                  onForgotPassword(
                    username?.includes('@') ? username : undefined,
                  )
                }}
                aria-label={t`Reset your password`}
              >
                <Trans>Forgot?</Trans>
              </Button>
            )
          }
          enterKeyHint={secondFactor ? 'next' : 'done'}
          disabled={loading}
          autoFocus={usernameReadonly}
          required
        />
      </Fieldset>

      <Admonition role="alert" title={<Trans>Warning</Trans>}>
        <Trans>
          Please verify the domain name of the website before entering your
          password. Never enter your password on a domain you do not trust.
        </Trans>
      </Admonition>

      <InputCheckbox
        name="remember"
        title={t`Remember this account on this device`}
        enterKeyHint={secondFactor ? 'next' : 'done'}
        checked={remember}
        onChange={(event) => setRemember(event.target.checked)}
      >
        <Trans>Remember this account on this device</Trans>
      </InputCheckbox>

      {secondFactor && (
        <Fieldset
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
              value={otp ?? ''}
              onToken={setOtp}
            />

            <p className="text-sm text-slate-600 dark:text-slate-400">
              <Trans>
                Check your {secondFactor.hint} email for a login code and enter
                it here.
              </Trans>
            </p>
          </div>
        </Fieldset>
      )}
    </FormCardAsync>
  )
}
