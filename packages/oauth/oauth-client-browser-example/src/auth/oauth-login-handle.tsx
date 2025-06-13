import { FormEvent, JSX, useState } from 'react'
import { Button } from '../components/button.tsx'
import { OAuthSignIn } from './use-oauth.ts'

export type OAuthLoginHandleProps = Omit<
  JSX.IntrinsicElements['form'],
  'onSubmit'
> & {
  signIn: OAuthSignIn
}

/**
 * @returns Nice tailwind css form asking to enter either a handle or the host
 *   to use to login.
 */
export function OAuthLoginHandle({
  signIn,

  // form
  className,
  ...props
}: OAuthLoginHandleProps) {
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
      className={`${className || ''} w-full`}
      onSubmit={onSubmit}
    >
      <fieldset className="rounded-md border border-solid border-slate-200 text-neutral-700 dark:border-slate-700 dark:text-neutral-100">
        <div className="relative flex flex-wrap items-center justify-stretch space-x-2 p-2">
          <input
            name="value"
            type="text"
            className="relative m-0 block w-[1px] min-w-0 flex-auto bg-transparent bg-clip-padding text-base text-inherit outline-none dark:placeholder:text-neutral-100"
            placeholder="Continue with @handle or custom PDS"
            aria-label="Continue with @handle or custom PDS"
            required
            value={value}
            disabled={loading}
            onChange={(e) => setValue(e.target.value)}
          />
          <Button type="submit" disabled={loading} transparent size="small">
            Login
          </Button>
          {loading && <span>Loading...</span>}
        </div>
      </fieldset>

      {error ? <div className="alert alert-error">{error}</div> : null}
    </form>
  )
}
