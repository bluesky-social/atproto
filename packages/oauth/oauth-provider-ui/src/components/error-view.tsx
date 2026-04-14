import { msg } from '@lingui/core/macro'
import { Override } from '#/lib/util.ts'
import { LayoutApp, LayoutAppProps } from './layouts/layout-app.tsx'
import { ErrorCard } from './utils/error-card.tsx'

export type ErrorViewProps = Override<
  LayoutAppProps,
  {
    error: unknown
    reset?: () => void
    children?: never
  }
>

export function ErrorView({
  // FallbackProps
  error,
  reset,
  // LayoutAppProps
  title = msg`An error occurred`,
  ...props
}: ErrorViewProps) {
  return (
    <LayoutApp title={title} {...props}>
      <ErrorCard error={error} reset={reset} />
    </LayoutApp>
  )
}

export function errorViewRender(props: ErrorViewProps) {
  return <ErrorView {...props} />
}
