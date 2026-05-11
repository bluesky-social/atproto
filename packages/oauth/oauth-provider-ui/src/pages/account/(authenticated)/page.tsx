import { Trans } from '@lingui/react/macro'
import { Link } from '@tanstack/react-router'
import { ReactNode } from 'react'
import { JSX } from 'react/jsx-runtime'
import { CustomizationName } from '#/components/customization-name'
import { AccountOverview } from '#/components/utils/account-overview'
import { useAuthenticatedSession } from '#/contexts/authentication.tsx'

export function Page(): ReactNode {
  const { account } = useAuthenticatedSession()

  return (
    <div className="flex min-h-full flex-col items-center justify-start gap-4 py-4 md:pt-24">
      <AccountOverview account={account} />
      <HostedByParagraph className="text-text-light text-center text-sm" />
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
