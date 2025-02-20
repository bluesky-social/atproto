import { Trans } from '@lingui/react/macro'
import { memo, useMemo } from 'react'
import { InputInfoCard } from '../../components/forms/input-info-card.tsx'
import {
  LayoutWelcome,
  LayoutWelcomeProps,
} from '../../components/layouts/layout-welcome.tsx'
import { ErrorCard } from '../../components/utils/error-card.tsx'
import { Api } from '../../lib/api.ts'
import { Override } from '../../lib/util.ts'

export type ErrorViewProps = Override<
  LayoutWelcomeProps,
  {
    error: unknown
  }
>

export const ErrorView = memo(function ErrorView({
  error,

  // LayoutWelcome
  title = <Trans>Error</Trans>,
  ...props
}: ErrorViewProps) {
  const apiError = useMemo(() => Api.parseError(error), [error])

  return (
    <LayoutWelcome {...props} title={title}>
      {apiError ? (
        <ErrorCard error={apiError} />
      ) : (
        // Should never happen
        <InputInfoCard role="alert">
          {error instanceof Error ? (
            error.message
          ) : (
            <Trans>An unknown error occurred</Trans>
          )}
        </InputInfoCard>
      )}
    </LayoutWelcome>
  )
})
