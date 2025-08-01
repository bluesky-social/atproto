import { Trans, useLingui } from '@lingui/react/macro'
import { ScopeDescription } from '#/components/utils/scope-description.tsx'
import type { Account } from '@atproto/oauth-provider-api'
import {
  DIDLike,
  NSID,
  NeArray,
  RepoAction,
  RepoScope,
  RpcScope,
  isScopeForResource,
} from '@atproto/oauth-scopes'
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
      {clientTrusted && clientMetadata.logo_uri && (
        <div key="logo" className="flex items-center justify-center">
          <img
            src={clientMetadata.logo_uri}
            alt={clientMetadata.client_name}
            className="h-16 w-16 rounded-full"
          />
        </div>
      )}
      <p>
        <Trans>
          <ClientName
            clientId={clientId}
            clientMetadata={clientMetadata}
            clientTrusted={clientTrusted}
          />{' '}
          is asking for permission to access your account (
          <AccountIdentifier account={account} />
          ).
        </Trans>
      </p>

      <p>
        <Trans>
          By clicking{' '}
          <b>
            <Trans>Authorize</Trans>
          </b>
          , you allow this application to perform the following actions in
          accordance with their{' '}
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
          :
        </Trans>
      </p>

      <ul
        className="list-inside list-disc"
        key="scopes"
        aria-label={t`Requested permissions`}
      >
        {aggregateScopes(scope).map((scope) => (
          <li key={scope}>
            <ScopeDescription scope={scope} />
          </li>
        ))}
      </ul>
    </FormCard>
  )
}

function aggregateScopes(scope?: string): string[] {
  if (!scope) return []

  const scopes = new Set(scope?.split(' '))
  const result: string[] = []

  const repoScopes = new Map<'*' | NSID, Set<RepoAction>>()
  const rpcScopes = new Map<'*' | DIDLike, Set<'*' | NSID>>()

  for (const s of scopes) {
    if (isScopeForResource(s, 'repo')) {
      const parsed = RepoScope.fromString(s)
      if (parsed) {
        for (const nsid of parsed.collection) {
          let set = repoScopes.get(nsid)
          if (!set) repoScopes.set(nsid, (set = new Set()))
          for (const action of parsed.action) set.add(action)
        }
        continue
      }
    }

    if (isScopeForResource(s, 'rpc')) {
      const parsed = RpcScope.fromString(s)
      if (parsed) {
        let set = rpcScopes.get(parsed.aud)
        if (!set) rpcScopes.set(parsed.aud, (set = new Set()))
        for (const lxm of parsed.lxm) set.add(lxm)
        continue
      }
    }

    result.push(s)
  }

  // Create a single "repo:" scope for each unique collection
  for (const [collection, actions] of repoScopes.entries()) {
    result.push(
      new RepoScope([collection], [
        ...actions,
      ] as NeArray<RepoAction>).toString(),
    )
  }

  // Create a single "rpc:" scope for each unique "aud"
  for (const [aud, lxms] of rpcScopes.entries()) {
    result.push(
      new RpcScope(
        aud,
        lxms.has('*') ? ['*'] : ([...lxms] as NeArray<NSID>),
      ).toString(),
    )
  }

  return result
}
