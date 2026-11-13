import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import {
  ErrorCard,
  type ErrorCardProps,
} from '#/components/feedback/error-card.tsx'
import { Button } from '#/components/ui/button.tsx'
import { apiErrorParser } from '#/lib/api-error-parser.ts'
import { composeEventHandlers } from '#/lib/compose-event-handlers.ts'
import {
  type ErrorParser,
  type ParsedError,
  parseError,
} from '#/lib/error-parser.ts'
import type { Override } from '#/lib/util.ts'
import { ErrorDetails } from './error-details.tsx'

export type { ErrorParser, ParsedError }

export type ErrorNoticeProps = Override<
  ErrorCardProps,
  {
    error: unknown
    retry?: () => void
    retryLabel?: ReactNode
    parser?: ErrorParser
  }
>

/**
 * An inline error under a form: one line in the error colour with a small
 * icon, the same shape as the quiet helper lines around it, rather than a
 * filled and bordered box. Clicking it five times toggles the technical
 * details.
 */
export function ErrorNotice({
  error,
  retry,
  retryLabel,
  parser = apiErrorParser,

  // div
  className,
  children,
  onClick,
  ...props
}: ErrorNoticeProps) {
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
    <ErrorCard
      {...props}
      onClick={composeEventHandlers(onClick, () => setClickCount((c) => c + 1))}
    >
      <p>{_(parsed.description ?? msg`An unknown error occurred`)}</p>

      {children}

      {showDetails && (
        <ErrorDetails
          name={parsed.name}
          code={parsed.code}
          message={parsed.message}
          payload={parsed.payload}
          stack={parsed.stack}
          className="text-foreground mt-0"
        />
      )}

      {retry != null && (
        <div>
          <Button variant="secondary" size="sm" onClick={() => retry()}>
            {retryLabel || <Trans>Retry</Trans>}
          </Button>
        </div>
      )}
    </ErrorCard>
  )
}
