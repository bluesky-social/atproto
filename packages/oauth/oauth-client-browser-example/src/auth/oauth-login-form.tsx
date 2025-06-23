import { useMutation } from '@tanstack/react-query'
import { FormEvent, JSX, useEffect, useRef, useState } from 'react'
import { Button } from '../components/button.tsx'
import { OAuthSignIn } from './use-oauth.ts'

export type OAuthLoginHandleProps = JSX.IntrinsicElements['form'] & {
  placeholder?: string
  autoFocus?: boolean
  signIn: OAuthSignIn
}

/**
 * @returns Nice tailwind css form asking to enter either a handle or the host
 *   to use to login.
 */
export function OAuthLoginForm({
  signIn,
  autoFocus = true,
  placeholder = 'Login with a @handle or custom PDS',

  // form
  className,
  onSubmit,
  ...props
}: OAuthLoginHandleProps) {
  const [value, setValue] = useState('')
  const formRef = useRef<HTMLFormElement>(null)

  const { isPending, mutateAsync, error, reset } = useMutation({
    mutationFn: async (event: FormEvent<HTMLFormElement>) => {
      onSubmit?.(event)
      if (event.defaultPrevented) return
      event.preventDefault()

      if (!formRef.current?.reportValidity()) return

      return signIn(value.replace('@', '').toLowerCase())
    },
  })

  useEffect(reset, [value])

  return (
    <form
      {...props}
      ref={formRef}
      className={`${className || ''} w-full`}
      onSubmit={mutateAsync}
    >
      <fieldset className="rounded-md border border-solid border-slate-200 text-neutral-700 dark:border-slate-700 dark:text-neutral-100">
        <div className="relative flex flex-wrap items-center justify-stretch space-x-2 p-1">
          <input
            name="identifier"
            type="text"
            className="relative mx-1 block w-[1px] min-w-0 flex-auto bg-transparent bg-clip-padding text-base text-inherit outline-none dark:placeholder:text-neutral-100"
            placeholder={placeholder}
            aria-label={placeholder}
            disabled={isPending}
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
            title={error ? String(error) : undefined}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <Button type="submit" loading={isPending} transparent>
            Login
          </Button>
        </div>
      </fieldset>

      {error ? <div>{String(error)}</div> : null}
    </form>
  )
}
