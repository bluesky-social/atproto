import { AuthorizeOptions } from '@atproto/oauth-client-browser'
import { FormEvent, useCallback, useState } from 'react'

export type OAuthSignIn = (input: string, options?: AuthorizeOptions) => unknown

/**
 * @returns Nice tailwind css form asking to enter either a handle or the host
 *   to use to login.
 */
export function OAuthSignInForm({
  signIn,
  ...props
}: {
  signIn: OAuthSignIn
} & Omit<React.HTMLAttributes<HTMLFormElement>, 'onSubmit'>) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (loading) return

      setError(null)
      setLoading(true)

      try {
        if (value.startsWith('did:')) {
          if (value.length > 5) await signIn(value)
          else setError('DID must be at least 6 characters')
        } else if (
          value.startsWith('https://') ||
          value.startsWith('http://')
        ) {
          const url = new URL(value)
          if (value !== url.origin) throw new Error('PDS URL must be a origin')
          await signIn(value)
        } else if (value.includes('.') && value.length > 3) {
          const handle = value.startsWith('@') ? value.slice(1) : value
          if (handle.length > 3) await signIn(handle)
          else setError('Handle must be at least 4 characters')
        }

        throw new Error('Please provide a valid handle, DID or PDS URL')
      } catch (err) {
        setError((err as any)?.message || String(err))
      } finally {
        setLoading(false)
      }
    },
    [loading, value, signIn],
  )

  return (
    <form {...props} className="max-w-lg w-full" onSubmit={onSubmit}>
      <fieldset className="rounded-md border border-solid border-slate-200 dark:border-slate-700 text-neutral-700 dark:text-neutral-100">
        <div className="relative p-1 flex flex-wrap items-center justify-stretch">
          <input
            name="value"
            type="text"
            className="relative m-0 block w-[1px] min-w-0 flex-auto px-3 py-[0.25rem] leading-[1.6] bg-transparent bg-clip-padding text-base text-inherit outline-none dark:placeholder:text-neutral-100"
            placeholder="@handle, DID or PDS url"
            aria-label="@handle, DID or PDS url"
            required
            value={value}
            disabled={loading}
            onChange={(e) => setValue(e.target.value)}
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
