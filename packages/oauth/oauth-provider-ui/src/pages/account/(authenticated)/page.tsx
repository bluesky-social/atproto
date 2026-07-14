import { Trans } from '@lingui/react/macro'
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import type { JSX } from 'react/jsx-runtime'
import { CustomizationName } from '#/components/customization-name.tsx'
import { AccountOverview } from '#/components/utils/account-overview.tsx'
import { useAuthenticatedSession } from '#/contexts/authentication.tsx'

export function Page(): ReactNode {
  const { account } = useAuthenticatedSession()

  return (
    <div className="flex min-h-full flex-col items-center gap-4">
      <div className="flex flex-1 flex-col items-center justify-center">
        <AccountOverview account={account}>
          <HostedByParagraph className="text-text-light text-center text-sm" />
        </AccountOverview>
      </div>
    </div>
  )
}

function HostedByParagraph(props: JSX.IntrinsicElements['p']): ReactNode {
  return (
    <p {...props}>
      <Trans>
        Your Atmosphere account is hosted by <CustomizationName />.
      </Trans>{' '}
      <Link
        to="/account/about"
        className="text-sm text-blue-600 hover:underline"
      >
        <Trans>What does this mean?</Trans>
      </Link>
    </p>
  )
}
