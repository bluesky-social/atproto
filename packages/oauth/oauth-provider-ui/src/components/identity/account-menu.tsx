import { Trans, useLingui } from '@lingui/react/macro'
import { useNavigate } from '@tanstack/react-router'
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
 * The sidebar footer account switcher.
 *
 * @NOTE `render` gives each item a real `<button>` under `Menu.Item`'s
 * semantics, which otherwise defaults to a `<div role="menuitem">`. They then
 * need an explicit `w-full`, since a `<button>` shrink-wraps to its content
 * where that `<div>` would not.
 *
 * Only valid inside a `SidebarProvider`: it reads `useSidebar()` to place the
 * menu below on mobile and to the side on desktop.
 */
export function AccountMenu({ className }: AccountMenuProps): ReactNode {
  const { t } = useLingui()
  const { session, canSwitchAccounts } = useAuthenticationContext()
  const { api, leave } = useSessionContext()
  const { isMobile } = useSidebar()
  const navigate = useNavigate()

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
            {/* @NOTE Deliberately not desaturated: a real profile picture is
              the one thing on the page that should carry the user's own
              colour. */}
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
                  onClick={() => navigate({ to: '/account/sign-in' })}
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
                  // @NOTE Dropping the session is enough to send the route
                  // guard back to the account entry. In the popup/webview
                  // embedding, signing out is instead what "done" means.
                  await leave?.()
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
