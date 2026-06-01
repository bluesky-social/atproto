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
  // @TODO improve error page
  return (
    <LayoutApp title={title} {...props}>
      <div className="w-[500px] max-w-full">
        <ErrorCard className="mx-5" error={error} reset={reset} />
      </div>
    </LayoutApp>
  )
}

export const errorViewRender = (props: ErrorViewProps) => (
  <ErrorView {...props} />
)
