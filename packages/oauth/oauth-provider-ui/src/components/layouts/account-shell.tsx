import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import {
  Link,
  type RegisteredRouter,
  type ToPathOption,
  useRouterState,
} from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import { type ReactNode, createContext, useContext } from 'react'
import { AccountMenu } from '#/components/identity/account-menu.tsx'
import { Separator } from '#/components/ui/separator.tsx'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '#/components/ui/sidebar.tsx'
import { LinkExternal } from '#/components/utils/link-external.tsx'
import { LinkTitle } from '#/components/utils/link-title.tsx'
import { useCustomizationData } from '#/contexts/customization.tsx'
import { LocaleSelector } from '#/locales/locale-selector.tsx'

export type AccountShellLink = {
  to: ToPathOption<RegisteredRouter, '/', undefined>
  title: string | MessageDescriptor
  hidden?: boolean
  description?: string | MessageDescriptor
  icon?: LucideIcon
}

export type AccountShellProps = {
  title?: string | MessageDescriptor
  links: ReadonlyArray<AccountShellLink>
  children?: ReactNode
  prepend?: ReactNode
}

const navigationLabel = msg`Navigation`

const AccountShellLinksContext = createContext<readonly AccountShellLink[]>([])

/**
 * The shell's navigation entries, for pages that want to present them as
 * content rather than chrome — the account home page lists them as a directory.
 *
 * Exposed through context rather than threaded as props: the pages are mounted
 * by TanStack Router as `component: () => <Page />`, so there is no prop path
 * from the route that builds the links down to the page that renders them.
 */
export function useAccountShellLinks(): readonly AccountShellLink[] {
  return useContext(AccountShellLinksContext)
}

/**
 * Account-manager frame, composed the way shadcn's dashboard block does:
 * `SidebarProvider` + `Sidebar` + `SidebarInset`, with `SidebarTrigger` in the
 * inset header. That brings the collapsible rail, the mobile sheet, the
 * keyboard shortcut and the persisted open/closed state for free — all of which
 * the previous hand-rolled `<aside>` + `Sheet` had to approximate.
 *
 * @NOTE This owns the whole page frame, including its own `<title>`.
 * `assertTitle` in the pds e2e suite needs a title element, and the app title
 * (not the page title) must win — React hoists every `<title>` into the head
 * and the last one rendered takes effect.
 */
export function AccountShell({
  children,
  title,
  links,
  prepend,
}: AccountShellProps) {
  const { _ } = useLingui()
  const { pathname } = useRouterState().location
  const { logo, name, links: footerLinks } = useCustomizationData()

  const titleString = typeof title === 'object' ? _(title) : title ?? name

  const currentLink = links.find((link) => link.to === pathname)
  const pageTitle = currentLink?.title
  const pageTitleStr = typeof pageTitle === 'object' ? _(pageTitle) : pageTitle

  const visibleLinks = links.filter(
    ({ hidden, to }) => !hidden || pathname === to,
  )

  return (
    <AccountShellLinksContext value={links}>
      <SidebarProvider>
        {titleString && <title>{titleString}</title>}

        <Sidebar collapsible="offcanvas">
          <SidebarHeader>
            {/* @NOTE The brand row is a SidebarMenuButton rather than a bare div
            so it shares the nav items' geometry — as a plain flex row it sat on
            different padding and the header read as cramped against the list
            below. `render={<div/>}` keeps it non-interactive; the block links
            it, but there is nowhere to navigate to here. */}
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="data-[slot=sidebar-menu-button]:p-1.5!"
                  render={<div />}
                >
                  {logo && (
                    <img
                      src={logo}
                      alt={name || _(msg`Logo`)}
                      className="size-5! shrink-0 object-contain"
                    />
                  )}
                  <span className="text-base font-semibold">
                    {titleString ?? name}
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent className="flex flex-col gap-2">
                {/* @NOTE gap-1 is a deliberate deviation. base-nova's SidebarMenu
                is gap-0, so an active row and a hovered row directly above or
                below it merge into a single block. Spacing them keeps each
                highlight legible as its own target. */}
                <SidebarMenu className="gap-1">
                  {visibleLinks.map(({ to, title, icon: Icon }) => (
                    <SidebarMenuItem key={to}>
                      <SidebarMenuButton
                        isActive={pathname === to}
                        // @NOTE base-nova bolds the active row, but `dashboard-01`
                        // never passes `isActive`, so the block never shows it —
                        // the background alone marks the current page.
                        className="data-active:font-normal"
                        tooltip={typeof title === 'object' ? _(title) : title}
                        render={
                          <Link
                            to={to}
                            aria-current={pathname === to ? 'page' : undefined}
                          >
                            {Icon && <Icon aria-hidden />}
                            <span>
                              {typeof title === 'object' ? _(title) : title}
                            </span>
                          </Link>
                        }
                      />
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* @NOTE Mirrors the block's `nav-secondary`: a second group pinned
            with `mt-auto` so the deployment's links sit at the bottom of the
            sidebar, directly above the user nav. */}
            {footerLinks && footerLinks.length > 0 && (
              <SidebarGroup className="mt-auto">
                <SidebarGroupContent>
                  <SidebarMenu className="gap-1">
                    {footerLinks.map((link) => (
                      <SidebarMenuItem key={link.href}>
                        <SidebarMenuButton
                          size="sm"
                          render={
                            <LinkExternal href={link.href} rel={link.rel} />
                          }
                        >
                          <span>
                            <LinkTitle link={link} />
                          </span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </SidebarContent>

          <SidebarFooter>
            <LocaleSelector className="w-full" />
            <AccountMenu />
          </SidebarFooter>
        </Sidebar>

        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
            {/* @NOTE aria-label overrides SidebarTrigger's hardcoded English
            "Toggle Sidebar" sr-only text, without forking ui/sidebar.tsx. */}
            <SidebarTrigger aria-label={_(navigationLabel)} />
            {/* @NOTE self-center overrides the primitive's `self-stretch`. With a
            definite `h-4`, `align-self: stretch` has nothing to stretch and the
            rule instead pins the line to the top of the header. */}
            <Separator
              orientation="vertical"
              className="data-vertical:h-4 data-vertical:self-center mr-2"
            />
            {pageTitleStr && (
              <h2 className="text-base font-medium">{pageTitleStr}</h2>
            )}
          </header>

          {prepend}

          <main
            className="mx-auto flex w-full min-w-0 max-w-4xl flex-col gap-4 p-4 md:p-6"
            role="main"
          >
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </AccountShellLinksContext>
  )
}
