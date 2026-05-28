import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { ReactNode, useEffect, useMemo, useState } from 'react'
import { ErrorParser, ParsedError, parseError } from '#/lib/error-parser.ts'
import { Action, Admonition } from './admonition.tsx'
import { ErrorDetails } from './error-details.tsx'

export type { ErrorParser, ParsedError }

export type ErrorCardProps = {
  className?: string
  children?: ReactNode
  error: unknown
  reset?: () => void
  parser?: ErrorParser
}

export function ErrorCard({
  error,
  reset,
  parser,
  className,
  children,
}: ErrorCardProps) {
  const { _ } = useLingui()
  const [inputCount, setInputCount] = useState(0)
  // Every 5th input will toggle showing the details
  const showDetails = ((inputCount / 5) | 0) % 2 === 1

  const parsed = useMemo<ParsedError>(
    () => parser?.(error) ?? parseError(error),
    [parser, error],
  )

  useEffect(() => {
    // For debugging purposes
    console.warn('Displayed error:', parsed)

    // Reset the input count when the error changes
    setInputCount(0)
  }, [parsed])

  return (
    <Admonition
      role="alert"
      className={className}
      onClick={() => setInputCount((c) => c + 1)}
      title={_(parsed.description ?? msg`An unknown error occurred`)}
      append={
        showDetails && (
          <ErrorDetails
            name={parsed.name}
            code={parsed.code}
            message={parsed.message}
            payload={parsed.payload}
            stack={parsed.stack}
          />
        )
      }
      action={
        reset != null && (
          <Action onClick={() => reset()}>
            <Trans>Retry</Trans>
          </Action>
        )
      }
    >
      {children}
    </Admonition>
  )
}

export const errorCardRender = (props: ErrorCardProps) => (
  <ErrorCard {...props} />
)
