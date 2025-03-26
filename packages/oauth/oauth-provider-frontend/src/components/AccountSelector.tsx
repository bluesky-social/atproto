import React from 'react'
import { Popover } from 'radix-ui'
import { useLingui } from '@lingui/react'
import { msg } from '@lingui/core/macro'
import { clsx } from 'clsx'
import { EllipsisHorizontalIcon } from '@heroicons/react/24/outline'

import { useAccountsQuery } from '#/data/useAccountsQuery'
import { sanitizeHandle } from '#/util/sanitizeHandle'
import { getAccountName } from '#/util/getAccountName'
import { useCurrentAccount } from '#/data/useCurrentAccount'
import { Avatar } from '#/components/Avatar'
import { Link } from '#/components/Link'

export function AccountSelector() {
  const { _ } = useLingui()
  const { data: accounts } = useAccountsQuery()
  const { currentAccount } = useCurrentAccount()

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          className={clsx([
            'flex items-center truncate pl-1 pr-3 py-1 border',
            'bg-contrast-0 dark:bg-contrast-25 border-contrast-50 dark:border-contrast-100',
            'hover:bg-contrast-25 dark:hover:bg-contrast-50 hover:border-contrast-100 dark:hover:border-contrast-200 rounded-lg space-x-2',
          ])}
          aria-label={_(msg`Select an account`)}
          style={{ maxWidth: 240 }}
        >
          <div>
            <Avatar
              size={36}
              src={currentAccount.picture}
              displayName={currentAccount.name}
            />
          </div>
          <div className="text-left flex-1 truncate">
            <p className="text-sm font-bold text-text-default leading-tight truncate">
              {getAccountName(currentAccount)}
            </p>
            <p className="text-sm text-text-light truncate leading-tight">
              {sanitizeHandle(currentAccount.preferred_username)}
            </p>
          </div>
          <div className="pl-4">
            <EllipsisHorizontalIcon width={20} />
          </div>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="end"
          className="PopoverContent w-full"
          sideOffset={5}
          style={{ width: 320 }}
        >
          <div className="relative bg-contrast-0 dark:bg-contrast-25 border border-contrast-25 dark:border-contrast-50 rounded-lg shadow-xl shadow-contrast-900/15 dark:shadow-contrast-0/60">
            <div className="flex flex-col rounded-lg overflow-hidden">
              {accounts.map((account, i) => (
                <Link
                  key={account.sub}
                  to="/$did"
                  params={{ did: account.sub }}
                  className={clsx([
                    'flex items-center space-x-3 p-3 pr-4',
                    'hover:bg-contrast-25 dark:hover:bg-contrast-50',
                    i !== 0 &&
                      'border-t border-contrast-25 dark:border-contrast-50',
                  ])}
                >
                  <img src={account.picture} className="w-9 h-9 rounded-full" />
                  <div className="text-left truncate">
                    <div className="flex items-center space-x-1">
                      <p className="text-sm font-bold text-text-default leading-snug">
                        {getAccountName(account)}
                      </p>
                      <p className="text-sm text-text-light truncate leading-snug">
                        {sanitizeHandle(account.preferred_username)}
                      </p>
                    </div>
                    <p className="text-sm text-text-light truncate leading-snug">
                      {account.sub}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
