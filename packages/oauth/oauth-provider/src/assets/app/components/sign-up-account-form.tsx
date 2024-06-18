import {
  FormHTMLAttributes,
  ReactNode,
  SyntheticEvent,
  useCallback,
  useState,
} from 'react'

import { clsx } from '../lib/clsx'
import { ErrorCard } from './error-card'

export type SignUpAccountFormOutput = {
  username: string
  password: string
}

export type SignUpAccountFormProps = {
  onSubmit: (credentials: SignUpAccountFormOutput) => void | PromiseLike<void>
  submitLabel?: ReactNode
  submitAria?: string

  onCancel?: () => void
  cancelLabel?: ReactNode
  cancelAria?: string

  username?: string
  usernamePlaceholder?: string
  usernameLabel?: string
  usernameAria?: string
  usernamePattern?: string
  usernameTitle?: string

  passwordPlaceholder?: string
  passwordLabel?: string
  passwordAria?: string
  passwordPattern?: string
  passwordTitle?: string
}

export function SignUpAccountForm({
  onSubmit,
  submitAria = 'Next',
  submitLabel = submitAria,

  onCancel = undefined,
  cancelAria = 'Cancel',
  cancelLabel = cancelAria,

  username: defaultUsername = '',
  usernameLabel = 'Username',
  usernameAria = usernameLabel,
  usernamePlaceholder = usernameLabel,
  usernamePattern,
  usernameTitle,

  passwordLabel = 'Password',
  passwordAria = passwordLabel,
  passwordPlaceholder = passwordLabel,
  passwordPattern,
  passwordTitle,

  className,
  children,
  ...attrs
}: SignUpAccountFormProps &
  Omit<FormHTMLAttributes<HTMLFormElement>, keyof SignUpAccountFormProps>) {
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const doSubmit = useCallback(
    async (
      event: SyntheticEvent<
        HTMLFormElement & {
          username: HTMLInputElement
          password: HTMLInputElement
        },
        SubmitEvent
      >,
    ) => {
      event.preventDefault()

      const credentials = {
        username: event.currentTarget.username.value,
        password: event.currentTarget.password.value,
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
      <fieldset disabled={loading}>
        <label className="text-sm font-medium" htmlFor="username">
          {usernameLabel}
        </label>

        <div
          id="username"
          className="mb-4 relative flex flex-wrap items-center justify-stretch rounded-md border border-solid border-slate-200 dark:border-slate-700 text-neutral-700 dark:text-neutral-100"
        >
          <span className="w-6 ml-1 text-center text-base">@</span>
          <input
            name="username"
            type="text"
            onChange={() => setErrorMessage(null)}
            className="relative m-1 block w-[1px] min-w-0 flex-auto leading-[1.6] bg-transparent bg-clip-padding text-base text-inherit outline-none dark:placeholder:text-neutral-100 disabled:text-gray-500"
            placeholder={usernamePlaceholder}
            aria-label={usernameAria}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
            spellCheck="false"
            dir="auto"
            enterKeyHint="next"
            required
            defaultValue={defaultUsername}
            pattern={usernamePattern}
            title={usernameTitle}
          />
        </div>

        <label className="text-sm font-medium" htmlFor="password">
          {passwordLabel}
        </label>

        <div
          id="password"
          className="mb-4 relative flex flex-wrap items-center justify-stretch rounded-md border border-solid border-slate-200 dark:border-slate-700 text-neutral-700 dark:text-neutral-100"
        >
          <span className="w-6 ml-1 text-center text-2xl font-light -mb-2">
            *
          </span>
          <input
            name="password"
            type="password"
            onChange={() => setErrorMessage(null)}
            className="relative m-1 block w-[1px] min-w-0 flex-auto leading-[1.6] bg-transparent bg-clip-padding text-base text-inherit outline-none dark:placeholder:text-neutral-100"
            placeholder={passwordPlaceholder}
            aria-label={passwordAria}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="new-password"
            dir="auto"
            enterKeyHint="done"
            spellCheck="false"
            required
            pattern={passwordPattern}
            title={passwordTitle}
          />
        </div>
      </fieldset>

      {children && <div className="mt-4">{children}</div>}

      {errorMessage && <ErrorCard className="mt-2" message={errorMessage} />}

      <div className="flex-auto"></div>

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
  switch ((err as any)?.message) {
    case 'Invalid credentials':
      return 'Invalid username or password'
    default:
      console.error(err)
      return 'An unknown error occurred'
  }
}
