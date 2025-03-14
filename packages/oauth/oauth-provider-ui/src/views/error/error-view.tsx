import { useLingui } from '@lingui/react/macro'
import { memo } from 'react'
import {
  LayoutWelcome,
  LayoutWelcomeProps,
} from '../../components/layouts/layout-welcome.tsx'
import { ErrorCard } from '../../components/utils/error-card.tsx'
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
  title,
  ...props
}: ErrorViewProps) {
  const { t } = useLingui()

  return (
    <LayoutWelcome {...props} title={title ?? t`Error`}>
      <ErrorCard error={error} />
    </LayoutWelcome>
  )
})
