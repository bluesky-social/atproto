import { useCallback, useRef, useState } from 'react'
import { Button } from '../../../components/forms/button'
import { Fieldset } from '../../../components/forms/fieldset'
import {
  FormCardAsync,
  FormCardAsyncProps,
} from '../../../components/forms/form-card-async'
import { InputCheckbox } from '../../../components/forms/input-checkbox'
import { InputInfoCard } from '../../../components/forms/input-info-card'
import { InputPassword } from '../../../components/forms/input-password'
import { InputText } from '../../../components/forms/input-text'
import { InputToken } from '../../../components/forms/input-token'
import { ExpandTransition } from '../../../components/utils/expand-transition'
import { AtSymbolIcon } from '../../../components/utils/icons'
import { AsyncActionController } from '../../../hooks/use-async-action'
import {
  InvalidCredentialsError,
  SecondAuthenticationFactorRequiredError,
} from '../../../lib/api'
import { mergeRefs } from '../../../lib/ref'
import { Override } from '../../../lib/util'

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
  onForgotPassword,

  // FormCardAsync
  ref,
  invalid,
  children,
  ...props
}: SignInFormProps) {
  const [username, setUsername] = useState<string>(usernameDefault)
  const [password, setPassword] = useState<string>('')
  const [remember, setRemember] = useState<boolean>(rememberDefault)
  const [otp, setOtp] = useState<string | null>(null)

  const [secondFactor, setSecondFactor] =
    useState<null | SecondAuthenticationFactorRequiredError>(null)

  const [pwdFocus, setPwdFocus] = useState(false)
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

        // Any thrown err will be displayed through the form's errorSlot
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
      cancelLabel="Back"
      append={children}
      invalid={
        invalid || !username || !password || (secondFactor != null && !otp)
      }
      onSubmit={doSubmit}
    >
      <Fieldset label="Account" disabled={loading}>
        <InputText
          icon={<AtSymbolIcon className="w-5" />}
          name="username"
          type="text"
          placeholder="Username or email address"
          aria-label="Username or email address"
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="username"
          spellCheck="false"
          dir="auto"
          enterKeyHint="next"
          required
          readOnly={usernameReadonly}
          disabled={usernameReadonly}
          title="valid email address or username"
          autoFocus
          value={username}
          onChange={(event) => {
            resetState()
            setUsername(event.target.value)
          }}
        />
      </Fieldset>

      <InputPassword
        name="password"
        onChange={(event) => {
          resetState()
          setPassword(event.target.value)
        }}
        onFocus={() => setPwdFocus(true)}
        onBlur={() => setTimeout(setPwdFocus, 100, false)}
        append={
          onForgotPassword && (
            <Button
              className="text-sm"
              type="button"
              onClick={() => {
                onForgotPassword(username?.includes('@') ? username : undefined)
              }}
            >
              Forgot?
            </Button>
          )
        }
        enterKeyHint={secondFactor ? 'next' : 'done'}
        disabled={loading}
        required
      />

      <ExpandTransition visible={pwdFocus}>
        <InputInfoCard role="status">
          <p className="font-bold text-brand leading-8">Warning</p>
          <p>
            Please verify the domain name of the website before entering your
            password. Never enter your password on a domain you do not trust.
          </p>
        </InputInfoCard>
      </ExpandTransition>

      <Fieldset key="remember" label="Session" disabled={loading}>
        <InputCheckbox
          name="remember"
          aria-label="Remember this account on this device"
          enterKeyHint={secondFactor ? 'next' : 'done'}
          checked={remember}
          onChange={(event) => setRemember(event.target.checked)}
        >
          Remember this account on this device
        </InputCheckbox>
      </Fieldset>

      {secondFactor && (
        <Fieldset key="2fa" label="2FA Confirmation" disabled={loading}>
          <div>
            <InputToken
              aria-label="Confirmation code"
              enterKeyHint="done"
              required
              autoFocus={true}
              value={otp ?? ''}
              onToken={setOtp}
            />

            <p className="text-slate-600 dark:text-slate-400 text-sm">
              Check your {secondFactor.hint} email for a login code and enter it
              here.
            </p>
          </div>
        </Fieldset>
      )}
    </FormCardAsync>
  )
}
