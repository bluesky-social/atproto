import { Trans, useLingui } from '@lingui/react/macro'
import { type ReactNode, useState } from 'react'
import { AccountPermission } from '@atproto/oauth-scopes'
import type { OAuthClientMetadata } from '@atproto/oauth-types'
import { ClientAvatar } from '#/components/identity/client-avatar.tsx'
import { ClientName } from '#/components/identity/client-name.tsx'
import { Button } from '#/components/ui/button.tsx'
import { useAsyncAction } from '#/hooks/use-async-action.ts'
import type { PermissionSets } from '#/hydration-data.d.ts'
import { FormShell } from './forms/form-shell.tsx'
import { DescriptionCard } from './utils/description-card.tsx'
import { ScopeDescription } from './utils/scope-description.tsx'

export type ConsentFormProps = {
  clientId: string
  clientMetadata: OAuthClientMetadata
  clientTrusted: boolean
  clientFirstParty: boolean
  permissionSets: PermissionSets

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

  scope,

  onConsent,
  onReject,
  onBack,
}: ConsentFormProps) {
  const { t } = useLingui()
  const reject = useAsyncAction(onReject)

  // Require the granular scope system to be able to unset the `account:email`
  // scope.
  const canUnsetEmail = !scope?.split(' ').some(isTransitionScope)

  const [allowEmail, setAllowEmail] = useState(true)

  return (
    <FormShell<{ allowEmail: string }>
      onBack={onBack}
      // Clear a previous rejection error as soon as the user changes anything.
      onValues={() => reject.reset()}
      disabled={reject.loading}
      submitLabel={<Trans context="OAuthConsent">Authorize</Trans>}
      onSubmit={() =>
        onConsent({
          scope:
            canUnsetEmail && !allowEmail
              ? stripAccountEmailScope(scope)
              : scope,
        })
      }
      actions={
        <Button
          type="button"
          variant="secondary"
          disabled={reject.loading}
          onClick={(event) => {
            event.preventDefault()
            void reject.run()
          }}
        >
          <Trans context="OAuthConsent">Deny access</Trans>
        </Button>
      }
    >
      <DescriptionCard
        image={
          <ClientAvatar
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
            <Trans>wants to uniquely identify you through your account</Trans>
          ) : (
            <Trans>wants to access your account</Trans>
          )
        }
        hint={t`Technical details`}
      >
        <p>
          <Trans>This application identifies itself as:</Trans>
        </p>
        <pre className="bg-muted mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded border p-2 text-sm">
          {clientId}
        </pre>
        {scope ? (
          <>
            <p className="mt-4">
              <Trans>
                This application is requesting the following permissions
                (scopes) to access your account:
              </Trans>
            </p>
            <pre className="bg-muted mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded border p-2 text-sm">
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
        allowEmail={canUnsetEmail ? allowEmail : true}
        onAllowEmail={
          canUnsetEmail ? (next: boolean) => setAllowEmail(next) : undefined
        }
      />

      {/* @NOTE Kept to one short line: the heading and the button already say
        what authorizing does, so this exists to carry the two links. Each
        link is styled only when the client published a URL for it. */}
      <p className="text-muted-foreground text-sm leading-snug">
        <Trans>
          Subject to the app's{' '}
          <a
            role="link"
            href={clientMetadata.tos_uri}
            rel="nofollow noopener"
            target="_blank"
            className={
              clientMetadata.tos_uri ? 'text-foreground underline' : undefined
            }
          >
            <Trans>terms of service</Trans>
          </a>{' '}
          and{' '}
          <a
            role="link"
            href={clientMetadata.policy_uri}
            rel="nofollow noopener"
            target="_blank"
            className={
              clientMetadata.policy_uri
                ? 'text-foreground underline'
                : undefined
            }
          >
            <Trans>privacy policy</Trans>
          </a>
          .
        </Trans>
      </p>
    </FormShell>
  )
}
