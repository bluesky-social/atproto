import {
  FormHTMLAttributes,
  ReactNode,
  SyntheticEvent,
  useCallback,
  useState,
} from 'react'

import { clsx } from '../lib/clsx'
import { Button } from './button'
import { ErrorCard } from './error-card'
import { InputText } from './input-text'
import { InputCheckbox } from './input-checkbox'

export type SignInFormOutput = {
  username: string
  password: string
  remember?: boolean
}

export type SignInFormProps = {
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
      <p className="font-bold">Warning</p>
      <p className="">
        Please verify the domain name of the website before entering your
        password. Never enter your password on a domain you do not trust.
      </p>
    </>
  ),

  rememberVisible = true,
  rememberDefault = false,
  rememberLabel = 'Remember this account on this device',
  rememberAria = rememberLabel,

  className,
  ...attrs
}: SignInFormProps &
  Omit<
    FormHTMLAttributes<HTMLFormElement>,
    keyof SignInFormProps | 'children'
  >) {
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
    <form
      {...attrs}
      className={clsx('flex flex-col', className)}
      onSubmit={doSubmit}
    >
      <p className="font-medium mb-1 text-slate-600 dark:text-slate-400">
        {title}
      </p>

      <fieldset disabled={loading}>
        <InputText
          icon={
            <svg className="w-4" fill="currentColor" viewBox="0 0 24 24">
              <path
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M12 4a8 8 0 1 0 4.21 14.804 1 1 0 0 1 1.054 1.7A9.958 9.958 0 0 1 12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10c0 1.104-.27 2.31-.949 3.243-.716.984-1.849 1.6-3.331 1.465a4.207 4.207 0 0 1-2.93-1.585c-.94 1.21-2.388 1.94-3.985 1.715-2.53-.356-4.04-2.91-3.682-5.458.358-2.547 2.514-4.586 5.044-4.23.905.127 1.68.536 2.286 1.126a1 1 0 0 1 1.964.368l-.515 3.545v.002a2.222 2.222 0 0 0 1.999 2.526c.75.068 1.212-.21 1.533-.65.358-.493.566-1.245.566-2.067a8 8 0 0 0-8-8Zm-.112 5.13c-1.195-.168-2.544.819-2.784 2.529-.24 1.71.784 3.03 1.98 3.198 1.195.168 2.543-.819 2.784-2.529.24-1.71-.784-3.03-1.98-3.198Z"
              ></path>
            </svg>
          }
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
          className="mt-4"
          icon={
            <svg className="w-4" fill="currentColor" viewBox="0 0 24 24">
              <path
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M7 7a5 5 0 0 1 10 0v2h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h1V7Zm-1 4v9h12v-9H6Zm9-2H9V7a3 3 0 1 1 6 0v2Zm-3 4a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0v-3a1 1 0 0 1 1-1Z"
              ></path>
            </svg>
          }
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
          <ErrorCard
            className="my-2 transition-all overflow-hidden"
            style={{
              display: 'grid',
              gridTemplateRows: focused ? '1fr' : '0fr',
            }}
            role="status"
          >
            {passwordWarning}
          </ErrorCard>
        )}

        {rememberVisible && (
          <InputCheckbox
            className="mt-2"
            name="remember"
            type="checkbox"
            defaultChecked={rememberDefault}
            aria-label={rememberAria}
            onChange={() => setErrorMessage(null)}
          >
            {rememberLabel}
          </InputCheckbox>
        )}
      </fieldset>

      {errorMessage && <ErrorCard className="mt-4">{errorMessage}</ErrorCard>}

      <div className="flex-auto" />

      <div className="mt-4 flex flex-wrap items-center justify-start">
        <Button
          className="order-last"
          color="brand"
          type="submit"
          aria-label={submitAria}
          loading={loading}
        >
          {submitLabel}
        </Button>

        {onCancel && (
          <Button aria-label={cancelAria} onClick={onCancel}>
            {cancelLabel}
          </Button>
        )}

        <div className="flex-auto" />
      </div>
    </form>
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
