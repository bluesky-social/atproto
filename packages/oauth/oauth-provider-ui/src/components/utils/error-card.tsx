import { Trans } from '@lingui/react/macro'
import { ReactNode, useEffect, useState } from 'react'
import { useErrorMessage } from '#/hooks/use-error-message.ts'
import { Action, Admonition } from './admonition.tsx'
import { ErrorDetails } from './error-details.tsx'

export type ErrorCardProps = {
  className?: string
  children?: ReactNode
  error: unknown
  reset?: () => void
}

export function ErrorCard({
  error,
  reset,
  className,
  children,
}: ErrorCardProps) {
  const [inputCount, setInputCount] = useState(0)
  // Every 5th input will toggle showing the details
  const showDetails = ((inputCount / 5) | 0) % 2 === 1

  const errorMessage = useErrorMessage(error)

  useEffect(() => {
    // For debugging purposes
    console.warn('Displayed error details:', error)

    // Reset the input count when the error changes
    setInputCount(0)
  }, [error])

  return (
    <Admonition
      role="alert"
      className={className}
      onClick={() => setInputCount((c) => c + 1)}
      title={errorMessage}
      append={showDetails && <ErrorDetails error={error} />}
      action={
        reset != null && (
          <Action onClick={() => reset()}>
            <Trans>Retry</Trans>
          </Action>
        )
      }
    >
      {children}
    </Admonition>
  )
}

export const errorCardRender = (props: ErrorCardProps) => (
  <ErrorCard {...props} />
)
