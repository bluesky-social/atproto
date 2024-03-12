import { ErrorCard, ErrorCardProps } from '../components/error-card'
import { PageLayout } from '../components/page-layout'

export type ErrorViewProps = ErrorCardProps & {
  title?: string
}

export function ErrorView({
  title = 'An error occurred',
  ...props
}: ErrorViewProps) {
  return (
    <PageLayout title={title}>
      <ErrorCard className="max-w-lg w-full" {...props} />
    </PageLayout>
  )
}
