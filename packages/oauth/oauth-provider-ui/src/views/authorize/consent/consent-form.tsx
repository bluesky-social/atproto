import type { PermissionSets } from '#/hydration-data.d.ts'
import { Trans, useLingui } from '@lingui/react/macro'
import { ReactNode, useState } from 'react'
import { ClientImage } from '#/components/utils/client-image.tsx'
import { DescriptionCard } from '#/components/utils/description-card.tsx'
import { ScopeDescription } from '#/components/utils/scope-description.tsx'
import type { Account } from '@atproto/oauth-provider-api'
import { AccountPermission } from '@atproto/oauth-scopes'
import type { OAuthClientMetadata } from '@atproto/oauth-types'
import { Button } from '../../../components/forms/button.tsx'
import {
  FormCard,
  FormCardProps,
} from '../../../components/forms/form-card.tsx'
import { AccountIdentifier } from '../../../components/utils/account-identifier.tsx'
import { ClientName } from '../../../components/utils/client-name.tsx'
import { Override } from '../../../lib/util.ts'

export type ConsentFormProps = Override<
  Omit<FormCardProps, 'onSubmit' | 'cancel' | 'actions' | 'children'>,
  {
    clientId: string
    clientMetadata: OAuthClientMetadata
    clientTrusted: boolean
    clientFirstParty: boolean
    permissionSets: PermissionSets

    account: Account
    scope?: string

    onConsent: (scope?: string) => void
    consentLabel?: ReactNode

    onReject: () => void
    rejectLabel?: ReactNode

    onBack?: () => void
    backLabel?: ReactNode
  }
>

function isTransitionScope(scope: string): scope is `transition:${string}` {
  return scope.startsWith('transition:')
}

function isAccountEmailScope(scope: string): boolean {
  const parsed = AccountPermission.fromString(scope)
  if (!parsed) return false
  return parsed.matches({ attr: 'email', action: 'read' })
}

function stripAccountEmailScope(scope?: string): string | undefined {
  return scope
    ?.split(' ')
    .filter((s) => !isAccountEmailScope(s))
    .join(' ')
}

export function ConsentForm({
  clientId,
  clientMetadata,
  clientTrusted,
  clientFirstParty,
  permissionSets,

  account,
  scope,

  onConsent,
  consentLabel,

  onReject,
  rejectLabel,

  onBack,
  backLabel,

  // FormCardProps
  ...props
}: ConsentFormProps) {
  const { t } = useLingui()
  const [allowEmail, setAllowEmail] = useState(true)

  // Require the granular scope system to be able to unset the `account:email`
  // scope.
  const canUnsetEmail = !scope?.split(' ').some(isTransitionScope)

  return (
    <FormCard
      {...props}
      onSubmit={(event) => {
        event.preventDefault()
        const acceptedScope =
          canUnsetEmail && !allowEmail ? stripAccountEmailScope(scope) : scope
        onConsent(acceptedScope)
      }}
      cancel={
        onBack && (
          <Button onClick={onBack}>{backLabel || <Trans>Back</Trans>}</Button>
        )
      }
      actions={
        <>
          <Button type="submit" color="primary">
            {consentLabel || <Trans>Authorize</Trans>}
          </Button>

          <Button onClick={onReject}>
            {rejectLabel || <Trans>Deny access</Trans>}
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
        hint={t`Technical details`}
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
        permissionSets={permissionSets}
        clientTrusted={clientTrusted}
        clientFirstParty={clientFirstParty}
        allowEmail={canUnsetEmail ? allowEmail : true}
        onAllowEmail={canUnsetEmail ? setAllowEmail : undefined}
      />

      <p>
        <Trans>
          By clicking <b>{consentLabel || <Trans>Authorize</Trans>}</b>, you
          will grant this application access to your account in accordance with
          its{' '}
          <a
            role="link"
            href={clientMetadata.tos_uri}
            rel="nofollow noopener"
            target="_blank"
            className={
              clientMetadata.tos_uri ? 'text-primary underline' : undefined
            }
          >
            <Trans>terms of service</Trans>
          </a>
          {' and '}
          <a
            role="link"
            href={clientMetadata.policy_uri}
            rel="nofollow noopener"
            target="_blank"
            className={
              clientMetadata.policy_uri ? 'text-primary underline' : undefined
            }
          >
            <Trans>privacy policy</Trans>
          </a>
          .
        </Trans>
      </p>
    </FormCard>
  )
}
