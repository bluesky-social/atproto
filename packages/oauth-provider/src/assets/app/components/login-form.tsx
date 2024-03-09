import type { FormHTMLAttributes } from 'react'

export type LoginFormOutput = {
  username: string
  password: string
  remember: boolean
}

export type LoginFormProps = {
  onLogin: (credentials: LoginFormOutput) => void
  onBack?: () => void
  backLabel?: string | JSX.Element
  username?: string
  usernameReadonly?: boolean
} & FormHTMLAttributes<HTMLFormElement>

export function LoginForm({
  onLogin,
  onBack = undefined,
  backLabel = 'Back',
  username = '',
  usernameReadonly = false,
  ...props
}: LoginFormProps) {
  const onSubmit = (
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
    onLogin({
      username: event.currentTarget.username.value,
      password: event.currentTarget.password.value,
      remember: event.currentTarget.remember.checked,
    })
  }

  return (
    <form {...props} onSubmit={onSubmit}>
      <fieldset className="rounded-md border border-solid border-slate-200 dark:border-slate-700 text-neutral-700 dark:text-neutral-100">
        <div className="relative p-1 flex flex-wrap items-center justify-stretch">
          <span className="w-8 text-center text-base leading-[1.6]">@</span>
          <input
            name="username"
            type="text"
            className="relative m-0 block w-[1px] min-w-0 flex-auto px-3 py-[0.25rem] leading-[1.6] bg-transparent bg-clip-padding text-base text-inherit outline-none dark:placeholder:text-neutral-100"
            placeholder="Username or email address"
            aria-label="Username or email address"
            required
            defaultValue={username}
            readOnly={usernameReadonly}
            disabled={usernameReadonly}
          />
        </div>

        <hr className="border-slate-200 dark:border-slate-700" />

        <div className="relative p-1 flex flex-wrap items-center justify-stretch">
          <span className="w-8 text-center text-2xl leading-[1.6]">*</span>
          <input
            name="password"
            type="password"
            className="relative m-0 block w-[1px] min-w-0 flex-auto px-3 py-[0.25rem] leading-[1.6] bg-transparent bg-clip-padding text-base text-inherit outline-none dark:placeholder:text-neutral-100"
            placeholder="Password"
            aria-label="Password"
            required
          />
        </div>

        <hr className="border-slate-200 dark:border-slate-700" />

        <div className="relative p-1 flex flex-wrap items-center justify-stretch">
          <span className="w-8 flex items-center justify-center">
            <input
              id="remember"
              name="remember"
              type="checkbox"
              className="text-primary"
            />
          </span>

          <label
            htmlFor="remember"
            className="relative m-0 block w-[1px] min-w-0 flex-auto px-3 py-[0.25rem] leading-[1.6]"
          >
            Remember on this device
          </label>
        </div>

        <div className="border-t border-solid border-slate-200 dark:border-slate-700 p-1 bg-slate-100 dark:bg-slate-800">
          <div className="flex items-center justify-start">
            <div className="p-2">
              <svg
                className="fill-current h-4 w-4 text-error"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
              >
                <path d="M2.93 17.07A10 10 0 1 1 17.07 2.93 10 10 0 0 1 2.93 17.07zm12.73-1.41A8 8 0 1 0 4.34 4.34a8 8 0 0 0 11.32 11.32zM9 11V9h2v6H9v-4zm0-6h2v2H9V5z" />
              </svg>
            </div>
            <div className="py-1 px-3">
              <p className="font-bold">Warning</p>
              <p className="text-sm">
                Please verify the domain name of the website before entering
                your password. Never enter your password on a domain you do not
                trust.
              </p>
            </div>
          </div>
        </div>
      </fieldset>

      <div className="m-4 flex items-center justify-between">
        <button
          type="submit"
          className="bg-transparent text-primary rounded-md py-2 font-semibold order-last"
        >
          Next
        </button>

        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="bg-transparent font-light text-primary rounded-md py-2"
          >
            {backLabel}
          </button>
        )}
      </div>
    </form>
  )
}
