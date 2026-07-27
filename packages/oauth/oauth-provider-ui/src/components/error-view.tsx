import { msg } from '@lingui/core/macro'
import type { ReactNode } from 'react'
import {
  ErrorNotice,
  type ErrorParser,
} from '#/components/feedback/error-notice.tsx'
import {
  AppShell,
  type AppShellProps,
} from '#/components/layouts/app-shell.tsx'
import { apiErrorParser } from '#/lib/api-error-parser.ts'
import type { Override } from '#/lib/util.ts'

export type ErrorViewProps = Override<
  AppShellProps,
  {
    error: unknown
    parser?: ErrorParser
    retry?: () => void
    retryLabel?: ReactNode
  }
>

export function ErrorView({
  // FallbackProps
  error,
  parser = apiErrorParser,
  retry,
  retryLabel,
  // AppShellProps
  title = msg`An error occurred`,
  children,
  ...props
}: ErrorViewProps) {
  // @TODO improve error page
  return (
    <AppShell title={title} {...props}>
      <div className="w-[500px] max-w-full">
        <ErrorNotice
          className="mx-5"
          error={error}
          parser={parser}
          retry={retry}
          retryLabel={retryLabel}
        >
          {children}
        </ErrorNotice>
      </div>
    </AppShell>
  )
}
