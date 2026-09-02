import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { CircleAlertIcon } from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { ErrorDetails } from '#/components/feedback/error-details.tsx'
import type { ErrorParser } from '#/components/feedback/error-notice.tsx'
import { actionButton } from '#/components/forms/form-shell.tsx'
import { AuthShell } from '#/components/layouts/auth-shell.tsx'
import { Button } from '#/components/ui/button.tsx'
import { apiErrorParser } from '#/lib/api-error-parser.ts'
import { type ParsedError, parseError } from '#/lib/error-parser.ts'
import { cn } from '#/lib/utils.ts'

export type ErrorViewProps = {
  error?: unknown
  parser?: ErrorParser
  retry?: () => void
  retryLabel?: ReactNode
  title?: string | MessageDescriptor
  children?: ReactNode
}

/**
 * The error surface for the whole app: the standalone error page, both
 * `ErrorBoundary` fallbacks, and the router's `errorComponent`.
 *
 * Laid out as a calm full-card state — an alert disc, the heading, the
 * message as plain copy — rather than a boxed alert inside an otherwise
 * empty card. Clicking the message five times toggles the technical details,
 * as `ErrorNotice` does.
 *
 * @NOTE Framed with `AuthShell`, which every call site renders *instead of* the
 * tree, never inside it — so the two shells cannot nest and fight over the
 * `<title>`.
 *
 * @NOTE The props are declared explicitly rather than derived from the shell's:
 * TanStack passes `reset` and `info` to an `errorComponent`, and `AuthShell`
 * spreads unrecognised props onto a `<div>`, which would put invalid attributes
 * on the DOM.
 */
export function ErrorView({
  error,
  parser = apiErrorParser,
  retry,
  retryLabel,
  title = msg`Something went wrong`,
  children,
}: ErrorViewProps) {
  const { _ } = useLingui()
  const [clickCount, setClickCount] = useState(0)

  // Every 5th click; toggle showing the details
  const showDetails = ((clickCount / 5) | 0) % 2 === 1

  const parsed = useMemo<ParsedError | null>(
    () => (error != null ? (parser?.(error) ?? parseError(error)) : null),
    [parser, error],
  )

  useEffect(() => {
    // For debugging purposes
    if (parsed) console.warn('Displayed error:', parsed)

    // Reset the click count when the error changes
    setClickCount(0)
  }, [parsed])

  return (
    <AuthShell title={title}>
      <div className="flex flex-col items-center gap-5 text-center">
        <div
          aria-hidden
          className="bg-destructive/10 text-destructive flex size-16 items-center justify-center rounded-full"
        >
          <CircleAlertIcon className="size-8" />
        </div>

        {parsed && (
          <p
            role="alert"
            className="text-muted-foreground text-balance text-base leading-snug"
            onClick={() => setClickCount((c) => c + 1)}
          >
            {_(parsed.description ?? msg`An unknown error occurred`)}
          </p>
        )}

        {showDetails && parsed && (
          <ErrorDetails
            name={parsed.name}
            code={parsed.code}
            message={parsed.message}
            payload={parsed.payload}
            stack={parsed.stack}
            className="w-full text-left"
          />
        )}

        {(retry || children) && (
          <div className="flex w-full flex-col gap-2 pt-1">
            {retry && (
              <Button
                className={cn(actionButton, 'w-full')}
                onClick={() => retry()}
              >
                {retryLabel || <Trans>Retry</Trans>}
              </Button>
            )}
            {children}
          </div>
        )}
      </div>
    </AuthShell>
  )
}
