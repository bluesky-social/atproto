import { MessageDescriptor } from '@lingui/core'
import { useLingui } from '@lingui/react'
import { ArrowLeftIcon, IconProps } from '@phosphor-icons/react'
import {
  AnyRoute,
  Link,
  Outlet,
  createRoute,
  useRouter,
  useRouterState,
} from '@tanstack/react-router'
import { clsx } from 'clsx'
import { FunctionComponent, useEffect, useMemo } from 'react'
import { LayoutApp } from '#/components/layouts/layout-app.tsx'
import { AccountSelector } from '#/components/utils/account-selector.tsx'
import { useAuthenticatedSession } from '#/contexts/authentication.tsx'

export type LayoutPage = {
  title: MessageDescriptor
  icon?: FunctionComponent<IconProps>
  hidden?: boolean
  position?: number
  description?: MessageDescriptor
  component: FunctionComponent
}

export type LayoutPages<T extends `/${string}` = `/${string}`> = {
  [K in T]: LayoutPage
}

export type LayoutRouteOptions<
  TRootPath extends `/${string}` = `/${string}`,
  TSubPath extends `/${string}` = `/${string}`,
> = {
  path: TRootPath
  title?: MessageDescriptor
  getParentRoute: () => AnyRoute
  pages: LayoutPages<TSubPath>
}

export function createLayoutRoute<
  const TRootPath extends `/${string}`,
  const TSubPath extends `/${string}`,
>({
  path,
  title,
  getParentRoute,
  pages,
}: LayoutRouteOptions<TRootPath, TSubPath>) {
  const mainRoute = createRoute({
    path,
    component: (props) => (
      <Layout path={path} pages={pages} title={title} {...props} />
    ),
    getParentRoute,
  })

  const childRoutes = (
    Object.entries(pages) as [TSubPath, { component: FunctionComponent }][]
  ).map(([subPath, { component }]) => {
    return createRoute({
      path: subPath,
      component,
      getParentRoute: () => mainRoute,
    })
  })

  return [mainRoute, ...childRoutes] as const
}

export type LayoutProps<T extends `/${string}` = `/${string}`> = {
  path: string
  pages: LayoutPages<T>
  title?: MessageDescriptor
}

function Layout({ path, pages, title }: LayoutProps) {
  const { _ } = useLingui()
  const router = useRouter()
  const { account } = useAuthenticatedSession()
  const { location } = useRouterState()

  const pageEntries = useMemo(() => {
    return Object.entries(pages)
      .filter(
        ([subPath, page]) =>
          !page.hidden || location.pathname === `${path}${subPath}`,
      )
      .sort(([, a], [, b]) => {
        if (a.position != null && b.position != null) {
          return a.position - b.position
        }
        return 0
      })
  }, [pages, location.pathname, path])

  const currentPage = useMemo<LayoutPage | null>(() => {
    const currentSubPath = Object.keys(pages).find(
      (p) => `${path}${p}` === location.pathname,
    )
    if (!currentSubPath) return null
    return pages[currentSubPath]!
  }, [location.pathname, pages, path])

  // Redirect to the main account page when the account changes
  useEffect(() => {
    router.navigate({ to: path })
  }, [account.sub])

  const isHome = location.pathname === path

  return (
    <LayoutApp
      title={title}
      header={<AccountSelector className="shrink-0" size="lg" />}
    >
      <div className="flex w-full flex-1 flex-col md:flex-row">
        <aside
          className={`shrink-0 p-4 md:px-8 ${isHome ? 'w-full md:w-auto' : 'hidden max-w-xs md:block'}`}
          role="navigation"
        >
          <nav className="flex flex-col gap-2">
            {pageEntries.map(([subPath, page]) => (
              <Link
                to={`${path}${subPath}`}
                key={subPath}
                className={clsx(
                  'flex items-center justify-start',
                  'min-h-12 px-4',
                  'rounded-3xl transition-colors',
                  'whitespace-nowrap font-medium md:whitespace-normal',
                  'focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2',
                  'text-text-default',
                  'md:text-text-light md:[&.active]:text-text-default',
                  'hover:bg-slate-100 dark:hover:bg-slate-800',
                  '[&.active]:bg-slate-100 dark:[&.active]:bg-slate-800',
                  isHome && subPath === '/' && 'hidden md:flex',
                )}
                activeOptions={{ exact: true }}
                activeProps={{
                  className: 'active',
                  'aria-current': 'page' as const,
                }}
              >
                {page.icon && (
                  <span
                    aria-hidden="true"
                    className="bg-primary text-primary-contrast -ml-2 mb-auto mr-2 mt-2 inline-flex size-8 shrink-0 grow-0 items-center justify-center rounded-full"
                  >
                    <page.icon className="size-4" />
                  </span>
                )}
                <span className="my-1 min-w-0 flex-1">
                  <span className="block truncate">{_(page.title)}</span>
                  {page.description && (
                    <span className="block whitespace-pre-wrap text-xs md:hidden">
                      {_(page.description)}
                    </span>
                  )}
                </span>
              </Link>
            ))}
          </nav>
        </aside>

        <main
          className={`w-4xl mx-auto min-w-0 max-w-full px-4 md:px-8 ${isHome ? '-order-1 md:order-1 md:block' : ''}`}
          role="main"
        >
          <nav className="mb-4 flex items-center gap-2">
            {!isHome && (
              <Link
                to={path}
                key="back"
                className="text-text-light rounded-full p-2 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 md:hidden dark:hover:bg-slate-800"
              >
                <ArrowLeftIcon className="size-6" />
              </Link>
            )}
            {currentPage?.title && (
              <h2 className="text-text-default text-2xl font-light">
                <title>{_(currentPage.title)}</title>
                <b>{_(currentPage.title)}</b>
              </h2>
            )}
          </nav>

          <Outlet />
        </main>
      </div>
    </LayoutApp>
  )
}
