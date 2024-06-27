import { ReactNode, SyntheticEvent, useCallback, useState } from 'react'

import { clsx } from '../lib/clsx'
import { Override } from '../lib/util'
import { Button } from './button'
import { FormCard, FormCardProps } from './form-card'
import { AtSymbolIcon } from './icons/at-symbol-icon'
import { LockIcon } from './icons/lock-icon'
import { InfoCard } from './info-card'
import { InputCheckbox } from './input-checkbox'
import { InputText } from './input-text'

export type SignInFormOutput = {
  username: string
  password: string
  remember?: boolean
}

export type SignInFormProps = Override<
  FormCardProps,
  {
    title?: ReactNode

    onSubmit: (credentials: SignInFormOutput) => void | PromiseLike<void>
    submitLabel?: ReactNode
    submitAria?: string

    onCancel?: () => void
    cancelLabel?: ReactNode
    cancelAria?: string

    usernameDefault?: string
    usernameReadonly?: boolean
    usernameLabel?: string
    usernamePlaceholder?: string
    usernameAria?: string
    usernamePattern?: string
    usernameTitle?: string

    passwordLabel?: string
    passwordPlaceholder?: string
    passwordWarning?: ReactNode
    passwordAria?: string
    passwordPattern?: string
    passwordTitle?: string

    rememberVisible?: boolean
    rememberDefault?: boolean
    rememberLabel?: string
    rememberAria?: string
  }
>

export function SignInForm({
  title = 'Account',

  onSubmit,
  submitAria = 'Next',
  submitLabel = submitAria,

  onCancel = undefined,
  cancelAria = 'Cancel',
  cancelLabel = cancelAria,

  usernameDefault = '',
  usernameReadonly = false,
  usernameLabel = 'Username or email address',
  usernameAria = usernameLabel,
  usernamePlaceholder = usernameLabel,
  usernamePattern,
  usernameTitle = 'Username must not be empty',

  passwordLabel = 'Password',
  passwordAria = passwordLabel,
  passwordPlaceholder = passwordLabel,
  passwordPattern,
  passwordTitle = 'Password must not be empty',
  passwordWarning = (
    <>
      <p className="font-bold text-brand leading-8">Warning</p>
      <p>
        Please verify the domain name of the website before entering your
        password. Never enter your password on a domain you do not trust.
      </p>
    </>
  ),

  rememberVisible = true,
  rememberDefault = false,
  rememberLabel = 'Remember this account on this device',
  rememberAria = rememberLabel,

  ...props
}: SignInFormProps) {
  const [focused, setFocused] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const doSubmit = useCallback(
    async (
      event: SyntheticEvent<
        HTMLFormElement & {
          username: HTMLInputElement
          password: HTMLInputElement
          remember?: HTMLInputElement
        },
        SubmitEvent
      >,
    ) => {
      event.preventDefault()

      const credentials = {
        username: event.currentTarget.username.value,
        password: event.currentTarget.password.value,
        remember: event.currentTarget.remember?.checked,
      }

      setLoading(true)
      setErrorMessage(null)
      try {
        await onSubmit(credentials)
      } catch (err) {
        setErrorMessage(parseErrorMessage(err))
      } finally {
        setLoading(false)
      }
    },
    [onSubmit, setErrorMessage, setLoading],
  )

  return (
    <FormCard
      onSubmit={doSubmit}
      title={title}
      error={errorMessage}
      disabled={loading}
      cancel={
        onCancel && (
          <Button aria-label={cancelAria} onClick={onCancel}>
            {cancelLabel}
          </Button>
        )
      }
      actions={
        <Button
          color="brand"
          type="submit"
          aria-label={submitAria}
          loading={loading}
        >
          {submitLabel}
        </Button>
      }
      {...props}
    >
      <InputText
        icon={<AtSymbolIcon className="w-4" />}
        name="username"
        type="text"
        onChange={() => setErrorMessage(null)}
        placeholder={usernamePlaceholder}
        aria-label={usernameAria}
        autoCapitalize="none"
        autoCorrect="off"
        autoComplete="username"
        spellCheck="false"
        dir="auto"
        enterKeyHint="next"
        required
        defaultValue={usernameDefault}
        readOnly={usernameReadonly}
        disabled={usernameReadonly}
        pattern={usernamePattern}
        title={usernameTitle}
      />

      <InputText
        icon={<LockIcon className="w-4" />}
        name="password"
        type="password"
        onChange={() => setErrorMessage(null)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(setFocused, 100, false)}
        placeholder={passwordPlaceholder}
        aria-label={passwordAria}
        autoCapitalize="none"
        autoCorrect="off"
        autoComplete="current-password"
        dir="auto"
        enterKeyHint="done"
        spellCheck="false"
        required
        pattern={passwordPattern}
        title={passwordTitle}
      />

      {passwordWarning && (
        <div
          className={clsx(
            'transition-all delay-300 duration-300 overflow-hidden',
            focused ? 'max-h-36' : 'max-h-0 -z-10 !mt-0',
          )}
        >
          <InfoCard role="status">{passwordWarning}</InfoCard>
        </div>
      )}

      {rememberVisible && (
        <InputCheckbox
          name="remember"
          type="checkbox"
          defaultChecked={rememberDefault}
          aria-label={rememberAria}
          onChange={() => setErrorMessage(null)}
        >
          {rememberLabel}
        </InputCheckbox>
      )}
    </FormCard>
  )
}

function parseErrorMessage(err: unknown): string {
  console.error('Sign-in failed:', err)
  switch ((err as any)?.message) {
    case 'Invalid credentials':
      return 'Invalid username or password'
    default:
      return 'An unknown error occurred'
  }
}
