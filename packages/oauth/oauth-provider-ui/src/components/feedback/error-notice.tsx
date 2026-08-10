import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import {
  type ErrorParser,
  type ParsedError,
  parseError,
} from '#/lib/error-parser.ts'
import type { Override } from '#/lib/util.ts'
import { ErrorDetails } from './error-details.tsx'
import { Notice, NoticeAction, type NoticeProps } from './notice.tsx'

export type { ErrorParser, ParsedError }

export type ErrorNoticeProps = Override<
  Omit<NoticeProps, 'role' | 'append' | 'action'>,
  {
    error: unknown
    retry?: () => void
    retryLabel?: ReactNode
    parser?: ErrorParser
  }
>

export function ErrorNotice({
  error,
  retry,
  retryLabel,
  parser,

  // Notice
  children,
  onClick,
  ...props
}: ErrorNoticeProps) {
  const { _ } = useLingui()
  const [clickCount, setClickCount] = useState(0)

  // Every 5th click; toggle showing the details
  const showDetails = ((clickCount / 5) | 0) % 2 === 1

  const parsed = useMemo<ParsedError>(
    () => parser?.(error) ?? parseError(error),
    [parser, error],
  )

  useEffect(() => {
    // For debugging purposes
    console.warn('Displayed error:', parsed)

    // Reset the click count when the error changes
    setClickCount(0)
  }, [parsed])

  return (
    <Notice
      {...props}
      role="alert"
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) setClickCount((c) => c + 1)
      }}
      append={
        <>
          {children}
          {showDetails && (
            <ErrorDetails
              name={parsed.name}
              code={parsed.code}
              message={parsed.message}
              payload={parsed.payload}
              stack={parsed.stack}
            />
          )}
        </>
      }
      action={
        retry != null && (
          <NoticeAction onClick={() => retry()}>
            {retryLabel || <Trans>Retry</Trans>}
          </NoticeAction>
        )
      }
    >
      {_(parsed.description ?? msg`An unknown error occurred`)}
    </Notice>
  )
}

export const errorNoticeRender = (props: ErrorNoticeProps) => (
  <ErrorNotice {...props} />
)
