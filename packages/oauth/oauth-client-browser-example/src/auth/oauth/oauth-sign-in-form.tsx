import { FormEvent, JSX, useState } from 'react'
import { AuthorizeOptions } from '@atproto/oauth-client-browser'

export type OAuthSignIn = (input: string, options?: AuthorizeOptions) => unknown

export type OAuthSignInFormProps = Omit<
  JSX.IntrinsicElements['form'],
  'onSubmit'
> & {
  signIn: OAuthSignIn
  signUpUrl?: string
}

/**
 * @returns Nice tailwind css form asking to enter either a handle or the host
 *   to use to login.
 */
export function OAuthSignInForm({
  signIn,
  signUpUrl,

  // form
  className,
  ...props
}: OAuthSignInFormProps) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (loading) return
    if (!event.currentTarget.reportValidity()) return

    setError(null)
    setLoading(true)

    try {
      if (value.startsWith('did:')) {
        if (value.length > 5) await signIn(value)
        else setError('DID must be at least 6 characters')
      } else if (value.startsWith('https://') || value.startsWith('http://')) {
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
  }

  return (
    <form
      {...props}
      className={`${className || ''} w-full max-w-lg`}
      onSubmit={onSubmit}
    >
      <fieldset className="rounded-md border border-solid border-slate-200 text-neutral-700 dark:border-slate-700 dark:text-neutral-100">
        <div className="relative flex flex-wrap items-center justify-stretch p-1">
          <input
            name="value"
            type="text"
            className="relative m-0 block w-[1px] min-w-0 flex-auto bg-transparent bg-clip-padding px-3 py-[0.25rem] text-base leading-[1.6] text-inherit outline-none dark:placeholder:text-neutral-100"
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
            className="rounded-md bg-transparent px-3 py-1 text-blue-600 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 focus:ring-offset-2"
          >
            Login
          </button>
          {loading && <span>Loading...</span>}
        </div>
      </fieldset>

      {signUpUrl && (
        <button
          type="button"
          onClick={() => signIn(signUpUrl)}
          disabled={loading}
          className="mt-2 rounded-md bg-blue-600 px-3 py-1 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 focus:ring-offset-2"
        >
          Sign up
        </button>
      )}

      {error ? <div className="alert alert-error">{error}</div> : null}
    </form>
  )
}
