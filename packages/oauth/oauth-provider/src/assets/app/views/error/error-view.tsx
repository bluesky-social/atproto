import { useMemo } from 'react'
import { ErrorData } from '../../backend-data'
import {
  LayoutWelcome,
  LayoutWelcomeProps,
} from '../../components/layouts/layout-welcome'
import { ApiError } from '../../components/utils/api-error'
import { Api } from '../../lib/api'
import { Override } from '../../lib/util'

export type ErrorViewProps = Override<
  LayoutWelcomeProps,
  {
    errorData?: ErrorData
  }
>

export function ErrorView({
  errorData,

  // LayoutWelcome
  ...props
}: ErrorViewProps) {
  const error = useMemo(
    () => (errorData ? Api.parseError(errorData) : undefined),
    [errorData],
  )

  // Should never happen
  if (!error) return null

  return (
    <LayoutWelcome {...props}>
      <ApiError error={error} />
    </LayoutWelcome>
  )
}
