import { Trans, useLingui } from '@lingui/react/macro'
import { XIcon } from '@phosphor-icons/react'
import * as Popover from '@radix-ui/react-popover'
import { ReactNode } from 'react'
import { useAuthenticationContext } from '#/contexts/authentication.tsx'
import { useSessionContext } from '#/contexts/session.tsx'
import { Button, ButtonProps } from '../forms/button.tsx'
import { AccountImage } from './account-image.tsx'
import { AccountOverview } from './account-overview.tsx'

export type AccountSelectorProps = Omit<
  ButtonProps,
  'shape' | 'transparent' | 'color'
>

export function AccountSelector(props: AccountSelectorProps): ReactNode {
  const { t } = useLingui()
  const { session, canSwitchAccounts } = useAuthenticationContext()
  const { setSession, doSignOut } = useSessionContext()

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button
          aria-label={t`Account selector`}
          shape="circle"
          transparent
          color="grey"
          {...props}
        >
          <AccountImage account={session.account} size={props.size} />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="end"
          className="w-full"
          sideOffset={5}
          style={{ width: 320 }}
        >
          <div className="relative flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-800">
            <AccountOverview
              account={session.account}
              aria-label={t`Account overview`}
              className="mt-4"
            />
            <Button
              key="signout"
              onClick={() => doSignOut(session.account)}
              color="primary"
            >
              <Trans>Sign out</Trans>
            </Button>

            {canSwitchAccounts && (
              <Button key="other" onClick={() => setSession(null)}>
                <Trans>Select another account</Trans>
              </Button>
            )}

            <Popover.Close
              key="close"
              className="absolute right-2 top-2 rounded opacity-50 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
              aria-label={t`Close account selector`}
            >
              <XIcon className="size-6" aria-hidden />
            </Popover.Close>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
