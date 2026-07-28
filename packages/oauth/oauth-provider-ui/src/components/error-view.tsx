import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import type { ReactNode } from 'react'
import {
  ErrorNotice,
  type ErrorParser,
} from '#/components/feedback/error-notice.tsx'
import { AuthShell } from '#/components/layouts/auth-shell.tsx'
import { apiErrorParser } from '#/lib/api-error-parser.ts'

export type ErrorViewProps = {
  error: unknown
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
 * @NOTE Framed with `AuthShell` so it matches the sign-in screens. Every
 * call site renders this *instead of* the
 * tree — the boundaries sit above `RouterProvider`, and the `errorComponent`s
 * hang off the root route — so this shell never nests inside another one. That
 * matters: both shells render a `<title>`, React hoists every `<title>` into
 * the head, and the last one wins.
 *
 * @NOTE The props are declared explicitly rather than derived from the shell's.
 * TanStack passes `reset` and `info` to an `errorComponent`, and `AuthShell`
 * spreads unrecognised props onto a `<div>` — forwarding them would put invalid
 * attributes on the DOM.
 */
export function ErrorView({
  error,
  parser = apiErrorParser,
  retry,
  retryLabel,
  title = msg`An error occurred`,
  children,
}: ErrorViewProps) {
  return (
    <AuthShell title={title}>
      <ErrorNotice
        error={error}
        parser={parser}
        retry={retry}
        retryLabel={retryLabel}
      >
        {children}
      </ErrorNotice>
    </AuthShell>
  )
}
