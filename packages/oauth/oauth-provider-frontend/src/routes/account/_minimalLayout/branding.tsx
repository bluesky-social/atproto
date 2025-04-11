import { createFileRoute } from '@tanstack/react-router'
import { Palette } from '#/components/util/Palette'

export const Route = createFileRoute('/account/_minimalLayout/branding')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div>
      <Palette />
    </div>
  )
}
