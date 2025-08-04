import { Trans } from '@lingui/react/macro'
import { DescriptionCard } from '#/components/utils/description-card.tsx'
import { GlobeIcon } from '#/components/utils/icons.tsx'
import { ScopeDescription } from '#/components/utils/scope-description.tsx'
import type { Account } from '@atproto/oauth-provider-api'
import type { OAuthClientMetadata } from '@atproto/oauth-types'
import { Button } from '../../../components/forms/button.tsx'
import {
  FormCard,
  FormCardProps,
} from '../../../components/forms/form-card.tsx'
import { AccountIdentifier } from '../../../components/utils/account-identifier.tsx'
import { ClientName } from '../../../components/utils/client-name.tsx'
import { Override } from '../../../lib/util.ts'

export type AcceptFormProps = Override<
  Omit<FormCardProps, 'onSubmit' | 'cancel' | 'actions' | 'children'>,
  {
    clientId: string
    clientMetadata: OAuthClientMetadata
    clientTrusted: boolean

    account: Account
    scope?: string

    onAccept: () => void
    onReject: () => void
    onBack?: () => void
  }
>

export function AcceptForm({
  clientId,
  clientMetadata,
  clientTrusted,

  account,
  scope,

  onAccept,
  onReject,
  onBack,

  // FormCardProps
  ...props
}: AcceptFormProps) {
  return (
    <FormCard
      {...props}
      onSubmit={(event) => {
        event.preventDefault()
        onAccept()
      }}
      cancel={onBack && <Button onClick={onBack}>Back</Button>}
      actions={
        <>
          <Button type="submit" color="primary">
            <Trans>Authorize</Trans>
          </Button>

          <Button onClick={onReject}>
            <Trans>Deny access</Trans>
          </Button>
        </>
      }
    >
      <DescriptionCard
        image={
          clientTrusted && clientMetadata.logo_uri ? (
            <div key="logo" className="flex items-center justify-center">
              <img
                src={clientMetadata.logo_uri}
                alt={clientMetadata.client_name}
                className="rounded-full"
              />
            </div>
          ) : (
            <GlobeIcon className="h-6" />
          )
        }
        title={
          <ClientName
            clientId={clientId}
            clientMetadata={clientMetadata}
            clientTrusted={clientTrusted}
          />
        }
        description={
          <Trans>
            wants to access your <AccountIdentifier account={account} /> account
          </Trans>
        }
      />

      <ScopeDescription scope={scope} />

      <p>
        <Trans>
          By clicking{' '}
          <b>
            <Trans>Authorize</Trans>
          </b>
          , you will grant this application access to your account in accordance
          with its{' '}
          <a
            role="link"
            href={clientMetadata.tos_uri}
            rel="nofollow noopener"
            target="_blank"
            className="text-primary underline"
          >
            <Trans>terms of service</Trans>
          </a>
          {' and '}
          <a
            role="link"
            href={clientMetadata.policy_uri}
            rel="nofollow noopener"
            target="_blank"
            className="text-primary underline"
          >
            <Trans>privacy policy</Trans>
          </a>
          .
        </Trans>
      </p>
    </FormCard>
  )
}
