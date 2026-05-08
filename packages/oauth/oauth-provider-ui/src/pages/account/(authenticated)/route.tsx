import { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import {
  DevicesIcon,
  GlobeIcon,
  HouseSimpleIcon,
  IconProps,
  KeyIcon,
  QuestionIcon,
} from '@phosphor-icons/react'
import {
  Outlet,
  RegisteredRouter,
  ToPathOption,
  createRoute,
  useRouter,
} from '@tanstack/react-router'
import { FunctionComponent, ReactNode, useEffect, useMemo, useRef } from 'react'
import {
  LayoutPage,
  LayoutPageLink,
} from '#/components/layouts/layout-page.tsx'
import { AuthenticationProvider } from '#/contexts/authentication.tsx'
import { useSessionContext } from '#/contexts/session.tsx'
import { Explicit } from '#/lib/util.ts'
import { RootRoute } from '../../route.tsx'
import { Page as AccountAboutPage } from './about/page.tsx'
import { Page as AccountOAuthPage } from './apps/page.tsx'
import { Page as AccountDevicesPage } from './devices/page.tsx'
import { Page as AccountIndexPage } from './page.tsx'
import { Page as AccountPasswordPage } from './password/page.tsx'

type SubPage = {
  title: string | MessageDescriptor
  icon?: FunctionComponent<IconProps>
  hidden?: boolean
  position?: number
  description?: string | MessageDescriptor
  component: FunctionComponent
}

type SubPages<T extends `/${string}` = `/${string}`> = {
  [K in T]: SubPage
}

const DEFAULT_PAGES = {
  '/': {
    icon: HouseSimpleIcon,
    position: 0,
    title: msg`Account`,
    component: AccountIndexPage,
  },
  '/devices': {
    icon: DevicesIcon,
    position: 10,
    title: msg`Devices`,
    description: msg`Manage your active sessions`,
    component: AccountDevicesPage,
  },
  '/apps': {
    icon: GlobeIcon,
    position: 20,
    title: msg`Apps`,
    description: msg`Manage applications that have access to your account`,
    component: AccountOAuthPage,
  },
  '/password': {
    icon: KeyIcon,
    position: 30,
    title: msg`Password`,
    description: msg`Change your account password`,
    component: AccountPasswordPage,
  },
  '/about': {
    icon: QuestionIcon,
    position: 50,
    title: msg`About`,
    component: AccountAboutPage,
    description: msg`What is an Atmosphere Account?`,
  },
} satisfies SubPages

export function buildRoutes<T extends `/${string}`>(
  path: T,
  customPages?: SubPages,
) {
  const subPages = { ...DEFAULT_PAGES, ...customPages }

  const route = createRoute({
    path,
    component: (props) => (
      <Page basePath={path} subPages={subPages} {...props} />
    ),
    getParentRoute: () => RootRoute,
  })

  const childRoutes = (
    Object.entries(subPages) as [keyof typeof subPages, SubPage][]
  ).map(([path, { component }]) => {
    return createRoute({ getParentRoute: () => route, path, component })
  })

  return [route, ...childRoutes] as const
}

function Page({
  basePath,
  subPages,
}: {
  basePath: ToPathOption<RegisteredRouter, '/', undefined>
  subPages: SubPages
}) {
  const links = useMemo<readonly LayoutPageLink[]>(() => {
    return Object.entries(subPages)
      .sort(([ap, a], [bp, b]) => {
        if (a.position != null && b.position != null) {
          const diff = a.position - b.position
          if (diff !== 0) return diff
        }
        return ap.localeCompare(bp)
      })
      .map(
        ([subPath, page]): Explicit<LayoutPageLink> => ({
          to: ((basePath as string) === '/'
            ? subPath
            : subPath === '/'
              ? basePath
              : `${basePath}${subPath}`) as any,
          title: page.title,
          description: page.description,
          hidden: page.hidden,
          icon: page.icon,
        }),
      )
  }, [subPages, basePath])

  return (
    <AuthGate signOutTo={basePath}>
      <LayoutPage
        title={msg`My Atmosphere Account`}
        basePath={basePath}
        links={links}
      >
        <Outlet />
      </LayoutPage>
    </AuthGate>
  )
}

const initialUrl = new URL(window.location.href)

function AuthGate({
  children,
  signOutTo,
}: {
  children?: ReactNode
  signOutTo?: ToPathOption<RegisteredRouter, '/', undefined>
}) {
  // This page supports a mode where it is loaded, by an app, in a webview or
  // popup, to let the user manage their atmosphere account without leaving the
  // app. In that case, we constrain the user to only use the account for which
  // they opened the page, and we send a signal to the opener when they perform
  // actions that signal the user is done with the page (like logging out, or
  // explicitly "canceling" the sign-in).

  // @NOTE The VERY EXPERIMENTAL API used here **WILL** change in the future as
  // it gets specified (or not) in the AT Protocol specification. It MUST NOT be
  // used in places where security is a concern and is ONLY there for testing
  // and experimentation purposes. DO NOT USE.

  const router = useRouter()
  const { session } = useSessionContext()
  const hasSession = useRef(session != null)

  const isPopup = initialUrl.searchParams.get('display') === 'popup'
  const identifier = initialUrl.searchParams.get('login_hint') || undefined
  const nonce = initialUrl.searchParams.get('nonce') || undefined
  const callbackUrl = initialUrl.searchParams.get('redirect_uri') || undefined

  const done = useMemo<undefined | (() => void)>(() => {
    if (callbackUrl && nonce) {
      return () => {
        const url = new URL(callbackUrl)
        window.location.href = url.toString()
      }
    } else if (isPopup) {
      return () => {
        // Due to the various ways this page can be embedded (e.g. webview in a
        // mobile app, a popup in a browser), and the fact that the opener might
        // be on a different origin, we post the message on various targets to
        // ensure it is received. We might want to configure this based on
        // query params.

        // @NOTE We might want to restrict the targetOrigin based on the client
        // metadata.
        window.opener?.postMessage({ nonce, event: 'done' }, '*')
        window.postMessage({ nonce, event: 'done' }, '*')
        window.close()
      }
    }
  }, [isPopup, callbackUrl, nonce])

  useEffect(() => {
    if (session && !hasSession.current) {
      hasSession.current = true
    } else if (!session && hasSession.current) {
      hasSession.current = false
      if (signOutTo) router.navigate({ to: signOutTo })
      done?.()
    }
  }, [session, done])

  return (
    <AuthenticationProvider
      forcedIdentifier={identifier}
      disableRemember={isPopup}
      onCancel={done}
    >
      {children}
    </AuthenticationProvider>
  )
}
