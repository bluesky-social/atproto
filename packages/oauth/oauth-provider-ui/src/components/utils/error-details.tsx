import { Trans } from '@lingui/react/macro'
import { clsx } from 'clsx'
import type { JSX, ReactNode } from 'react'
import type { Override } from '#/lib/util.ts'

export type ErrorDetailsProps = Override<
  JSX.IntrinsicElements['dl'],
  {
    name?: string
    code?: string
    message?: string
    payload?: string
    stack?: string
  }
>

export function ErrorDetails({
  name,
  code,
  message,
  payload,
  stack,

  // dl
  className,
  ...props
}: ErrorDetailsProps) {
  return (
    <dl
      className={clsx(
        'mt-2 grid max-w-full grid-cols-[auto_1fr] gap-x-2 text-sm',
        className,
      )}
      {...props}
    >
      {name && (
        <DetailRow label={<Trans context="Error">Name</Trans>}>
          <code>{name}</code>
        </DetailRow>
      )}

      {code && (
        <DetailRow label={<Trans context="Error">Code</Trans>}>
          <code>{code}</code>
        </DetailRow>
      )}

      {message && (
        <DetailRow label={<Trans context="Error">Message</Trans>}>
          {message}
        </DetailRow>
      )}

      {payload && (
        <DetailRow label={<Trans context="Error">Payload</Trans>}>
          <code className="max-h-[200px] overflow-auto">
            <pre>{payload}</pre>
          </code>
        </DetailRow>
      )}

      {stack && (
        <DetailRow label={<Trans context="Error">Stack</Trans>}>
          <code className="max-h-[200px] overflow-auto">
            <pre>{stack}</pre>
          </code>
        </DetailRow>
      )}
    </dl>
  )
}

function DetailRow({
  children,
  label,
}: {
  children: ReactNode
  label: ReactNode
}) {
  return (
    <>
      <dt className="font-semibold">{label}</dt>
      <dd>{children}</dd>
    </>
  )
}
