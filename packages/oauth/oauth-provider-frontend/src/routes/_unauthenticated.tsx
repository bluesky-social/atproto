import React from 'react'
import { createFileRoute, Outlet } from '@tanstack/react-router'

import { Footer } from '#/components/Footer'
import { useCustomizationData } from '#/data/useCustomizationData'

export const Route = createFileRoute('/_unauthenticated')({
  component: Layout,
})

function Layout() {
  const { logo } = useCustomizationData()

  return (
    <>
      <main className="bg-contrast-0 dark:bg-contrast-25 min-h-screen px-4 md:px-6 pt-16">
        <div
          className="mx-auto w-full"
          style={{ maxWidth: 600, paddingTop: '10vh' }}
        >
          {logo ? (
            <div className="flex justify-center">
              <div
                className="pb-8"
                style={{ width: 120 }}
                dangerouslySetInnerHTML={{ __html: logo }}
              />
            </div>
          ) : null}
          <Outlet />
        </div>
      </main>

      <Footer />
    </>
  )
}
