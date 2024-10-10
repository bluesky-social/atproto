import { FormEvent, useCallback, useState } from 'react'

export type AtpSignIn = (input: {
  identifier: string
  password: string
  authFactorToken?: string
  service: string
}) => unknown

/**
 * @returns Nice tailwind css form asking to enter either a handle or the host
 *   to use to login.
 */
export function CredentialSignInForm({
  signIn,
  ...props
}: {
  signIn: AtpSignIn
} & Omit<React.HTMLAttributes<HTMLFormElement>, 'onSubmit'>) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [service, setService] = useState('http://localhost:2583')

  // TODO: add auth factor support ?

  const onSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (loading) return

      setLoading(true)

      try {
        await signIn({
          identifier,
          password,
          service,
        })
      } catch (err) {
        setError((err as any)?.message || String(err))
      } finally {
        setLoading(false)
      }
    },
    [loading, identifier, password, service, signIn],
  )

  return (
    <form {...props} className="max-w-lg w-full" onSubmit={onSubmit}>
      <fieldset className="rounded-md border border-solid border-slate-200 dark:border-slate-700 text-neutral-700 dark:text-neutral-100">
        <div className="relative p-1 flex flex-col flex-wrap items-center justify-stretch">
          <input
            id="identifier"
            name="identifier"
            type="text"
            className="relative m-0 block w-full flex-auto px-3 py-[0.25rem] leading-[1.6] bg-transparent bg-clip-padding text-base text-inherit outline-none dark:placeholder:text-neutral-100"
            placeholder="@handle or email"
            aria-label="@handle or email"
            required
            value={identifier}
            disabled={loading}
            onChange={(e) => setIdentifier(e.target.value)}
          />

          <input
            id="password"
            name="password"
            type="password"
            className="relative m-0 block w-full flex-auto px-3 py-[0.25rem] leading-[1.6] bg-transparent bg-clip-padding text-base text-inherit outline-none dark:placeholder:text-neutral-100"
            placeholder="Password"
            aria-label="Password"
            required
            value={password}
            disabled={loading}
            onChange={(e) => setPassword(e.target.value)}
          />

          <input
            id="service"
            name="service"
            type="text"
            className="relative m-0 block w-full flex-auto px-3 py-[0.25rem] leading-[1.6] bg-transparent bg-clip-padding text-base text-inherit outline-none dark:placeholder:text-neutral-100"
            placeholder="Service"
            aria-label="Service"
            required
            value={service}
            disabled={loading}
            onChange={(e) => setService(e.target.value)}
          />

          <button
            type="submit"
            disabled={loading}
            className="bg-transparent text-blue-600 rounded-md py-1 px-3 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-inset"
          >
            Login
          </button>
          {loading && <span>Loading...</span>}
        </div>
      </fieldset>

      {error ? <div className="alert alert-error">{error}</div> : null}
    </form>
  )
}
