import { Trans } from '@lingui/react/macro'
import { ReactNode } from 'react'
import { AccountOverview } from '#/components/utils/account-overview'
import { useAuthenticatedSession } from '#/contexts/authentication.tsx'
import { useCustomizationData } from '#/contexts/customization.tsx'

export function Page(): ReactNode {
  const { account } = useAuthenticatedSession()
  const { name, logo } = useCustomizationData()

  return (
    <div className="flex min-h-full flex-col items-center justify-start gap-4 py-4 md:pt-24">
      <AccountOverview account={account} />
      <p className="mt-4 text-center text-sm text-slate-600 dark:text-slate-400">
        <Trans>
          Your atmosphere account hosted by{' '}
          {logo && (
            <img
              src={logo}
              alt={name}
              className="vertical-middle mr-1 inline-block h-3 select-none object-contain"
            />
          )}
          <b>{name}</b>.
        </Trans>
      </p>
    </div>
  )
}
