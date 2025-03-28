import React from 'react'
import { createFileRoute, Outlet } from '@tanstack/react-router'

import { useCustomizationData } from '#/data/useCustomizationData'
import * as Layout from '#/components/Layout'

export const Route = createFileRoute('/_minimalLayout')({
  component: RouteComponent,
})

function RouteComponent() {
  const { logo } = useCustomizationData()

  return (
    <>
      <Layout.Center className="md:pt-[15vh]">
        {logo ? (
          <div className="flex justify-center pb-8">
            <div
              style={{ width: 120 }}
              dangerouslySetInnerHTML={{ __html: logo }}
            />
          </div>
        ) : null}
        <Outlet />
      </Layout.Center>
    </>
  )
}
