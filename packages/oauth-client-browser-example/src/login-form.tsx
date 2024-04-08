import { FormEvent, useState } from 'react'

/**
 * @returns Nice tailwind css form asking to enter either a handle or the host
 *   to use to login.
 */
export default function LoginForm({
  onLogin,
  loading,
  error,
  ...props
}: {
  loading?: boolean
  error?: null | string
  onLogin: (input: string) => void
} & React.HTMLAttributes<HTMLFormElement>) {
  const [value, setValue] = useState('')
  const [loginType, setLoginType] = useState<'handle' | 'host'>('handle')

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (loading) return

    onLogin(
      loginType === 'host' && !/^https?:\/\//.test(value)
        ? `https://${value}`
        : value,
    )
  }

  return (
    <form {...props} className="max-w-lg w-full m-4" onSubmit={onSubmit}>
      <fieldset className="rounded-md border border-solid border-slate-200 dark:border-slate-700 text-neutral-700 dark:text-neutral-100">
        <div className="relative p-1 flex flex-wrap items-center justify-stretch">
          <select
            value={loginType}
            className="border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-inset"
            onChange={(e) => setLoginType(e.target.value as 'handle' | 'host')}
          >
            <option value="handle">Login using you handle or DID</option>
            <option value="host">Login using your PDS host</option>
          </select>
        </div>

        {/* <hr className="border-slate-200 dark:border-slate-700" /> */}

        <div className="relative p-1 flex flex-wrap items-center justify-stretch">
          <label
            htmlFor="value"
            className="w-8 text-center text-base leading-[1.6]"
          >
            @
          </label>
          <input
            id="value"
            name="value"
            type="text"
            className="relative m-0 block w-[1px] min-w-0 flex-auto px-3 py-[0.25rem] leading-[1.6] bg-transparent bg-clip-padding text-base text-inherit outline-none dark:placeholder:text-neutral-100"
            placeholder={
              loginType === 'host' ? 'PDS host name' : 'Handle or DID'
            }
            aria-label={
              loginType === 'host' ? 'PDS host name' : 'Handle or DID'
            }
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-transparent text-blue-600 rounded-md py-1 px-3 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-inset"
          >
            Login
          </button>
        </div>
      </fieldset>

      {error ? <div className="alert alert-error">{error}</div> : null}
    </form>
  )
}
