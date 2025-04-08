import { useLingui } from '@lingui/react/macro'
import { Outlet, createFileRoute } from '@tanstack/react-router'
import * as Layout from '#/components/Layout'
import { useCustomizationData } from '#/data/useCustomizationData'

export const Route = createFileRoute('/account/_minimalLayout')({
  component: RouteComponent,
})

function RouteComponent() {
  const { t } = useLingui()
  const { logo, name } = useCustomizationData()

  return (
    <Layout.Center className="md:pt-[15vh]">
      {logo ? (
        <div className="flex justify-center pb-8" aria-hidden>
          <img src={logo} alt={name || t`Logo`} style={{ width: 120 }} />
        </div>
      ) : null}
      <Outlet />
    </Layout.Center>
  )
}
