import { Trans, useLingui } from '@lingui/react/macro'
import { AtIcon, CaretRightIcon } from '@phosphor-icons/react'
import { ReactNode } from 'react'
import type { Session } from '@atproto/oauth-provider-api'
import { Override } from '#/lib/util.ts'
import { Button } from './forms/button.tsx'
import { FormCard, FormCardProps } from './forms/form-card.tsx'
import { InputContainer } from './forms/input-container.tsx'
import { AccountCard } from './utils/account-card.tsx'
import { getAccountHandle } from './utils/account-handle.tsx'

export type SignInPickerProps = Override<
  Omit<FormCardProps, 'cancel' | 'actions' | 'append'>,
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

  // FormCard
  children,
  ...props
}: SignInPickerProps) {
  const { t } = useLingui()
  return (
    <FormCard
      {...props}
      append={children}
      actions={
        onSignUp && (
          <Button onClick={onSignUp} color="primary" transparent>
            <Trans>Sign up</Trans>
          </Button>
        )
      }
      cancel={
        onBack && (
          <Button onClick={onBack}>{backLabel || <Trans>Back</Trans>}</Button>
        )
      }
    >
      <p className="text-text-light text-sm font-medium">
        <Trans>Sign in as...</Trans>
      </p>

      {sessions.map((session) => (
        <AccountCard
          key={session.account.sub}
          account={session.account}
          append={<CaretRightIcon aria-hidden className="h-4" />}
          onAction={(event) => {
            event.preventDefault()
            event.stopPropagation()

            onSession(session)
          }}
          aria-label={t`Sign in as ${session.account.name ?? getAccountHandle(session.account) ?? session.account.sub}`}
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
    </FormCard>
  )
}
