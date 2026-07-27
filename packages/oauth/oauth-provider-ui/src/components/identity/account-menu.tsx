import { Trans, useLingui } from '@lingui/react/macro'
import { XIcon } from 'lucide-react'
import { Popover as PopoverPrimitive } from 'radix-ui'
import type { ReactNode } from 'react'
import { Button } from '#/components/ui/button.tsx'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover.tsx'
import { useAuthenticationContext } from '#/contexts/authentication.tsx'
import { useSessionContext } from '#/contexts/session.tsx'
import { cn } from '#/lib/utils.ts'
import { AccountAvatar, type AccountAvatarSize } from './account-avatar.tsx'
import { AccountSummary } from './account-summary.tsx'

export type AccountMenuProps = {
  className?: string
  size?: AccountAvatarSize
}

// @NOTE Deliberately a Popover rather than a DropdownMenu. The panel holds a
// full account summary plus real actions, which is not menu-shaped, and Radix
// menu items render as `[role=menuitem]` divs — the pds e2e suite clicks
// "Se déconnecter" via `clickOnText(text, 'button')` and needs a real <button>.
export function AccountMenu({ className, size }: AccountMenuProps): ReactNode {
  const { t } = useLingui()
  const { session, canSwitchAccounts } = useAuthenticationContext()
  const { setSession, api } = useSessionContext()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          aria-label={t`Account selector`}
          variant="ghost"
          size="icon"
          className={cn('rounded-full', className)}
        >
          <AccountAvatar account={session.account} size={size} />
        </Button>
      </PopoverTrigger>

      <PopoverContent side="top" align="end" sideOffset={5} className="w-80">
        <div className="relative flex flex-col gap-2">
          <AccountSummary
            account={session.account}
            aria-label={t`Account overview`}
            className="mt-4"
          />

          <Button
            key="signout"
            onClick={async (_event) => {
              await api.signOut(session.account)
            }}
          >
            <Trans>Sign out</Trans>
          </Button>

          {canSwitchAccounts && (
            <Button
              key="other"
              variant="secondary"
              onClick={() => setSession(null)}
            >
              <Trans>Select another account</Trans>
            </Button>
          )}

          {/* Radix's Popover.Close renders a real <button>, so asChild keeps
            the Button styling without changing the element type. */}
          <PopoverPrimitive.Close key="close" asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 opacity-50 hover:opacity-100"
              aria-label={t`Close account selector`}
            >
              <XIcon className="size-6" aria-hidden />
            </Button>
          </PopoverPrimitive.Close>
        </div>
      </PopoverContent>
    </Popover>
  )
}
