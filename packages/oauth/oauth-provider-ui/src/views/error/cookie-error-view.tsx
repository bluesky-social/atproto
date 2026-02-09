import { Trans, useLingui } from '@lingui/react/macro'
import { memo, useMemo } from 'react'
import { Button } from '#/components/forms/button.tsx'
import { FormCard } from '#/components/forms/form-card.tsx'
import { LayoutTitlePage } from '#/components/layouts/layout-title-page.tsx'
import { Admonition } from '#/components/utils/admonition.tsx'
import { LayoutWelcomeProps } from '../../components/layouts/layout-welcome.tsx'
import { Override } from '../../lib/util.ts'

export type CookieErrorViewProps = Override<
  LayoutWelcomeProps,
  {
    continueUrl: string
  }
>

export const CookieErrorView = memo(function CookieErrorView({
  continueUrl,

  // LayoutWelcome
  title,
  children,
  ...props
}: CookieErrorViewProps) {
  const { t } = useLingui()

  const url = useMemo(() => new URL(continueUrl), [continueUrl])

  return (
    <LayoutTitlePage {...props} title={title ?? t`Cookie Error`}>
      <FormCard
        action={url.origin}
        method="GET"
        actions={<Button type="submit" color="primary">{t`Continue`}</Button>}
      >
        {Array.from(url.searchParams).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
        <Admonition>
          <Trans>
            It seems that your browser is not accepting cookies. Press
            "Continue" to try again. If the error persists, please ensure that
            your privacy settings allow cookies for the "{url.hostname}"
            website.
          </Trans>
        </Admonition>
      </FormCard>
    </LayoutTitlePage>
  )
})
