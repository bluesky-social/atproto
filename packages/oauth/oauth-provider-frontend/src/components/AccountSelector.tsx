import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { DotsHorizontalIcon } from '@radix-ui/react-icons'
import * as Popover from '@radix-ui/react-popover'
import { clsx } from 'clsx'
import { Avatar } from '#/components/Avatar'
import { Button } from '#/components/Button'
import { Link } from '#/components/Link'
import { useCurrentSession } from '#/data/useCurrentSession'
import { useDeviceSessionsQuery } from '#/data/useDeviceSessionsQuery'
import { useSignOutMutation } from '#/data/useSignOutMutation'
import { getAccountName } from '#/util/getAccountName'
import { sanitizeHandle } from '#/util/sanitizeHandle'

export function AccountSelector() {
  const { _ } = useLingui()
  const { data } = useDeviceSessionsQuery()
  const { account: currentAccount } = useCurrentSession()

  const { mutate: signOut } = useSignOutMutation()

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          className={clsx([
            'flex items-center space-x-2 truncate rounded-lg border py-1 pl-1 pr-3',
            'bg-contrast-0 dark:bg-contrast-25 border-contrast-50 dark:border-contrast-100',
            'hover:bg-contrast-25 dark:hover:bg-contrast-50 hover:border-contrast-100 dark:hover:border-contrast-200',
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
                    'flex items-center space-x-2 py-2 pl-2 pr-4',
                    'hover:bg-contrast-25 dark:hover:bg-contrast-50 focus:bg-contrast-25 dark:focus:bg-contrast-50',
                    i !== 0 &&
                      'border-contrast-25 dark:border-contrast-50 border-t',
                  ])}
                >
                  <Avatar
                    size={36}
                    src={account.picture}
                    displayName={account.name}
                  />
                  <div className="flex-1 space-x-1 truncate text-left">
                    <p className="text-text-default truncate text-sm font-bold leading-snug">
                      {getAccountName(account)}
                    </p>
                    <p className="text-text-light truncate text-sm leading-snug">
                      {sanitizeHandle(account.preferred_username)}
                    </p>
                  </div>
                  <div className="flex-shrink">
                    <Button
                      size="sm"
                      color="secondary"
                      onClick={(e) => {
                        // technically invalid markup to have a button inside a link :/
                        // prevent click from bubbling up to the Link
                        e.stopPropagation()
                        e.preventDefault()
                        signOut({ sub: account.sub })
                      }}
                    >
                      <Button.Text>
                        <Trans>Sign out</Trans>
                      </Button.Text>
                    </Button>
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
