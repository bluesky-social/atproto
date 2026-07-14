import { Trans, useLingui } from '@lingui/react/macro'
import { AtIcon, CaretRightIcon } from '@phosphor-icons/react'
import { clsx } from 'clsx'
import type { JSX, ReactNode } from 'react'
import type { Session } from '@atproto/oauth-provider-api'
import type { Override } from '#/lib/util.ts'
import { Button } from './forms/button.tsx'
import { InputContainer } from './forms/input-container.tsx'
import { AccountCard } from './utils/account-card.tsx'
import { stringifyHandle } from './utils/handle.tsx'

export type SignInPickerProps = Override<
  JSX.IntrinsicElements['div'],
  {
    sessions: readonly Session[]

    onSession: (session: Session) => void
    onOther?: () => void
    onBack?: () => void
    onSignUp?: () => void

    backLabel?: ReactNode
  }
>

export function SignInPicker({
  sessions,

  onSession,
  onOther = undefined,
  onBack,
  onSignUp,

  backLabel,

  // div
  children,
  className,
  ...props
}: SignInPickerProps) {
  const { t } = useLingui()
  return (
    <div {...props} className={clsx('flex flex-col gap-4', className)}>
      <p className="text-text-light text-sm font-medium">
        <Trans>Sign in as...</Trans>
      </p>

      {sessions.map((session) => (
        <AccountCard
          key={session.account.did}
          account={session.account}
          append={<CaretRightIcon aria-hidden className="h-4" />}
          onAction={(event) => {
            event.preventDefault()
            event.stopPropagation()

            onSession(session)
          }}
          aria-label={t`Sign in as ${session.account.name ?? stringifyHandle(session.account.handle) ?? session.account.did}`}
        />
      ))}

      {onOther && (
        <InputContainer
          key="other"
          onAction={onOther}
          aria-label={t`Login to account that is not listed`}
          append={<CaretRightIcon aria-hidden className="h-4" />}
          icon={<AtIcon aria-hidden weight="bold" className="h-4 w-6" />}
        >
          <span className="text-text-light flex-1 truncate">
            <Trans>Another account</Trans>
          </span>
        </InputContainer>
      )}

      {children}

      <div
        key="actions"
        className="flex flex-row-reverse flex-wrap items-center justify-start gap-2"
      >
        {onSignUp && (
          <Button onClick={onSignUp} color="primary" transparent>
            <Trans>Sign up</Trans>
          </Button>
        )}
        <div className="flex-auto" />
        {onBack && (
          <Button onClick={onBack}>{backLabel || <Trans>Back</Trans>}</Button>
        )}
      </div>
    </div>
  )
}
