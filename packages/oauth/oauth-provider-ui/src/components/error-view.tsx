import { msg } from '@lingui/core/macro'
import { Override } from '#/lib/util.ts'
import { LayoutApp, LayoutAppProps } from './layouts/layout-app.tsx'
import { ErrorCard, ErrorCardProps } from './utils/error-card.tsx'

export type ErrorViewProps = Override<
  ErrorCardProps,
  Pick<LayoutAppProps, 'header' | 'title'>
>

export function ErrorView({
  // LayoutAppProps
  title = msg`Error`,
  header,
  // ErrorCardProps
  ...props
}: ErrorViewProps) {
  return (
    <LayoutApp title={title} header={header}>
      <ErrorCard {...props} />
    </LayoutApp>
  )
}
