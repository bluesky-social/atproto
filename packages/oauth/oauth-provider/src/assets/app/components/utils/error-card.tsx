import { Trans } from '@lingui/react/macro'
import { memo, useEffect, useState } from 'react'
import { JsonErrorResponse } from '../../lib/json-client.ts'
import { Override } from '../../lib/util.ts'
import { InputInfoCard, InputInfoCardProps } from '../forms/input-info-card.tsx'
import { ErrorMessage } from './error-message.tsx'
import { ExpandTransition } from './expand-transition.tsx'

export type ApiErrorProps = Override<
  Omit<InputInfoCardProps, 'onIconClick' | 'children'>,
  {
    error: unknown
    role?: InputInfoCardProps['role']
  }
>
export const ErrorCard = memo(function ErrorCard({
  role = 'alert',
  error,

  // InputInfoCard
  onClick,
  ...props
}: ApiErrorProps) {
  const [clickCount, setClickCount] = useState(0)

  useEffect(() => {
    // For debugging purposes
    console.warn('Displayed error details:', error)

    setClickCount(0)
  }, [error])

  return (
    <InputInfoCard
      role={role}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) setClickCount((c) => c + 1)
      }}
      {...props}
    >
      <ErrorMessage error={error} />

      <ExpandTransition
        // Every 5th click will toggle showing the details
        visible={((clickCount / 5) | 0) % 2 === 1}
      >
        {error instanceof JsonErrorResponse ? (
          <dl className="mt-2 grid grid-cols-[auto,1fr] gap-x-2 text-sm">
            <dt className="font-semibold">
              <Trans>Code</Trans>
            </dt>
            <dd>
              <code>{error.error}</code>
            </dd>

            <dt className="font-semibold">
              <Trans>Description</Trans>
            </dt>
            <dd>{error.description}</dd>
          </dl>
        ) : (
          <pre className="text-xs">{JSON.stringify(error, null, 2)}</pre>
        )}
      </ExpandTransition>
    </InputInfoCard>
  )
})
