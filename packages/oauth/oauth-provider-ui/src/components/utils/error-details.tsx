import { Trans } from '@lingui/react/macro'
import { clsx } from 'clsx'
import { JSX, useMemo } from 'react'
import { JsonErrorResponse } from '#/lib/json-client.ts'
import { Override } from '#/lib/util.ts'

export type ParsedError = {
  name: string
  code?: string
  message?: string
  details?: string
}

// @TODO this should me moved out of utils and be more specific to API errors
export function apiErrorParser(error: unknown): ParsedError | void {
  if (error instanceof JsonErrorResponse) {
    return {
      name: error.name,
      code: error.error,
      message: error.description,
      details: toJsonSafe(error.payload),
    }
  }
}

export type ErrorDetailsProps = Override<
  JSX.IntrinsicElements['dl'],
  {
    error: unknown
    parser?: (error: unknown) => ParsedError | void
  }
>

export function ErrorDetails({
  error,
  parser = apiErrorParser,
  className,
  ...props
}: ErrorDetailsProps) {
  const parsed = useMemo<ParsedError>(() => {
    const parsed = parser?.(error)
    if (parsed) return parsed

    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        details: error.stack,
      }
    }

    return {
      name: 'UnknownError',
      details: toJsonSafe(error),
    }
  }, [error, parser])

  return (
    <dl
      className={clsx(
        'mt-2 grid max-w-full grid-cols-[auto_1fr] gap-x-2 text-sm',
        className,
      )}
      {...props}
    >
      <dt className="font-semibold">
        <Trans>Name</Trans>
      </dt>
      <dd>
        <code>{parsed.name}</code>
      </dd>

      {parsed.code && (
        <>
          <dt className="font-semibold">
            <Trans>Code</Trans>
          </dt>
          <dd>
            <code>{parsed.code}</code>
          </dd>
        </>
      )}

      {parsed.message && (
        <>
          <dt className="font-semibold">
            <Trans>Message</Trans>
          </dt>
          <dd>{parsed.message}</dd>
        </>
      )}

      {parsed.details && (
        <>
          <dt className="font-semibold">
            <Trans>Stack</Trans>
          </dt>
          <dd className="max-h-[200px] overflow-auto">
            <code>
              <pre>{parsed.details}</pre>
            </code>
          </dd>
        </>
      )}
    </dl>
  )
}

function toJsonSafe(value: unknown): string | undefined {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return undefined
  }
}
