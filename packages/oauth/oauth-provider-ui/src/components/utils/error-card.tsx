import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { composeEventHandlers } from '@radix-ui/primitive'
import { useEffect, useMemo, useState } from 'react'
import { ErrorParser, ParsedError, parseError } from '#/lib/error-parser.ts'
import { Override } from '#/lib/util.ts'
import { Admonition, AdmonitionAction, AdmonitionProps } from './admonition.tsx'
import { ErrorDetails } from './error-details.tsx'

export type { ErrorParser, ParsedError }

export type ErrorCardProps = Override<
  Omit<AdmonitionProps, 'role' | 'append' | 'action'>,
  {
    error: unknown
    reset?: () => void
    parser?: ErrorParser
  }
>

export function ErrorCard({
  error,
  reset,
  parser,

  // Admonition
  children,
  onClick,
  ...props
}: ErrorCardProps) {
  const { _ } = useLingui()
  const [clickCount, setClickCount] = useState(0)

  // Every 5th click; toggle showing the details
  const showDetails = ((clickCount / 5) | 0) % 2 === 1

  const parsed = useMemo<ParsedError>(
    () => parser?.(error) ?? parseError(error),
    [parser, error],
  )

  useEffect(() => {
    // For debugging purposes
    console.warn('Displayed error:', parsed)

    // Reset the click count when the error changes
    setClickCount(0)
  }, [parsed])

  return (
    <Admonition
      {...props}
      role="alert"
      onClick={composeEventHandlers(onClick, () => {
        setClickCount((c) => c + 1)
      })}
      append={
        <>
          {children}
          {showDetails && (
            <ErrorDetails
              name={parsed.name}
              code={parsed.code}
              message={parsed.message}
              payload={parsed.payload}
              stack={parsed.stack}
            />
          )}
        </>
      }
      action={
        reset != null && (
          <AdmonitionAction onClick={() => reset()}>
            <Trans>Retry</Trans>
          </AdmonitionAction>
        )
      }
    >
      {_(parsed.description ?? msg`An unknown error occurred`)}
    </Admonition>
  )
}

export const errorCardRender = (props: ErrorCardProps) => (
  <ErrorCard {...props} />
)
