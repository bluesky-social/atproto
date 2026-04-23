import { Trans } from '@lingui/react/macro'
import { useEffect, useMemo, useState } from 'react'
import { useErrorMessage } from '#/hooks/use-error-message.ts'
import { Api } from '#/lib/api.ts'
import { JsonErrorResponse } from '#/lib/json-client.ts'
import { Action, Admonition } from './admonition.tsx'

export type ErrorCardProps = {
  error: unknown
  reset?: () => void
}

export function ErrorCard({ error, reset }: ErrorCardProps) {
  const [inputCount, setInputCount] = useState(0)
  // Every 5th input will toggle showing the details
  const showDetails = ((inputCount / 5) | 0) % 2 === 1

  const errorMessage = useErrorMessage(error)

  useEffect(() => {
    // For debugging purposes
    console.warn('Displayed error details:', error)

    // Reset the input count when the error changes
    setInputCount(0)
  }, [error])

  return (
    <Admonition
      role="alert"
      onClick={() => setInputCount((c) => c + 1)}
      title={errorMessage}
      append={showDetails && <ErrorDetails error={error} />}
      action={
        reset != null && (
          <Action onClick={() => reset()}>
            <Trans>Retry</Trans>
          </Action>
        )
      }
    />
  )
}

function ErrorDetails({ error }: { error: unknown }) {
  const parsedError = useMemo(
    () =>
      error instanceof JsonErrorResponse
        ? // Already parsed:
          error
        : // If "error" is a json object, try parsing it as a JsonErrorResponse:
          Api.parseError(error) ?? error,
    [error],
  )

  return parsedError instanceof JsonErrorResponse ? (
    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 text-sm">
      <dt className="font-semibold">
        <Trans>Code</Trans>
      </dt>
      <dd>
        <code>{parsedError.error}</code>
      </dd>

      <dt className="font-semibold">
        <Trans>Description</Trans>
      </dt>
      <dd>{parsedError.description}</dd>
    </dl>
  ) : (
    <pre className="text-xs">{JSON.stringify(parsedError, null, 2)}</pre>
  )
}
