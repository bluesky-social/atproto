import { Trans, useLingui } from '@lingui/react/macro'
import { ReactNode, useRef } from 'react'
import type { Account } from '@atproto/oauth-provider-api'
import { AccountPermission } from '@atproto/oauth-scopes'
import type { OAuthClientMetadata } from '@atproto/oauth-types'
import { useAsyncAction } from '#/hooks/use-async-action.ts'
import type { PermissionSets } from '#/hydration-data.d.ts'
import { Button } from './forms/button.tsx'
import { FormHandler, SmartForm } from './forms/smart-form.tsx'
import { AccountIdentifier } from './utils/account-identifier.tsx'
import { ClientImage } from './utils/client-image.tsx'
import { ClientName } from './utils/client-name.tsx'
import { DescriptionCard } from './utils/description-card.tsx'
import { ScopeDescription } from './utils/scope-description.tsx'

export type ConsentFormProps = {
  clientId: string
  clientMetadata: OAuthClientMetadata
  clientTrusted: boolean
  clientFirstParty: boolean
  permissionSets: PermissionSets

  account: Account
  scope?: string

  onConsent: (data: { scope?: string }) => void | PromiseLike<void>
  consentLabel?: ReactNode

  onReject: () => void
  rejectLabel?: ReactNode

  onBack?: () => void
  backLabel?: ReactNode
}

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
  onReject,
  onBack,
}: ConsentFormProps) {
  const { t } = useLingui()
  const reject = useAsyncAction(onReject)

  const formRef =
    useRef<FormHandler<{ scope?: string }, { allowEmail: boolean }>>(null)
  const form = formRef.current

  // Require the granular scope system to be able to unset the `account:email`
  // scope.
  const canUnsetEmail = !scope?.split(' ').some(isTransitionScope)

  return (
    <SmartForm
      ref={formRef}
      onBack={onBack}
      error={reject.error}
      disabled={reject.loading}
      submitLabel={<Trans context="OAuthConsent">Authorize</Trans>}
      values={{ allowEmail: true }}
      onValues={() => reject.reset()}
      validate={({ allowEmail }) => ({
        scope:
          canUnsetEmail && !allowEmail ? stripAccountEmailScope(scope) : scope,
      })}
      handler={onConsent}
      actions={
        <Button
          disabled={form?.loading}
          loading={reject.loading}
          onClick={(event) => {
            event.preventDefault()
            form?.reset()
            void reject.run()
          }}
        >
          <Trans context="OAuthConsent">Deny access</Trans>
        </Button>
      }
      fields={({ values, setterFor }) => (
        <>
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
                  <AccountIdentifier account={account} className="font-bold" />{' '}
                  account
                </Trans>
              ) : (
                <Trans>
                  wants to access your{' '}
                  <AccountIdentifier account={account} className="font-bold" />{' '}
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
                    This application is requesting the following permissions
                    (scopes) to access your account:
                  </Trans>
                </p>
                <pre className="bg-light mt-2 overflow-x-auto whitespace-pre-wrap rounded border p-2 text-sm">
                  {scope}
                </pre>
              </>
            ) : null}
          </DescriptionCard>

          <ScopeDescription
            scope={scope}
            permissionSets={permissionSets}
            clientTrusted={clientTrusted}
            clientFirstParty={clientFirstParty}
            allowEmail={canUnsetEmail ? values.allowEmail : true}
            onAllowEmail={canUnsetEmail ? setterFor('allowEmail') : undefined}
          />

          <p>
            <Trans>
              By clicking{' '}
              <b>
                <Trans context="OAuthConsent">Authorize</Trans>
              </b>
              , you will grant this application access to your account in
              accordance with its{' '}
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
                  clientMetadata.policy_uri
                    ? 'text-primary underline'
                    : undefined
                }
              >
                <Trans>privacy policy</Trans>
              </a>
              .
            </Trans>
          </p>
        </>
      )}
    />
  )
}
