import { Trans, useLingui } from '@lingui/react/macro'
import { AtSignIcon, ChevronRightIcon } from 'lucide-react'
import type { JSX, ReactNode } from 'react'
import type { Session } from '@atproto/oauth-provider-api'
import { Button } from '#/components/ui/button.tsx'
import type { Override } from '#/lib/util.ts'
import { cn } from '#/lib/utils.ts'
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
    <div {...props} className={cn('flex flex-col gap-4', className)}>
      <p className="text-muted-foreground text-sm font-medium">
        <Trans>Sign in as...</Trans>
      </p>

      {sessions.map((session) => (
        <AccountCard
          key={session.account.did}
          account={session.account}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()

            onSession(session)
          }}
          aria-label={t`Sign in as ${session.account.name ?? stringifyHandle(session.account.handle) ?? session.account.did}`}
        />
      ))}

      {onOther && (
        <button
          key="other"
          type="button"
          onClick={onOther}
          aria-label={t`Sign in to an account that is not listed`}
          className={cn(
            'border-input bg-background flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left',
            'hover:bg-accent hover:text-accent-foreground transition-colors',
            'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2',
          )}
        >
          <AtSignIcon aria-hidden className="size-5 shrink-0" />
          <span className="text-muted-foreground flex-1 truncate">
            <Trans>Another account</Trans>
          </span>
          <ChevronRightIcon aria-hidden className="size-4 shrink-0" />
        </button>
      )}

      {children}

      <div
        key="actions"
        className="flex flex-row-reverse flex-wrap items-center justify-start gap-2"
      >
        {onSignUp && (
          <Button variant="ghost" onClick={onSignUp}>
            <Trans>Sign up</Trans>
          </Button>
        )}
        <div className="flex-auto" />
        {onBack && (
          <Button variant="secondary" onClick={onBack}>
            {backLabel || <Trans>Back</Trans>}
          </Button>
        )}
      </div>
    </div>
  )
}
