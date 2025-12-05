import { FormEvent, JSX, useEffect, useRef, useState } from 'react'
import { Button } from './Button.tsx'

export type AtmosphereSignInFormProps = JSX.IntrinsicElements['form'] & {
  placeholder?: string
  autoFocus?: boolean
  disabled?: boolean
  loading?: boolean
  signIn: (input: string) => Promise<void>
}

/**
 * @returns Nice tailwind css form asking to enter either a handle or the host
 *   to use to login.
 */
export function AtmosphereSignInForm({
  signIn,
  autoFocus = true,
  placeholder,
  loading: forceLoading,

  // form
  className,
  onSubmit,
  ...props
}: AtmosphereSignInFormProps) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<Error | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const disabled = props.disabled || forceLoading || loading

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    if (disabled) return

    onSubmit?.(event)
    if (!event.defaultPrevented) {
      event.preventDefault()

      const invalid = !formRef.current?.reportValidity()
      if (invalid) return

      try {
        setLoading(true)

        await signIn(value.replace('@', '').toLowerCase())
      } catch (err) {
        console.warn('Error during sign-in:', err)
        setError(err as Error)
      } finally {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    setError(undefined)
  }, [value])

  return (
    <form
      {...props}
      ref={formRef}
      className={`${className || ''} w-full`}
      onSubmit={handleSubmit}
    >
      <fieldset className="rounded-md border border-solid border-slate-200 text-neutral-700 dark:border-slate-700 dark:text-neutral-100">
        <div className="relative flex flex-wrap items-center justify-stretch space-x-2 p-1">
          <input
            name="identifier"
            type="text"
            className="relative mx-1 block w-[1px] min-w-0 flex-auto bg-transparent bg-clip-padding text-base text-inherit outline-none dark:placeholder:text-neutral-100"
            placeholder={placeholder}
            aria-label={placeholder}
            disabled={disabled}
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
          <Button type="submit" loading={loading || forceLoading} transparent>
            Login
          </Button>
        </div>
      </fieldset>

      {error ? <div>{String(error)}</div> : null}
    </form>
  )
}
