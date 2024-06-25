import {
  FormHTMLAttributes,
  ReactNode,
  SyntheticEvent,
  useCallback,
  useState,
} from 'react'

import { clsx } from '../lib/clsx'
import { ErrorCard } from './error-card'

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
  title = 'Sign in',

  onSubmit,
  submitAria = 'Next',
  submitLabel = submitAria,

  onCancel = undefined,
  cancelAria = 'Cancel',
  cancelLabel = cancelAria,

  usernameDefault = '',
  usernameReadonly = false,
  usernameLabel = 'Email address or handle',
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
      <p className="text-sm">
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
      <p className="font-medium p-4">{title}</p>
      <fieldset
        className="rounded-md border border-solid border-slate-200 dark:border-slate-700 text-neutral-700 dark:text-neutral-100"
        disabled={loading}
      >
        <div className="relative p-1 flex flex-wrap items-center justify-stretch">
          <span className="w-8 text-center text-base leading-[1.6]">@</span>
          <input
            name="username"
            type="text"
            onChange={() => setErrorMessage(null)}
            className="relative m-0 block w-[1px] min-w-0 flex-auto px-3 py-[0.25rem] leading-[1.6] bg-transparent bg-clip-padding text-base text-inherit outline-none dark:placeholder:text-neutral-100 disabled:text-gray-500"
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
        </div>

        <hr className="border-slate-200 dark:border-slate-700" />

        <div className="relative p-1 flex flex-wrap items-center justify-stretch">
          <span className="w-8 text-center text-2xl leading-[1.6]">*</span>
          <input
            name="password"
            type="password"
            onChange={() => setErrorMessage(null)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(setFocused, 100, false)}
            className="relative m-0 block w-[1px] min-w-0 flex-auto px-3 py-[0.25rem] leading-[1.6] bg-transparent bg-clip-padding text-base text-inherit outline-none dark:placeholder:text-neutral-100"
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
        </div>

        {passwordWarning && (
          <>
            <hr
              className="border-slate-200 dark:border-slate-700 transition-all"
              style={{ borderTopWidth: focused ? '1px' : '0px' }}
            />
            <div
              className="bg-slate-100 dark:bg-slate-800 overflow-hidden transition-all"
              style={{
                display: 'grid',
                gridTemplateRows: focused ? '1fr' : '0fr',
              }}
            >
              <div className="flex items-center justify-start overflow-hidden">
                <div className="py-1 px-2">
                  <svg
                    className="fill-current h-4 w-4 text-error"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                  >
                    <path d="M2.93 17.07A10 10 0 1 1 17.07 2.93 10 10 0 0 1 2.93 17.07zm12.73-1.41A8 8 0 1 0 4.34 4.34a8 8 0 0 0 11.32 11.32zM9 11V9h2v6H9v-4zm0-6h2v2H9V5z" />
                  </svg>
                </div>
                <div className="py-2 px-4">{passwordWarning}</div>
              </div>
            </div>
          </>
        )}

        {rememberVisible && (
          <>
            <hr className="border-slate-200 dark:border-slate-700" />

            <div className="relative p-1 flex flex-wrap items-center justify-stretch">
              <span className="w-8 flex items-center justify-center">
                <input
                  className="text-primary"
                  id="remember"
                  name="remember"
                  type="checkbox"
                  defaultChecked={rememberDefault}
                  aria-label={rememberAria}
                  onChange={() => setErrorMessage(null)}
                />
              </span>

              <label
                htmlFor="remember"
                className="relative m-0 block w-[1px] min-w-0 flex-auto px-3 py-[0.25rem] leading-[1.6]"
              >
                {rememberLabel}
              </label>
            </div>
          </>
        )}
      </fieldset>

      {errorMessage && <ErrorCard className="mt-4" message={errorMessage} />}

      <div className="flex-auto" />

      <div className="p-4 flex flex-wrap items-center justify-start">
        <button
          className="py-2 bg-transparent text-primary rounded-md font-semibold order-last"
          type="submit"
          role="Button"
          aria-label={submitAria}
          disabled={loading}
        >
          {submitLabel}
        </button>

        {onCancel && (
          <button
            className="py-2 bg-transparent text-primary rounded-md font-light"
            type="button"
            role="Button"
            aria-label={cancelAria}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
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
