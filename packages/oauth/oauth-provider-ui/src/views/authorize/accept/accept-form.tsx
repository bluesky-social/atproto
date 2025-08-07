import { Trans, useLingui } from '@lingui/react/macro'
import { ClientImage } from '#/components/utils/client-image.tsx'
import { DescriptionCard } from '#/components/utils/description-card.tsx'
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
    clientFirstParty: boolean

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
  clientFirstParty,

  account,
  scope,

  onAccept,
  onReject,
  onBack,

  // FormCardProps
  ...props
}: AcceptFormProps) {
  const { t } = useLingui()
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
          <ClientImage
            clientId={clientId}
            clientMetadata={clientMetadata}
            clientTrusted={clientTrusted}
          />
        }
        title={
          <ClientName
            clientId={clientId}
            clientMetadata={clientMetadata}
            clientTrusted={clientTrusted}
          />
        }
        description={
          !scope || scope === 'atproto' ? (
            <Trans>
              wants to uniquely identify you through your{' '}
              <AccountIdentifier account={account} /> account
            </Trans>
          ) : (
            <Trans>
              wants to access your <AccountIdentifier account={account} />{' '}
              account
            </Trans>
          )
        }
        hint={t`Detailed list of permissions`}
      >
        {scope ? (
          <>
            <p>
              <Trans>
                This application is requesting the following list of technical
                permissions, summarized hereafter:
              </Trans>
            </p>
            <ul className="mt-2">
              {scope.split(' ').map((scope) => (
                <li key={scope}>
                  <code>{scope}</code>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </DescriptionCard>

      <ScopeDescription
        scope={scope}
        clientTrusted={clientTrusted}
        clientFirstParty={clientFirstParty}
      />

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
