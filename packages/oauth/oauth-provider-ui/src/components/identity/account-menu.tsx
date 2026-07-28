import { Trans, useLingui } from '@lingui/react/macro'
import { EllipsisVerticalIcon, LogOutIcon, UsersIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu.tsx'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '#/components/ui/sidebar.tsx'
import { useAuthenticationContext } from '#/contexts/authentication.tsx'
import { useSessionContext } from '#/contexts/session.tsx'
import { cn } from '#/lib/utils.ts'
import { AccountAvatar } from './account-avatar.tsx'
import { AccountIdentifier } from './account-identifier.tsx'
import { AccountName } from './account-name.tsx'

export type AccountMenuProps = {
  className?: string
}

/**
 * The sidebar footer account switcher, structured after the dashboard block's
 * `nav-user`.
 *
 * @NOTE Each item is rendered as a real `<button>` via Base UI's `render` prop.
 * `Menu.Item` defaults to a `<div role="menuitem">`, and the pds e2e suite
 * clicks "Se déconnecter" with `clickOnText(text, 'button')` — the `render`
 * override keeps proper menu semantics *and* a button element.
 *
 * The items also need an explicit `w-full`: a <button> shrink-wraps to its
 * content even as a flex container, where the <div> the block uses fills the
 * menu width on its own.
 *
 * Only valid inside a `SidebarProvider`: it reads `useSidebar()` to place the
 * menu below on mobile and to the side on desktop, as the block does.
 */
export function AccountMenu({ className }: AccountMenuProps): ReactNode {
  const { t } = useLingui()
  const { session, canSwitchAccounts } = useAuthenticationContext()
  const { setSession, api } = useSessionContext()
  const { isMobile } = useSidebar()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                aria-label={t`Account selector`}
                className={cn('aria-expanded:bg-muted', className)}
              />
            }
          >
            <AccountAvatar
              account={session.account}
              size="lg"
              className="rounded-lg grayscale"
            />
            <div className="grid flex-1 text-left text-sm leading-tight">
              <AccountName
                account={session.account}
                className="truncate font-medium"
              />
              <AccountIdentifier
                account={session.account}
                className="text-foreground/70 truncate text-xs"
              />
            </div>
            <EllipsisVerticalIcon aria-hidden className="ml-auto size-4" />
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="min-w-56"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel
                className="p-0 font-normal"
                aria-label={t`Account overview`}
              >
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <AccountAvatar
                    account={session.account}
                    size="lg"
                    className="rounded-lg"
                  />
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <AccountName
                      account={session.account}
                      className="truncate font-medium"
                    />
                    <AccountIdentifier
                      account={session.account}
                      className="text-muted-foreground truncate text-xs"
                    />
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              {canSwitchAccounts && (
                <DropdownMenuItem
                  className="w-full"
                  render={<button type="button" />}
                  onClick={() => setSession(null)}
                >
                  <UsersIcon aria-hidden />
                  <Trans>Select another account</Trans>
                </DropdownMenuItem>
              )}

              <DropdownMenuItem
                className="w-full"
                render={<button type="button" />}
                onClick={async () => {
                  await api.signOut(session.account)
                }}
              >
                <LogOutIcon aria-hidden />
                <Trans>Sign out</Trans>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
