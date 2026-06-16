import { msg } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { Account } from '@atproto/oauth-provider-api'
import { LayoutTitle } from '#/components/layouts/layout-title.tsx'
import { AccountOverview } from '#/components/utils/account-overview.tsx'
import { ButtonCooldown } from './forms/button-cooldown.tsx'
import { AccountIdentifier } from './utils/account-identifier.tsx'

export type ReactivateAccountViewProps = {
  account: Account
  onReactivate: () => void | PromiseLike<void>
  onCancel?: () => void | PromiseLike<void>
}

export function ReactivateAccountView({
  account,
  onReactivate,
  onCancel,
}: ReactivateAccountViewProps) {
  return (
    <LayoutTitle
      title={msg`Welcome back!`}
      subtitle={<Trans>Your account is currently deactivated.</Trans>}
    >
      <div className="flex w-full max-w-md flex-col items-stretch gap-6">
        <AccountOverview account={account} />

        <p className="text-text-light text-center">
          <Trans>
            You previously deactivated <AccountIdentifier account={account} />.
            You can reactivate your account to continue logging in. Your content
            (profile, posts, feeds, lists, etc.) will become visible again to
            other users.
          </Trans>
        </p>

        <div className="flex flex-col gap-3">
          <ButtonCooldown
            color="primary"
            className="w-full"
            action={onReactivate}
            cooldown={0}
          >
            <Trans>Yes, reactivate my account</Trans>
          </ButtonCooldown>

          {onCancel && (
            <ButtonCooldown
              color="darkGrey"
              className="w-full"
              action={onCancel}
              cooldown={0}
            >
              <Trans>Cancel</Trans>
            </ButtonCooldown>
          )}
        </div>
      </div>
    </LayoutTitle>
  )
}
