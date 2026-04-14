import type { Account } from '@atproto/oauth-provider-api'
import type { Override } from '#/lib/util'
import { InputContainer, InputContainerProps } from '../forms/input-container'
import { AccountIdentifier } from './account-identifier'
import { AccountImage } from './account-image'
import { AccountName } from './account-name'

export type AccountCardProps = Override<
  InputContainerProps,
  {
    account: Account
    icon?: never
  }
>

export function AccountCard({ account, ...props }: AccountCardProps) {
  return (
    <InputContainer
      key={account.sub}
      icon={<AccountImage account={account} />}
      {...props}
    >
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
