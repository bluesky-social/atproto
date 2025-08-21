import { Trans } from '@lingui/react/macro'
import { memo, useEffect, useMemo, useState } from 'react'
import { useRandomString } from '../../hooks/use-random-string.ts'
import { Api } from '../../lib/api.ts'
import { JsonErrorResponse } from '../../lib/json-client.ts'
import { Override } from '../../lib/util.ts'
import { Admonition, AdmonitionProps } from './admonition.tsx'
import { ErrorMessage } from './error-message.tsx'

export type ErrorCardProps = Override<
  Omit<AdmonitionProps, 'role'>,
  {
    error: unknown
  }
>
export const ErrorCard = memo(function ErrorCard({
  error,

  // Admonition
  children,
  onClick,
  onKeyDown,
  ...props
}: ErrorCardProps) {
  const [inputCount, setInputCount] = useState(0)
  // Every 5th input will toggle showing the details
  const showDetails = ((inputCount / 5) | 0) % 2 === 1

  const detailsDivId = useRandomString('error-card-')

  const parsedError = useMemo(
    () =>
      error instanceof JsonErrorResponse
        ? // Already parsed:
          error
        : // If "error" is a json object, try parsing it as a JsonErrorResponse:
          Api.parseError(error) ?? error,
    [error],
  )

  useEffect(() => {
    // For debugging purposes
    console.warn('Displayed error details:', parsedError)

    // Reset the input count when the error changes
    setInputCount(0)
  }, [parsedError])

  return (
    <Admonition
      prominent
      {...props}
      aria-controls={detailsDivId}
      tabIndex={0}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!event.defaultPrevented) {
          setInputCount((c) => c + 1)
        }
      }}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) {
          setInputCount((c) => c + 1)
        }
      }}
      type="alert"
      title={<ErrorMessage error={parsedError} />}
    >
      {children && <div className="mt-2">{children}</div>}

      <div hidden={!showDetails} id={detailsDivId} aria-hidden={!showDetails}>
        {parsedError instanceof JsonErrorResponse ? (
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
        )}
      </div>
    </Admonition>
  )
})
