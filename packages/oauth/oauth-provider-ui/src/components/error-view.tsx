import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
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
 * Shaped like every other auth screen — heading, one line of copy, a stack
 * of actions — so an error does not look like a different product. The copy
 * is the parsed description; the error code, when there is one, sits under
 * it in small type for support conversations. Clicking the copy five times
 * toggles the technical details, as `ErrorNotice` does.
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

  // Without a caller-supplied retry, the page can still be reloaded — the
  // standalone error page has no app around it to recover into.
  const canGoBack = typeof window !== 'undefined' && window.history.length > 1

  return (
    <AuthShell
      title={title}
      subtitle={
        parsed && (
          <span
            role="alert"
            onClick={() => setClickCount((c) => c + 1)}
            className="text-balance"
          >
            {_(parsed.description ?? msg`An unknown error occurred`)}
          </span>
        )
      }
    >
      <div className="flex flex-col gap-5">
        {parsed?.code && !showDetails && (
          <p className="text-muted-foreground text-center font-mono text-xs">
            <Trans context="Error">Code</Trans>: {parsed.code}
          </p>
        )}

        {showDetails && parsed && (
          <ErrorDetails
            name={parsed.name}
            code={parsed.code}
            message={parsed.message}
            payload={parsed.payload}
            stack={parsed.stack}
            className="mt-0"
          />
        )}

        <div className="flex flex-col gap-2">
          <Button
            className={cn(actionButton, 'w-full')}
            onClick={() => (retry ? retry() : window.location.reload())}
          >
            {retryLabel || <Trans>Try again</Trans>}
          </Button>
          {canGoBack && (
            <Button
              variant="secondary"
              className={cn(actionButton, 'w-full')}
              onClick={() => window.history.back()}
            >
              <Trans>Go back</Trans>
            </Button>
          )}
          {children}
        </div>
      </div>
    </AuthShell>
  )
}
