import { FormEvent, useEffect, useState } from 'react'

/**
 * @returns Nice tailwind css form asking to enter either a handle or the host
 *   to use to login.
 */
export default function LoginForm({
  onLogin,
  loading,
  error = null,
  ...props
}: {
  loading?: boolean
  error?: null | string
  onLogin: (input: string, options?: { display?: 'popup' | 'page' }) => void
} & React.HTMLAttributes<HTMLFormElement>) {
  const [value, setValue] = useState('')
  const [display, setDisplay] = useState<'popup' | 'page'>('popup')
  const [localError, setLocalError] = useState<string | null>(error)

  useEffect(() => {
    setLocalError(null)
  }, [value])

  useEffect(() => {
    setLocalError(error)
  }, [error])

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (loading) return

    if (value.startsWith('did:')) {
      if (value.length > 5) onLogin(value, { display })
      else setLocalError('DID must be at least 6 characters')
      return
    }

    if (value.startsWith('https://') || value.startsWith('http://')) {
      try {
        const url = new URL(value)
        if (value !== url.origin) throw new Error('PDS URL must be a origin')
        onLogin(value, { display })
      } catch (err) {
        setLocalError((err as any)?.message || String(err))
      }
      return
    }

    if (value.includes('.') && value.length > 3) {
      const handle = value.startsWith('@') ? value.slice(1) : value
      if (handle.length > 3) onLogin(handle, { display })
      else setLocalError('Handle must be at least 4 characters')
      return
    }

    setLocalError('Please provide a valid handle, DID or PDS URL')
  }

  return (
    <form {...props} className="max-w-lg w-full m-4" onSubmit={onSubmit}>
      <fieldset className="rounded-md border border-solid border-slate-200 dark:border-slate-700 text-neutral-700 dark:text-neutral-100">
        <div className="relative p-1 flex flex-wrap items-center justify-stretch">
          <select
            value={display}
            className="border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-inset"
            onChange={(e) => setDisplay(e.target.value as 'popup' | 'page')}
          >
            <option value="popup">Login in pop-up window</option>
            <option value="page">Login using redirects</option>
          </select>
        </div>

        {/* <hr className="border-slate-200 dark:border-slate-700" /> */}

        <div className="relative p-1 flex flex-wrap items-center justify-stretch">
          <input
            id="value"
            name="value"
            type="text"
            className="relative m-0 block w-[1px] min-w-0 flex-auto px-3 py-[0.25rem] leading-[1.6] bg-transparent bg-clip-padding text-base text-inherit outline-none dark:placeholder:text-neutral-100"
            placeholder="@handle, DID or PDS url"
            aria-label="@handle, DID or PDS url"
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

      {localError ? (
        <div className="alert alert-error">{localError}</div>
      ) : null}
    </form>
  )
}
