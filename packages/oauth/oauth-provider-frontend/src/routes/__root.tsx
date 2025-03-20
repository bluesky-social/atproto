import React from 'react'
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

import { Nav } from '#/components/Nav'

export const Route = createRootRoute({
  component: () => (
    <>
      <Nav />
      <Outlet />
      <TanStackRouterDevtools />
    </>
  ),
})
