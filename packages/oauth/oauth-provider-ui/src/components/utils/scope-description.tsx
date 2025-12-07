import type { PermissionSet, PermissionSets } from '#/hydration-data.d.ts'
import { Trans, useLingui } from '@lingui/react/macro'
import { Fragment, HTMLAttributes, ReactNode, useMemo } from 'react'
import { Override } from '#/lib/util'
import {
  AudParam,
  BlobPermission,
  CollectionParam,
  IncludeScope,
  LxmParam,
  RepoPermission,
  RpcPermission,
  ScopePermissionsTransition,
} from '@atproto/oauth-scopes'
import { Checkbox } from '../forms/checkbox'
import { Admonition, AdmonitionProps } from './admonition'
import { DescriptionCard } from './description-card'
import {
  AccountOutlinedIcon,
  AtSymbolIcon,
  AtomIcon,
  AuthenticateIcon,
  ButterflyIcon,
  ChatIcon,
  CheckMarkIcon,
  EmailIcon,
  NewspaperIcon,
  RaisingHandIcon,
} from './icons'
import { LangProp } from './lang-string'

export type ScopeDescriptionProps = Override<
  HTMLAttributes<HTMLDivElement>,
  {
    clientTrusted?: boolean
    clientFirstParty?: boolean
    scope?: string
    permissionSets: PermissionSets

    allowEmail?: boolean
    onAllowEmail?: (allowed: boolean) => void
  }
>

export function ScopeDescription({
  scope,
  permissionSets,
  clientTrusted = false,
  clientFirstParty = false,
  allowEmail,
  onAllowEmail,

  // div
  className = '',
  ...attrs
}: ScopeDescriptionProps) {
  const includeScopes = useMemo(() => {
    return Array.from(
      new Set(
        scope
          ?.split(' ')
          .map((v) => IncludeScope.fromString(v))
          .filter((v) => v != null),
      ),
    )
  }, [scope])
  const permissions = useMemo(() => {
    return new ScopePermissionsTransition(scope)
  }, [scope])

  if (permissions.scopes.size === 0) return null
  if (permissions.scopes.size === 1 && permissions.scopes.has('atproto')) {
    return null
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`} {...attrs} role="list">
      <EmailPermissions
        permissions={permissions}
        allowEmail={allowEmail}
        onAllowEmail={onAllowEmail}
      />
      <IdentityPermissions permissions={permissions} />
      <AccountPermissions permissions={permissions} />

      {/* Bluesky business logic specific scopes */}
      <BlueskyAppviewPermissions permissions={permissions} />
      <BlueskyChatPermissions permissions={permissions} />

      <IncludedPermissions
        includeScopes={includeScopes}
        permissionSets={permissionSets}
      />

      <FineGrainedPermissions permissions={permissions} />

      {(!clientFirstParty || !clientTrusted) && (
        <IdentityWarning className="mt-2" permissions={permissions} />
      )}
    </div>
  )
}

function IncludedPermissions({
  includeScopes,
  permissionSets,
}: {
  includeScopes: IncludeScope[]
  permissionSets: PermissionSets
}) {
  if (!includeScopes.length) return null

  return (
    <>
      {includeScopes.map((includeScope, i) => (
        <IncludeScopePermissions
          key={i}
          includeScope={includeScope}
          permissionSet={permissionSets[includeScope.nsid]}
        />
      ))}
    </>
  )
}

function IncludeScopePermissions({
  includeScope,
  permissionSet,
}: {
  includeScope: IncludeScope
  permissionSet?: PermissionSet
}) {
  const { nsid } = includeScope

  const permissions = useMemo(() => {
    if (!permissionSet) return null
    return new ScopePermissionsTransition(includeScope.toScopes(permissionSet))
  }, [includeScope, permissionSet])

  return (
    <DescriptionCard
      role="listitem"
      image={
        isBskyAppNsid(nsid) ? (
          <ButterflyIcon className="size-6" />
        ) : isBskyChatNsid(nsid) ? (
          <ChatIcon className="size-6" />
        ) : nsid.startsWith('com.atproto.moderation.') ? (
          <RaisingHandIcon className="size-6" />
        ) : (
          <AtomIcon className="size-6" />
        )
      }
      title={
        <LangProp object={permissionSet} property="title" fallback={nsid} />
      }
      description={
        <LangProp
          object={permissionSet}
          property="detail"
          fallback={
            // Do not set the "nsid" as fallback for the "detail" if is was already used when displaying the "title"
            permissionSet?.title ? nsid : null
          }
        />
      }
    >
      <p className="mt-1">
        <Trans>
          The application requests the permissions necessary to perform the
          following actions on your behalf:
        </Trans>
      </p>
      {permissions ? (
        <>
          <RpcMethodsTable className="mt-2" permissions={permissions} />
          <RepoTable className="mt-2" permissions={permissions} />
        </>
      ) : null}
    </DescriptionCard>
  )
}

function IdentityWarning({
  permissions,

  // Admonition
  type = 'alert',
  prominent = true,
  ...props
}: {
  permissions: ScopePermissionsTransition
} & AdmonitionProps) {
  const hasFullIdentityAccess = useMemo(() => {
    return permissions.allowsIdentity({ attr: '*' })
  }, [permissions])

  if (hasFullIdentityAccess) {
    return (
      <Admonition {...props} type={type} prominent={prominent}>
        <p>
          <Trans>
            The application is asking for full control over your network
            identity, meaning that it could <b>permanently break</b>, or even{' '}
            <b>steal</b>, your account. Only grant this permission to
            applications you really trust.
          </Trans>
        </p>
      </Admonition>
    )
  }

  return null
}

function EmailPermissions({
  permissions,
  allowEmail,
  onAllowEmail,
}: {
  permissions: ScopePermissionsTransition
  allowEmail?: boolean
  onAllowEmail?: (allowed: boolean) => void
}) {
  const { t } = useLingui()

  const allowedAction = useMemo(() => {
    return (['manage', 'read'] as const).find((action) =>
      permissions.allowsAccount({ attr: 'email', action }),
    )
  }, [permissions])

  if (allowedAction) {
    return (
      <label className={onAllowEmail ? 'cursor-pointer' : undefined}>
        <DescriptionCard
          role="listitem"
          image={<EmailIcon className="size-6" />}
          title={t`Email`}
          description={
            allowedAction === 'manage' ? (
              <Trans>Read and update your account's email address</Trans>
            ) : (
              <Trans>Read your account's email address</Trans>
            )
          }
          append={
            onAllowEmail && (
              <Checkbox
                className="m-2"
                checked={allowEmail}
                onChange={(e) => onAllowEmail(e.target.checked)}
              />
            )
          }
        />
      </label>
    )
  }

  return null
}

function AccountPermissions({
  permissions,
}: {
  permissions: ScopePermissionsTransition
}) {
  const { t } = useLingui()

  // @NOTE "account:email" already covered by EmailPermissions
  // @NOTE "account:repo?action=manage" already covered by RepoPermissions

  if (permissions.allowsAccount({ attr: 'status', action: 'manage' })) {
    return (
      <DescriptionCard
        role="listitem"
        image={<AccountOutlinedIcon className="size-6" />}
        title={t`Account`}
        description={t`Temporarily activate or deactivate your account`}
      />
    )
  }

  return null
}

/**
 * Will display detailed rep and rpc permissions unless the app only has
 * app.bsky or chat.bsky specific permissions, in which case the
 * <BlueskyAppviewPermissions /> and <BlueskyChatPermissions /> components cover
 * them.
 */
function FineGrainedPermissions({
  permissions,
}: {
  permissions: ScopePermissionsTransition
}) {
  const hasOnlyBskyAppSpecificPermissions = useMemo(() => {
    if (permissions.allowsAccount({ attr: 'repo', action: 'manage' })) {
      return false
    }

    let foundOne = false

    for (const s of permissions.scopes) {
      const rpc = RpcPermission.fromString(s)
      if (rpc) {
        foundOne = true
        if (isOfficialBlueskyAppviewServiceId(rpc.aud)) continue
        if (rpc.lxm.every(isBlueskySpecificNsid)) continue
        return false
      }

      const repo = RepoPermission.fromString(s)
      if (repo) {
        foundOne = true
        if (repo.collection.every(isBlueskySpecificNsid)) continue
        return false
      }
    }

    return foundOne
  }, [permissions])

  if (hasOnlyBskyAppSpecificPermissions) return null

  return (
    <>
      <RepoPermissions permissions={permissions} />
      <RpcMethodsDetails permissions={permissions} />
    </>
  )
}

function BlueskyAppviewPermissions({
  permissions,
}: {
  permissions: ScopePermissionsTransition
}) {
  const hasBskyAppRepo = useMemo(() => {
    return permissions.scopes.some(scopeEnablesBskyAppRepo)
  }, [permissions])

  const hasBskyAppRpc = useMemo(() => {
    return permissions.scopes.some(scopeEnablesPrivateBskyAppMethods)
  }, [permissions])

  if (hasBskyAppRepo || hasBskyAppRpc) {
    return (
      <DescriptionCard
        role="listitem"
        image={<ButterflyIcon className="size-6" />}
        title={'Bluesky'}
        description={
          hasBskyAppRepo && hasBskyAppRpc ? (
            <Trans>
              Manage your profile, posts, likes and follows as well as read your
              private preferences
            </Trans>
          ) : (
            <Trans>Manage your profile, posts, likes and follows</Trans>
          )
        }
      />
    )
  }

  return null
}

function BlueskyChatPermissions({
  permissions,
}: {
  permissions: ScopePermissionsTransition
}) {
  const { t } = useLingui()

  const enablesChat = useMemo(() => {
    return (
      permissions.hasTransitionChatBsky ||
      permissions.scopes.some(scopeEnablesChat)
    )
  }, [permissions])

  if (enablesChat) {
    return (
      <DescriptionCard
        role="listitem"
        image={<ChatIcon className="size-6" />}
        title={t`Chat`}
        description={t`Read and send messages`}
      />
    )
  }

  return null
}

function IdentityPermissions({
  permissions,
}: {
  permissions: ScopePermissionsTransition
}) {
  const { t } = useLingui()

  const attr = useMemo(() => {
    if (permissions.allowsIdentity({ attr: '*' })) {
      return '*' as const
    }

    if (permissions.allowsIdentity({ attr: 'handle' })) {
      return 'handle' as const
    }

    return null
  }, [permissions])

  if (attr) {
    return (
      <DescriptionCard
        role="listitem"
        image={<AtSymbolIcon className="h-6" />}
        title={t`Identity`}
        description={
          attr === '*' ? (
            <Trans>
              Manage your <b>full identity</b> including your <b>@handle</b>
            </Trans>
          ) : (
            <Trans>
              Change your <b>@handle</b>
            </Trans>
          )
        }
      />
    )
  }

  return null
}

function RpcMethodsDetails({
  permissions,
}: {
  permissions: ScopePermissionsTransition
}) {
  const { t } = useLingui()

  if (permissions.hasTransitionGeneric) {
    return (
      <DescriptionCard
        role="listitem"
        image={<AuthenticateIcon className="size-6" />}
        title={t`Authenticate`}
        description={
          <Trans>
            Perform authenticated actions towards <b>any service</b> on your
            behalf
          </Trans>
        }
      >
        <p>
          <RpcDescription />
        </p>
      </DescriptionCard>
    )
  }

  if (permissions.scopes.some((s) => RpcPermission.fromString(s) != null)) {
    return (
      <DescriptionCard
        role="listitem"
        image={<AuthenticateIcon className="size-6" />}
        title={t`Authenticate`}
        description={t`Perform actions on your behalf`}
      >
        <p>
          <RpcDescription />
        </p>
        <p className="mt-1">
          <Trans>
            The application requests the permissions necessary to perform the
            following actions on your behalf:
          </Trans>
        </p>
        <RpcMethodsTable className="mt-2" permissions={permissions} />
      </DescriptionCard>
    )
  }

  return null
}

function RpcDescription() {
  return (
    <Trans>
      The ATProto network uses an authentication mechanism that allows to
      uniquely identify users when communicating with external services. This is
      typically used to retrieve or update data linked to your account, such as
      feed or moderation content.
    </Trans>
  )
}

type RpcMethodsTableProps = Override<
  HTMLAttributes<HTMLTableElement>,
  {
    permissions: ScopePermissionsTransition
    children?: never
  }
>
function RpcMethodsTable({
  permissions,
  className = '',
  ...attrs
}: RpcMethodsTableProps) {
  const audLxmsEntries = useMemo(() => {
    const map = new Map<AudParam, Set<LxmParam>>()

    for (const s of permissions.scopes) {
      const parsed = RpcPermission.fromString(s)
      if (!parsed) continue

      let set = map.get(parsed.aud)
      if (!set) map.set(parsed.aud, (set = new Set()))
      for (const lxm of parsed.lxm) set.add(lxm)
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([aud, lxms]) =>
          [
            aud,
            lxms.has('*')
              ? (['*'] as const)
              : Array.from(lxms).sort((a, b) => a.localeCompare(b)),
          ] as const,
      )
  }, [permissions])

  if (!audLxmsEntries.length) return null

  return (
    <table className={`w-full table-auto ${className}`} {...attrs}>
      <thead>
        <tr className="text-sm">
          <th className="text-left font-normal">
            <Trans context="RPC lxm">Call</Trans>
          </th>
          <th className="text-left font-normal">
            <Trans context="RPC aud">Towards</Trans>
          </th>
        </tr>
      </thead>
      <tbody>
        {audLxmsEntries.map(([aud, lxms]) =>
          lxms.map((lxm, i, array) => (
            <tr key={lxm} className="text-xs">
              <td className={i > 0 ? 'pt-1' : undefined}>
                <Lxm lxm={lxm} />
              </td>
              {i === 0 && (
                <td className="align-top" rowSpan={array.length}>
                  <Aud aud={aud} />
                </td>
              )}
            </tr>
          )),
        )}
      </tbody>
    </table>
  )
}

function RepoPermissions({
  permissions,
}: {
  permissions: ScopePermissionsTransition
}) {
  const { t } = useLingui()

  if (
    permissions.hasTransitionGeneric ||
    permissions.allowsAccount({ attr: 'repo', action: 'manage' }) ||
    (permissions.allowsRepo({ collection: '*', action: 'create' }) &&
      permissions.allowsRepo({ collection: '*', action: 'delete' }) &&
      permissions.allowsRepo({ collection: '*', action: 'update' }))
  ) {
    return (
      <DescriptionCard
        role="listitem"
        image={<NewspaperIcon className="size-6" />}
        title={t`Repository`}
        description={t`Create, update, and delete any public record`}
      >
        <p>
          <RepoDescription />
        </p>
        <p className="mt-1">
          <Trans>
            The application is asking to be able to create, update, and delete{' '}
            <b>any data</b> from your repository.
          </Trans>
        </p>
      </DescriptionCard>
    )
  }

  if (permissions.scopes.some((s) => RepoPermission.fromString(s) != null)) {
    return (
      <DescriptionCard
        role="listitem"
        image={<NewspaperIcon className="size-6" />}
        title={t`Repository`}
        description={t`Publish changes`}
      >
        <p>
          <RepoDescription />
        </p>
        <p className="mt-1">
          <Trans>
            The application requests the permissions necessary to perform the
            following actions on your behalf:
          </Trans>
        </p>
        <RepoTable className="mt-2" permissions={permissions} />
      </DescriptionCard>
    )
  }

  return null
}

function RepoDescription() {
  return (
    <Trans>
      Your repository contains all the data publicly available on the ATProto
      network, such as Bluesky posts, likes, and follows. It also contains data
      created through other apps you've signed into using this account.
    </Trans>
  )
}

type RepoTableProps = Override<
  HTMLAttributes<HTMLTableElement>,
  {
    permissions: ScopePermissionsTransition
    children?: never
  }
>
function RepoTable({ permissions, className, ...attrs }: RepoTableProps) {
  const { t } = useLingui()

  const nsidActions = useMemo(() => {
    const map = new Map<
      CollectionParam,
      {
        create: boolean
        update: boolean
        delete: boolean
      }
    >()

    for (const s of permissions.scopes) {
      const parsed = RepoPermission.fromString(s)
      if (!parsed) continue

      for (const coll of parsed.collection) {
        if (map.has(coll)) {
          const actions = map.get(coll)!
          for (const action of parsed.action) actions[action] = true
        } else {
          map.set(coll, {
            create: parsed.action.includes('create'),
            update: parsed.action.includes('update'),
            delete: parsed.action.includes('delete'),
          })
        }
      }
    }

    return map
  }, [permissions])

  const blobScopes = useMemo(() => {
    if (permissions.hasTransitionGeneric) {
      return [new BlobPermission(['*/*'])]
    }
    return Array.from(
      permissions.scopes.map((v) => BlobPermission.fromString(v)),
    ).filter((v) => v != null)
  }, [permissions])

  if (!nsidActions.size) return null

  const starActions = nsidActions.get('*')

  const nsidActionsEntries = useMemo(() => {
    return Array.from(nsidActions.entries()).sort(([a], [b]) =>
      a.localeCompare(b),
    )
  }, [nsidActions])

  return (
    <table className={`w-full table-auto text-left ${className}`} {...attrs}>
      <thead>
        <tr className="text-sm">
          <th className="font-normal">{t`Collection`}</th>
          <th className="text-center font-normal">{t`Create`}</th>
          <th className="text-center font-normal">{t`Update`}</th>
          <th className="text-center font-normal">{t`Delete`}</th>
        </tr>
      </thead>
      <tbody>
        {nsidActionsEntries.map(([coll, actions], i) => (
          <tr key={coll} className="text-xs">
            <td className={i > 0 ? 'pt-1' : undefined}>
              <Collection coll={coll} />
            </td>
            <td className="text-center">
              {starActions?.create || actions.create ? (
                <CheckMarkIcon className="inline-block size-3" />
              ) : null}
            </td>
            <td className="text-center">
              {starActions?.update || actions.update ? (
                <CheckMarkIcon className="inline-block size-3" />
              ) : null}
            </td>
            <td className="text-center">
              {starActions?.delete || actions.delete ? (
                <CheckMarkIcon className="inline-block size-3" />
              ) : null}
            </td>
          </tr>
        ))}
        {blobScopes.length > 0 && (
          <tr>
            <td className="pt-2">
              <Trans>Blob storage</Trans>
            </td>
            <td colSpan={3} className="pt-2 text-center">
              <Trans>Upload files</Trans>
            </td>
          </tr>
        )}
      </tbody>
    </table>
  )
}

// UTILS

function isOfficialBlueskyAppviewServiceId(aud: string): boolean {
  return aud === 'did:web:bsky.app#bsky_appview'
}

function isBskyAppNsid(nsid: string): nsid is `app.bsky.${string}` {
  return nsid.startsWith('app.bsky.')
}
function isBskyChatNsid(nsid: string): nsid is `chat.bsky.${string}` {
  return nsid.startsWith('chat.bsky.')
}

function scopeEnablesChat(scope: string): boolean {
  if (scope === 'transition:chat.bsky') return true
  const rpc = RpcPermission.fromString(scope)
  if (!rpc) return false
  // Official Bluesky chat is not hosted by the appview service
  if (isOfficialBlueskyAppviewServiceId(rpc.aud)) return false
  return rpc.lxm.includes('*') || rpc.lxm.some(isBskyChatNsid)
}

function isBlueskySpecificNsid(nsid: CollectionParam | LxmParam): boolean {
  return nsid === '*'
    ? false
    : nsid === 'com.atproto.moderation.createReport' ||
        isBskyAppNsid(nsid) ||
        isBskyChatNsid(nsid)
}

function scopeEnablesBskyAppRepo(scope: string): boolean {
  if (scope === 'transition:generic') return true
  const repo = RepoPermission.fromString(scope)
  if (!repo) return false
  return (
    repo.collection.includes('*') || repo.collection.some(isBlueskySpecificNsid)
  )
}

function scopeEnablesPrivateBskyAppMethods(scope: string): boolean {
  if (scope === 'transition:generic') return true
  const rpc = RpcPermission.fromString(scope)
  if (!rpc) return false
  return (
    rpc.lxm.includes('app.bsky.actor.getPreferences') ||
    rpc.lxm.includes('app.bsky.graph.block') ||
    rpc.lxm.includes('app.bsky.graph.muteActor') ||
    rpc.lxm.includes('app.bsky.graph.muteActorList') ||
    rpc.lxm.includes('app.bsky.graph.muteThread') ||
    rpc.lxm.includes('app.bsky.graph.unmuteActor') ||
    rpc.lxm.includes('app.bsky.graph.unmuteActorList') ||
    rpc.lxm.includes('app.bsky.graph.unmuteThread') ||
    rpc.lxm.includes('app.bsky.graph.getMutes') ||
    rpc.lxm.includes('*')
  )
}

type LxmProps = Override<
  Omit<HTMLAttributes<HTMLDivElement>, 'children'>,
  { lxm: LxmParam }
>
function Lxm({ lxm, ...attrs }: LxmProps) {
  return lxm === '*' ? (
    <ItemDescription {...attrs}>
      <Trans>Any method</Trans>
    </ItemDescription>
  ) : (
    <Nsid {...attrs} nsid={lxm} />
  )
}

type AudProps = Override<
  Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'title'>,
  { aud: AudParam }
>
function Aud({ aud, ...attrs }: AudProps) {
  if (aud.startsWith('did:web:api.bsky.app#')) {
    return (
      <ItemDescription {...attrs} title={aud}>
        <Trans>Bluesky App services</Trans>
      </ItemDescription>
    )
  }
  if (aud.startsWith('did:web:api.bsky.chat#')) {
    return (
      <ItemDescription {...attrs} title={aud}>
        <Trans>Bluesky Chat services</Trans>
      </ItemDescription>
    )
  }
  if (aud.startsWith('did:web:') && aud.includes('#')) {
    const domain = aud.slice(8, aud.indexOf('#'))
    return (
      <ItemDescription {...attrs} title={aud}>
        <Trans>
          A service controlled by <b>{domain}</b>
        </Trans>
      </ItemDescription>
    )
  }
  if (aud === '*') {
    return (
      <ItemDescription {...attrs}>
        <Trans>Any service</Trans>
      </ItemDescription>
    )
  }

  return (
    <Identifier {...attrs} title={aud}>
      {aud}
    </Identifier>
  )
}

type CollectionProps = Override<
  HTMLAttributes<HTMLDivElement>,
  { coll: CollectionParam; children?: never }
>
function Collection({ coll, ...attrs }: CollectionProps) {
  return coll === '*' ? (
    <ItemDescription {...attrs}>
      <Trans>Any collection</Trans>
    </ItemDescription>
  ) : (
    <Nsid {...attrs} nsid={coll} />
  )
}

type ItemDescriptionProps = HTMLAttributes<HTMLDivElement>
function ItemDescription({
  children,
  className = '',
  ...attrs
}: ItemDescriptionProps) {
  return (
    <em {...attrs} className={`text-slate-500 ${className}`}>
      {children}
    </em>
  )
}

type NsidProps = Override<IdentifierProps, { nsid: string; children?: never }>
function Nsid({ nsid, ...attrs }: NsidProps) {
  return (
    <Identifier {...attrs}>
      {nsid.split('.').map((part, i) =>
        i === 0 ? (
          part
        ) : (
          // line break **after** the dot
          <Fragment key={i}>
            {'.'}
            <wbr />
            {part}
          </Fragment>
        ),
      )}
    </Identifier>
  )
}

type IdentifierProps = HTMLAttributes<HTMLDivElement>
function Identifier({
  children,
  className = '',
  ...attrs
}: IdentifierProps): ReactNode {
  return (
    <code {...attrs} className={`text-slate-500 ${className}`}>
      {children}
    </code>
  )
}
