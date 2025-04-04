import { Outlet, createFileRoute } from '@tanstack/react-router'
import * as Layout from '#/components/Layout'
import { useCustomizationData } from '#/data/useCustomizationData'

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
