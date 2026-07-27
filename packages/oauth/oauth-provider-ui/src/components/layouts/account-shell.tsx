import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import {
  Link,
  type RegisteredRouter,
  type ToPathOption,
  useRouterState,
} from '@tanstack/react-router'
import { MenuIcon } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { AccountMenu } from '#/components/identity/account-menu.tsx'
import { AppShell } from '#/components/layouts/app-shell.tsx'
import { Button } from '#/components/ui/button.tsx'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '#/components/ui/sheet.tsx'
import { cn } from '#/lib/utils.ts'

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

export function AccountShell({
  children,
  title,
  links,
  prepend,
}: AccountShellProps) {
  const { _ } = useLingui()
  const { pathname } = useRouterState().location
  const [navOpen, setNavOpen] = useState(false)

  const currentLink = links.find((link) => link.to === pathname)
  const pageTitle = currentLink?.title
  const pageTitleStr = typeof pageTitle === 'object' ? _(pageTitle) : pageTitle

  const visibleLinks = links.filter(
    ({ hidden, to }) => !hidden || pathname === to,
  )

  const nav = (
    <nav className="flex flex-col gap-1" onClick={() => setNavOpen(false)}>
      {visibleLinks.map(({ to, title, description, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          className={cn(
            'flex items-center justify-start gap-3',
            'min-h-11 rounded-md px-3 py-2',
            'text-sidebar-foreground/80 text-sm font-medium',
            'transition-colors',
            'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2',
            '[&.active]:bg-sidebar-accent [&.active]:text-sidebar-accent-foreground',
          )}
          activeOptions={{ exact: true, includeSearch: false }}
          activeProps={{
            className: 'active',
            'aria-current': 'page' as const,
          }}
        >
          {Icon && (
            <Icon className="size-4 shrink-0 opacity-70" aria-hidden="true" />
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate">
              {typeof title === 'object' ? _(title) : title}
            </span>
            {description && (
              <span className="text-muted-foreground block truncate text-xs">
                {typeof description === 'object' ? _(description) : description}
              </span>
            )}
          </span>
        </Link>
      ))}
    </nav>
  )

  return (
    <AppShell title={title} header={<AccountMenu className="shrink-0" />}>
      {prepend}

      <div className="flex w-full flex-1 flex-col md:flex-row">
        {/* Desktop rail. Hidden below `md`, where the Sheet takes over. */}
        <aside
          className="bg-sidebar hidden w-64 shrink-0 border-r p-4 md:block"
          role="navigation"
        >
          {nav}
        </aside>

        <main
          className="mx-auto flex w-full min-w-0 max-w-4xl flex-col px-4 py-2 md:px-8"
          role="main"
        >
          <div className="mb-4 flex flex-none items-center gap-2">
            {/* @NOTE SheetContent is only mounted while open, so the nav
              links exist exactly once in the DOM on desktop. */}
            <Sheet open={navOpen} onOpenChange={setNavOpen}>
              <SheetTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden"
                    aria-label={_(navigationLabel)}
                  >
                    <MenuIcon className="size-5" />
                  </Button>
                }
              />
              <SheetContent side="left" className="w-72 p-4">
                <SheetHeader className="p-0">
                  <SheetTitle>{_(navigationLabel)}</SheetTitle>
                </SheetHeader>
                {nav}
              </SheetContent>
            </Sheet>

            {/* @NOTE Deliberately does NOT render a <title> element. React
              hoists every <title> into <head> and the last one rendered wins,
              so a page-level title here would override the app title that
              AppShell sets — and `assertTitle` expects the app title on every
              account route. The previous layout only avoided this by skipping
              the heading entirely at the base route. */}
            {pageTitleStr && (
              <h2 className="text-2xl font-light">
                <b>{pageTitleStr}</b>
              </h2>
            )}
          </div>

          <div className="flex-auto">{children}</div>
        </main>
      </div>
    </AppShell>
  )
}
