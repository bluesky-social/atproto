import { useMutation } from '@tanstack/react-query'
import { type JSX, useEffect, useState } from 'react'
import { type HandleString, isHandleString } from '@atproto/lex'
import { com } from '../lexicons.ts'
import { useDebounced } from '../lib/use-debounced.ts'
import { useBskyClient } from '../providers/BskyClientProvider.tsx'
import { useLexQuery } from '../queries/use-lex-query.ts'
import { Button } from './Button.tsx'

function ifHandleString<T extends string>(
  value: T,
): undefined | (T & HandleString) {
  return isHandleString(value) ? (value as T & HandleString) : undefined
}

export type AtmosphereSignInFormProps = JSX.IntrinsicElements['div'] & {
  placeholder?: string
  autoFocus?: boolean
  signIn: (input: string) => Promise<void>
  signUp: (input: string) => Promise<void>
  pdsOperatorUrl?: string
}

/**
 * @returns Nice tailwind css form asking to enter either a handle or the host
 *   to use to login.
 */
export function AtmosphereSignInForm({
  signIn,
  signUp,
  pdsOperatorUrl,
  autoFocus = true,
  placeholder,

  // form
  className,
  role = 'dialog',
  ...props
}: AtmosphereSignInFormProps) {
  const client = useBskyClient()
  const [value, setValue] = useState('')

  const handleInput =
    !value.includes(':') && value.includes('.') && value.length > 3
      ? ifHandleString(value.replace('@', '').toLowerCase())
      : undefined
  const handle = useDebounced(handleInput, 750)
  const handleDebouncing = handle != null && handle !== handleInput

  const resolveMutation = useLexQuery(
    client,
    com.atproto.identity.resolveHandle,
    handle ? { handle } : false,
    { enabled: !handleDebouncing },
  )

  const signInMutation = useMutation({
    mutationFn: signIn,
  })

  useEffect(() => {
    signInMutation.reset()
  }, [value])

  return (
    <div
      role={role}
      className={`flex w-[450px] max-w-full flex-col items-stretch space-y-4 rounded-md bg-white p-4 text-slate-900 shadow-md dark:bg-slate-900 dark:text-slate-100 ${className}`}
      {...props}
    >
      <h2 className="text-center text-2xl font-medium">
        Login with the Atmosphere
      </h2>
      <p>Enter your handle to continue</p>
      <form
        className={`${className || ''} w-full`}
        inert={signInMutation.isPending}
        onSubmit={(event) => {
          event.preventDefault()

          // handle does not resolve to a DID, no point in submitting
          if (handle && !resolveMutation.data) {
            return
          }

          if (event.currentTarget.reportValidity()) {
            signInMutation.mutate(value.replace('@', '').toLowerCase())
          }
        }}
      >
        <fieldset className="rounded-md border border-solid border-slate-200 text-neutral-700 dark:border-slate-700 dark:text-neutral-100">
          <div className="relative flex flex-wrap items-center justify-stretch space-x-2 p-1">
            <input
              name="identifier"
              type="text"
              className="relative mx-1 block w-[1px] min-w-0 flex-auto bg-transparent bg-clip-padding text-base text-inherit outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
              placeholder={placeholder}
              aria-label={placeholder}
              required
              min={3}
              max={2048}
              autoCapitalize="off"
              autoComplete="username"
              autoCorrect="off"
              spellCheck="false"
              autoFocus={autoFocus}
              pattern={
                value.startsWith('http:') || value.startsWith('https:')
                  ? '^https?:\\/\\/([a-z0-9\\-]+\\.)*[a-z]{2,}(:\\d{1,5})?$'
                  : value.startsWith('did:')
                    ? '^(did:plc:[a-z2-7]{24}|did:web:[a-z0-9._\\-]+)$'
                    : '^@?[a-zA-Z0-9\\-]+(\\.[a-zA-Z0-9_\\-]+)+$'
              }
              title={
                signInMutation.error ? String(signInMutation.error) : undefined
              }
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <Button
              type="submit"
              loading={
                signInMutation.isPending ||
                resolveMutation.isLoading ||
                handleDebouncing
              }
              disabled={!value || (handle && !resolveMutation.data)}
            >
              Login
            </Button>
          </div>
        </fieldset>

        {signInMutation.error ? (
          <p>{String(signInMutation.error)}</p>
        ) : handle != null &&
          handle === handleInput &&
          !resolveMutation.isLoading &&
          resolveMutation.error ? (
          <p>{resolveMutation.error.message}</p>
        ) : null}
      </form>

      {pdsOperatorUrl && (
        <Button
          key="login"
          type="button"
          disabled={signInMutation.isPending}
          transparent
          size="large"
          action={() => signIn(pdsOperatorUrl)}
          name="login-button"
        >
          Login with {new URL(pdsOperatorUrl).host}
        </Button>
      )}
    </div>
  )
}
