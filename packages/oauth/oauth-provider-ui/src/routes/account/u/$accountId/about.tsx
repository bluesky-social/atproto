import { useLingui } from '@lingui/react'
import { createFileRoute } from '@tanstack/react-router'
import { type FunctionComponent, Suspense, lazy, useMemo } from 'react'

export const Route = createFileRoute('/account/u/$accountId/about')({
  component: AboutPage,
})

// @NOTE `-about/` is prefixed with `-`, which keeps its localized copies out
// of the route tree — they are content, not routes.
function importLocalizedPageModule(
  locale: string,
): Promise<{ Page: FunctionComponent }> {
  return import(`./-about/${locale}.tsx`).catch(
    (_err) => import('./-about/en.tsx'),
  )
}

function AboutPage() {
  const { i18n } = useLingui()
  const { locale } = i18n

  const Component = useMemo(() => {
    return lazy(() =>
      importLocalizedPageModule(locale).then((module) => ({
        default: module.Page,
      })),
    )
  }, [locale])

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Component />
    </Suspense>
  )
}
