import {
  ReactNode,
  useCallback,
  useState,
  type FormHTMLAttributes,
} from 'react'
import { clsx } from '../lib/clsx'
import { ErrorCard } from './error-card'

export type SignInFormOutput = {
  username: string
  password: string
  remember: boolean
}

export type SignInFormProps = {
  onSubmit: (credentials: SignInFormOutput) => void | Promise<void>
  onCancel?: () => void
  submitLabel?: ReactNode
  cancelLabel?: ReactNode
  username?: string
  usernameReadonly?: boolean
  remember?: boolean
}

export function SignInForm({
  onSubmit,
  onCancel = undefined,
  submitLabel = 'Continue',
  cancelLabel = 'Cancel',
  username = '',
  usernameReadonly = false,
  remember = false,

  className,
  ...attrs
}: SignInFormProps &
  Omit<FormHTMLAttributes<HTMLFormElement>, keyof SignInFormProps>) {
  const [focused, setFocused] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const doSubmit = useCallback(
    async (
      event: React.SyntheticEvent<
        HTMLFormElement & {
          username: HTMLInputElement
          password: HTMLInputElement
          remember: HTMLInputElement
        },
        SubmitEvent
      >,
    ) => {
      event.preventDefault()
      setLoading(true)
      setErrorMessage(null)
      try {
        await onSubmit({
          username: event.currentTarget.username.value,
          password: event.currentTarget.password.value,
          remember: event.currentTarget.remember.checked,
        })
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
      <p className="font-medium p-4">Sign in</p>
      <fieldset
        className="rounded-md border border-solid border-slate-200 dark:border-slate-700 text-neutral-700 dark:text-neutral-100 shadow-md"
        disabled={loading}
      >
        <div className="relative p-1 flex flex-wrap items-center justify-stretch">
          <span className="w-8 text-center text-base leading-[1.6]">@</span>
          <input
            name="username"
            type="text"
            className="relative m-0 block w-[1px] min-w-0 flex-auto px-3 py-[0.25rem] leading-[1.6] bg-transparent bg-clip-padding text-base text-inherit outline-none dark:placeholder:text-neutral-100 disabled:text-gray-500"
            placeholder="Username or email address"
            aria-label="Username or email address"
            required
            defaultValue={username}
            readOnly={usernameReadonly}
            disabled={usernameReadonly}
            onChange={() => setErrorMessage(null)}
          />
        </div>

        <hr className="border-slate-200 dark:border-slate-700" />

        <div className="relative p-1 flex flex-wrap items-center justify-stretch">
          <span className="w-8 text-center text-2xl leading-[1.6]">*</span>
          <input
            name="password"
            type="password"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={() => setErrorMessage(null)}
            className="relative m-0 block w-[1px] min-w-0 flex-auto px-3 py-[0.25rem] leading-[1.6] bg-transparent bg-clip-padding text-base text-inherit outline-none dark:placeholder:text-neutral-100"
            placeholder="Password"
            aria-label="Password"
            required
          />
        </div>

        <hr
          className="border-slate-200 dark:border-slate-700 transition-all"
          style={{ borderTopWidth: focused ? '1px' : '0px' }}
        />

        <div
          className="bg-slate-100 dark:bg-slate-800 overflow-hidden transition-all"
          style={{ display: 'grid', gridTemplateRows: focused ? '1fr' : '0fr' }}
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
            <div className="py-2 px-4">
              <p className="font-bold">Warning</p>
              <p className="text-sm">
                Please verify the domain name of the website before entering
                your password. Never enter your password on a domain you do not
                trust.
              </p>
            </div>
          </div>
        </div>

        <hr className="border-slate-200 dark:border-slate-700" />

        <div className="relative p-1 flex flex-wrap items-center justify-stretch">
          <span className="w-8 flex items-center justify-center">
            <input
              id="remember"
              name="remember"
              type="checkbox"
              className="text-primary"
              defaultChecked={remember}
              onChange={() => setErrorMessage(null)}
            />
          </span>

          <label
            htmlFor="remember"
            className="relative m-0 block w-[1px] min-w-0 flex-auto px-3 py-[0.25rem] leading-[1.6]"
          >
            Remember this account on this device
          </label>
        </div>
      </fieldset>

      {errorMessage && <ErrorCard className="mt-2" message={errorMessage} />}

      <div className="flex-auto" />

      <div className="mt-4 flex items-center justify-between">
        <button
          type="submit"
          className="order-last bg-primary text-white py-2 px-4 rounded-full font-semibold"
          disabled={loading}
        >
          {submitLabel}
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="bg-transparent font-light text-primary rounded-md py-2"
          >
            {cancelLabel}
          </button>
        )}
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
