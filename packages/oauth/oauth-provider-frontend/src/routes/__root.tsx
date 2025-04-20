import { HeadContent, Outlet, createRootRoute } from '@tanstack/react-router'
import { RouterErrorComponent } from '#/components/ErrorScreen'
import { Footer } from '#/components/Footer'
import * as Layout from '#/components/Layout'

export const Route = createRootRoute({
  component: Root,
  errorComponent: RouterErrorComponent,
})

function Root() {
  return (
    <>
      <HeadContent />

      <Layout.Outer>
        <Outlet />
      </Layout.Outer>

      <Footer />

      {/* <TanStackRouterDevtools /> */}
    </>
  )
}
