import { FormHTMLAttributes } from 'react'

import { Layout } from './layout'

export function LoginForm({
  onLogin,
  onBack = undefined,
  username = '',
  usernameReadonly = false,
  ...props
}: FormHTMLAttributes<HTMLFormElement> & {
  onLogin: (credentials: {
    username: string
    password: string
    remember: boolean
  }) => void
  onBack?: () => void
  username?: string
  usernameReadonly?: boolean
}) {
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
    <Layout title="Sign in" subTitle="Enter your username and password">
      <form {...props} className="max-w-lg w-full m-4" onSubmit={onSubmit}>
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
                className="text-blue-600"
              />
            </span>

            <label
              htmlFor="remember"
              className="relative m-0 block w-[1px] min-w-0 flex-auto px-3 py-[0.25rem] leading-[1.6]"
            >
              Remember on this device
            </label>
          </div>
        </fieldset>

        <div className="m-4 flex items-center justify-between">
          <button
            type="submit"
            className="bg-transparent text-blue-600 rounded-md py-2 font-semibold order-last"
          >
            Next
          </button>

          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="bg-transparent font-light text-blue-600 rounded-md py-2"
            >
              Back
            </button>
          )}
        </div>
      </form>
    </Layout>
  )
}
