import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Link, type LinkProps, useMatchRoute } from '@tanstack/react-router'
import { ArrowLeftIcon, type LucideIcon } from 'lucide-react'
import { type ReactNode, createContext, useContext } from 'react'
import { AccountMenu } from '#/components/identity/account-menu.tsx'
import { Button } from '#/components/ui/button.tsx'
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

export type AccountShellTarget = Pick<LinkProps, 'to' | 'params'>

export type AccountShellLink = AccountShellTarget & {
  title: string | MessageDescriptor
  description?: string | MessageDescriptor
  Icon?: LucideIcon
}

export type AccountShellProps = {
  title?: string | MessageDescriptor
  /** The account home, and the target of the mobile back button. */
  base: AccountShellTarget
  links: ReadonlyArray<AccountShellLink>
  children?: ReactNode
  prepend?: ReactNode
}

const navigationLabel = msg`Navigation`
const backLabel = msg`Back`

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
 * Tests whether a navigation target is the page currently being shown.
 *
 * @NOTE `to` is a path *template* (`/account/u/$accountId/manage`), so it never
 * equals the resolved pathname — the comparison has to go through the router.
 */
export function useIsCurrentTarget(): (target: AccountShellTarget) => boolean {
  const matchRoute = useMatchRoute()
  return ({ to, params }) => to != null && matchRoute({ to, params }) !== false
}

/**
 * Account-manager frame: `SidebarProvider` + `Sidebar` + `SidebarInset`, with
 * `SidebarTrigger` in the inset header — a composition that brings the
 * collapsible rail, the mobile sheet, the keyboard shortcut and the persisted
 * open/closed state with it.
 *
 * @NOTE This owns the whole page frame, including its own `<title>`. The app
 * title must be the one that takes effect, and React hoists every `<title>`
 * into the head with the last one rendered winning.
 */
export function AccountShell({
  children,
  title,
  base,
  links,
  prepend,
}: AccountShellProps) {
  const { _ } = useLingui()
  const isCurrent = useIsCurrentTarget()
  const { logo, name, links: footerLinks } = useCustomizationData()

  const atBase = isCurrent(base)
  const titleString = typeof title === 'object' ? _(title) : (title ?? name)

  const currentLink = links.find(isCurrent)
  const pageTitle = currentLink?.title
  const pageTitleStr = typeof pageTitle === 'object' ? _(pageTitle) : pageTitle

  return (
    <AccountShellLinksContext value={links}>
      <SidebarProvider>
        {titleString && <title>{titleString}</title>}

        <Sidebar collapsible="offcanvas">
          <SidebarHeader>
            {/* @NOTE A SidebarMenuButton rather than a bare div, so the brand
            row shares the nav items' geometry. `render={<div/>}` keeps it
            non-interactive — there is nowhere to navigate to. */}
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
                {/* @NOTE gap-1 overrides SidebarMenu's gap-0: without it an
                active row and a hovered row next to it merge into one block. */}
                <SidebarMenu className="gap-1">
                  {links.map((link) => (
                    <SidebarMenuItem key={link.to}>
                      <SidebarMenuButton
                        isActive={link === currentLink}
                        // @NOTE The style bolds the active row; the background
                        // alone is enough to mark the current page.
                        className="data-active:font-normal"
                        tooltip={
                          typeof link.title === 'object'
                            ? _(link.title)
                            : link.title
                        }
                        render={
                          // @NOTE `exact` because the account home is the
                          // parent route of every other entry: without it,
                          // Link marks "Home" as the current page throughout.
                          <Link
                            to={link.to}
                            params={link.params}
                            activeOptions={{ exact: true }}
                          >
                            {link.Icon && <link.Icon aria-hidden />}
                            <span>
                              {typeof link.title === 'object'
                                ? _(link.title)
                                : link.title}
                            </span>
                          </Link>
                        }
                      />
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* @NOTE `mt-auto` pins the deployment's links to the bottom of the
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
          <header className="bg-background sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b px-4">
            {/* @NOTE On a sub-page the mobile header drills back to the account
            home instead of opening the sidebar; the trigger stays on desktop,
            where the sidebar is always reachable. */}
            {!atBase && (
              <Button
                variant="ghost"
                size="icon"
                className="-ml-1 md:hidden"
                aria-label={_(backLabel)}
                render={
                  <Link
                    to={base.to}
                    params={base.params}
                    activeOptions={{ exact: true }}
                  />
                }
              >
                <ArrowLeftIcon />
              </Button>
            )}
            {/* @NOTE SidebarTrigger's sr-only text is hardcoded English; the
            aria-label translates it without forking the primitive. */}
            <SidebarTrigger
              aria-label={_(navigationLabel)}
              className={atBase ? undefined : 'max-md:hidden'}
            />
            {/* @NOTE self-center overrides the primitive's `self-stretch`,
            which with a definite `h-4` pins the line to the top instead. */}
            <Separator
              orientation="vertical"
              className="data-vertical:h-4 data-vertical:self-center mr-2"
            />
            {pageTitleStr && (
              <h2 className="text-base font-medium">{pageTitleStr}</h2>
            )}
            {/* @NOTE On desktop the sidebar keeps the brand in view; on mobile
            it is closed, so the header carries it instead. */}
            {(logo || name) && (
              <div className="ml-auto flex min-w-0 items-center gap-2 md:hidden">
                {logo && (
                  <img
                    src={logo}
                    alt={name || _(msg`Logo`)}
                    className="size-5 shrink-0 object-contain"
                  />
                )}
                {name && (
                  <span className="truncate text-sm font-medium">{name}</span>
                )}
              </div>
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
