import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { DotsHorizontalIcon } from '@radix-ui/react-icons'
import * as Popover from '@radix-ui/react-popover'
import { clsx } from 'clsx'
import { Avatar } from '#/components/Avatar'
import { Link } from '#/components/Link'
import { useCurrentSession } from '#/data/useCurrentSession'
import { useDeviceSessionsQuery } from '#/data/useDeviceSessionsQuery'
import { getAccountName } from '#/util/getAccountName'
import { sanitizeHandle } from '#/util/sanitizeHandle'

export function AccountSelector() {
  const { _ } = useLingui()
  const { data } = useDeviceSessionsQuery()
  const { account: currentAccount } = useCurrentSession()

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          className={clsx([
            'flex items-center truncate border py-1 pl-1 pr-3',
            'bg-contrast-0 dark:bg-contrast-25 border-contrast-50 dark:border-contrast-100',
            'hover:bg-contrast-25 dark:hover:bg-contrast-50 hover:border-contrast-100 dark:hover:border-contrast-200 space-x-2 rounded-lg',
          ])}
          aria-label={_(msg`Select an account`)}
          style={{ maxWidth: 220 }}
        >
          <div>
            <Avatar
              size={36}
              src={currentAccount.picture}
              displayName={currentAccount.name}
            />
          </div>
          <div className="flex-1 truncate text-left">
            <p className="text-text-default truncate text-sm font-bold leading-tight">
              {getAccountName(currentAccount)}
            </p>
            <p className="text-text-light truncate text-sm leading-tight">
              {sanitizeHandle(currentAccount.preferred_username)}
            </p>
          </div>
          <div className="pl-4">
            <DotsHorizontalIcon width={20} />
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
          <div className="bg-contrast-0 dark:bg-contrast-25 border-contrast-25 dark:border-contrast-50 shadow-contrast-900/15 dark:shadow-contrast-0/60 relative rounded-lg border shadow-xl">
            <div className="flex flex-col overflow-hidden rounded-lg">
              {data.map(({ account }, i) => (
                <Link
                  key={account.sub}
                  to="/account/$sub"
                  params={account}
                  className={clsx([
                    'flex items-center space-x-3 p-3 pr-4',
                    'hover:bg-contrast-25 dark:hover:bg-contrast-50',
                    i !== 0 &&
                      'border-contrast-25 dark:border-contrast-50 border-t',
                  ])}
                >
                  <img src={account.picture} className="h-9 w-9 rounded-full" />
                  <div className="truncate text-left">
                    <div className="flex items-center space-x-1">
                      <p className="text-text-default text-sm font-bold leading-snug">
                        {getAccountName(account)}
                      </p>
                      <p className="text-text-light truncate text-sm leading-snug">
                        {sanitizeHandle(account.preferred_username)}
                      </p>
                    </div>
                    <p className="text-text-light truncate text-sm leading-snug">
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
