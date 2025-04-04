import { Trans } from '@lingui/react/macro'
import { ErrorComponentProps } from '@tanstack/react-router'

export function ErrorScreen({
  title,
  description,
}: {
  title?: string
  description: string
}) {
  return (
    <main className="bg-contrast-25 min-h-screen px-4 pt-16 md:px-6">
      <div
        className="mx-auto w-full"
        style={{ maxWidth: 600, minHeight: '100vh' }}
      >
        <div role="alert">
          <h1 className="text-3xl font-bold">
            {title || <Trans>Whoops! An error occurred.</Trans>}
          </h1>
          <p>{description}</p>
        </div>
      </div>
    </main>
  )
}

export function RouterErrorComponent({ error }: ErrorComponentProps) {
  return <ErrorScreen description={error.message} />
}
