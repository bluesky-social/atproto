import { useLingui } from '@lingui/react'
import { type FunctionComponent, Suspense, lazy, useMemo } from 'react'

function importLocalizedPageModule(
  locale: string,
): Promise<{ Page: FunctionComponent }> {
  return import(`./page.${locale}.tsx`).catch((_err) => import('./page.en.tsx'))
}

export default function Page() {
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
