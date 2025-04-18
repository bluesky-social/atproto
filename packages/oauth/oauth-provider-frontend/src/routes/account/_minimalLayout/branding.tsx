import { useLingui } from '@lingui/react/macro'
import { createFileRoute } from '@tanstack/react-router'
import { Palette } from '#/components/util/Palette'

export const Route = createFileRoute('/account/_minimalLayout/branding')({
  component: RouteComponent,
})

function RouteComponent() {
  const { t } = useLingui()

  return (
    <>
      <title>{t`Branding`}</title>
      <Palette />
    </>
  )
}
