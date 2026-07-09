import type { Account } from '@atproto/oauth-provider-api'
import {
  InputContainer,
  type InputContainerProps,
} from '#/components/forms/input-container.tsx'
import type { Override } from '#/lib/util.ts'
import { AccountIdentifier } from './account-identifier.tsx'
import { AccountImage } from './account-image.tsx'
import { AccountName } from './account-name.tsx'

export type AccountCardProps = Override<
  InputContainerProps,
  {
    account: Account
    icon?: never
  }
>

export function AccountCard({ account, ...props }: AccountCardProps) {
  return (
    <InputContainer icon={<AccountImage account={account} />} {...props}>
      <div className="min-w-0 flex-1">
        {account.name && (
          <AccountName
            account={account}
            className="block truncate font-medium"
          />
        )}

        <AccountIdentifier
          account={account}
          className="block truncate text-sm text-neutral-500 dark:text-neutral-400"
        />
      </div>
    </InputContainer>
  )
}
