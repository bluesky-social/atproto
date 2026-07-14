import { msg } from '@lingui/core/macro'
import { ReactNode } from 'react'
import { apiErrorParser } from '#/lib/api-error-parser.ts'
import { Override } from '#/lib/util.ts'
import { LayoutApp, LayoutAppProps } from './layouts/layout-app.tsx'
import { ErrorCard, ErrorParser } from './utils/error-card.tsx'

export type ErrorViewProps = Override<
  LayoutAppProps,
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
  // LayoutAppProps
  title = msg`An error occurred`,
  children,
  ...props
}: ErrorViewProps) {
  // @TODO improve error page
  return (
    <LayoutApp title={title} {...props}>
      <div className="w-[500px] max-w-full">
        <ErrorCard
          className="mx-5"
          error={error}
          parser={parser}
          retry={retry}
          retryLabel={retryLabel}
        >
          {children}
        </ErrorCard>
      </div>
    </LayoutApp>
  )
}
