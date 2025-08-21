import { Trans, useLingui } from '@lingui/react/macro'
import { HTMLAttributes, useMemo } from 'react'
import { Override } from '#/lib/util'
import {
  BlobScope,
  DIDLike,
  NSID,
  PermissionSetTransition,
  RepoScope,
  RpcScope,
} from '@atproto/oauth-scopes'
import { Checkbox } from '../forms/checkbox'
import { Admonition, AdmonitionProps } from './admonition'
import { DescriptionCard } from './description-card'
import {
  AccountOutlinedIcon,
  AtSymbolIcon,
  AuthenticateIcon,
  ButterflyIcon,
  ChatIcon,
  CheckMarkIcon,
  EmailIcon,
  ImageIcon,
  NewspaperIcon,
  PaperPlaneIcon,
  VideoClipIcon,
} from './icons'

export type ScopeDescriptionProps = Override<
  React.HTMLAttributes<HTMLDivElement>,
  {
    clientTrusted?: boolean
    clientFirstParty?: boolean
    scope?: string

    allowEmail?: boolean
    onAllowEmail?: (allowed: boolean) => void
  }
>

export function ScopeDescription({
  scope,
  clientTrusted = false,
  clientFirstParty = false,
  allowEmail,
  onAllowEmail,

  // div
  className = '',
  ...attrs
}: ScopeDescriptionProps) {
  const permissions = useMemo(() => new PermissionSetTransition(scope), [scope])
  const showFineGrainedPermissions =
    !useHasOnlyBlueskySpecificScopes(permissions)

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

      {showFineGrainedPermissions && (
        <>
          <BlobPermissions permissions={permissions} />
          <RepoPermissions permissions={permissions} />
          <RpcMethodsDetails permissions={permissions} />
        </>
      )}

      {(!clientFirstParty || !clientTrusted) && (
        <IdentityWarning className="mt-2" permissions={permissions} />
      )}
    </div>
  )
}

function IdentityWarning({
  permissions,

  // Admonition
  type = 'alert',
  prominent = true,
  ...props
}: {
  permissions: PermissionSetTransition
} & AdmonitionProps) {
  const hasFullIdentityAccess = useMemo(() => {
    return permissions.allowsIdentity({ attr: '*' })
  }, [permissions])

  if (hasFullIdentityAccess) {
    return (
      <Admonition {...props} type={type} prominent={prominent}>
        <Trans>
          The application is asking for full control over your network identity,
          meaning that it could <b>permanently break</b>, or even <b>steal</b>,
          your account. Only grant this permission to applications you really
          trust.
        </Trans>
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
  permissions: PermissionSetTransition
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

// @TODO This could be displayed as a "detail" of the repo scope (if present)
function BlobPermissions({
  permissions,
}: {
  permissions: PermissionSetTransition
}) {
  const { t } = useLingui()

  const hasRepoScope = useMemo(() => {
    return (
      permissions.hasTransitionGeneric ||
      permissions.scopes.some((s) => RepoScope.fromString(s) != null)
    )
  }, [permissions])

  const blobScopes = useMemo(() => {
    if (permissions.hasTransitionGeneric) {
      return [new BlobScope(['*/*'])]
    }
    return Array.from(
      permissions.scopes.map((v) => BlobScope.fromString(v)),
    ).filter((v) => v != null)
  }, [permissions])

  const types = useMemo(() => {
    const allowsAny = blobScopes.some((s) => s.accept.includes('*/*'))
    const types = {
      images: allowsAny,
      videos: allowsAny,
      audio: allowsAny,
      other: allowsAny,
    }
    if (!allowsAny) {
      for (const scope of blobScopes) {
        for (const a of scope.accept) {
          if (a.startsWith('image/')) {
            types.images = true
          } else if (a.startsWith('video/')) {
            types.videos = true
          } else if (a.startsWith('audio/')) {
            types.audio = true
          } else {
            types.other = true
          }
        }
      }
    }
    return types
  }, [blobScopes])

  if (!hasRepoScope) return null
  if (blobScopes.length === 0) return null

  if (types.images && !types.videos && !types.audio && !types.other) {
    // Special case: only images
    return (
      <DescriptionCard
        role="listitem"
        image={<ImageIcon className="size-6" />}
        title={t`Storage`}
        description={t`Upload images`}
      />
    )
  }

  if (!types.images && types.videos && !types.audio && !types.other) {
    // Special case: only videos
    return (
      <DescriptionCard
        role="listitem"
        image={<VideoClipIcon className="size-6" />}
        title={t`Storage`}
        description={t`Upload videos`}
      />
    )
  }

  return (
    <DescriptionCard
      role="listitem"
      image={<PaperPlaneIcon className="size-6" />}
      title={t`Storage`}
      description={t`Upload files`}
    />
  )
}

function AccountPermissions({
  permissions,
}: {
  permissions: PermissionSetTransition
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
 * A hook that returns true if, and only if, there is at least one repo or rpc
 * scope that is used by the Bluesky app, and if every repo and rpc scope are
 * used by the Bluesky app.
 */
function useHasOnlyBlueskySpecificScopes(permissions: PermissionSetTransition) {
  return useMemo(() => {
    if (permissions.allowsAccount({ attr: 'repo', action: 'manage' })) {
      return false
    }

    let foundOne = false

    for (const s of permissions.scopes) {
      const rpc = RpcScope.fromString(s)
      if (rpc) {
        foundOne = true
        if (isOfficialBlueskyAppviewServiceId(rpc.aud)) continue
        if (rpc.lxm.every(isBlueskySpecificNsid)) continue
        return false
      }

      const repo = RepoScope.fromString(s)
      if (repo) {
        foundOne = true
        if (repo.collection.every(isBlueskySpecificNsid)) continue
        return false
      }
    }

    return foundOne
  }, [permissions])
}

function BlueskyAppviewPermissions({
  permissions,
}: {
  permissions: PermissionSetTransition
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
  permissions: PermissionSetTransition
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
  permissions: PermissionSetTransition
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
  permissions: PermissionSetTransition
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

  if (permissions.scopes.some((s) => RpcScope.fromString(s) != null)) {
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
            The application requests the permissions necessary to perform, on
            your behalf, the following actions:
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
    permissions: PermissionSetTransition
    children?: never
  }
>
function RpcMethodsTable({
  permissions,
  className = '',
  ...attrs
}: RpcMethodsTableProps) {
  const { t } = useLingui()

  const audLxmsEntries = useMemo(() => {
    const map = new Map<'*' | DIDLike, Set<'*' | NSID>>()

    for (const s of permissions.scopes) {
      const parsed = RpcScope.fromString(s)
      if (!parsed) continue

      let set = map.get(parsed.aud)
      if (!set) map.set(parsed.aud, (set = new Set()))
      for (const lxm of parsed.lxm) set.add(lxm)
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([aud, lxms]) =>
          [aud, Array.from(lxms).sort((a, b) => a.localeCompare(b))] as const,
      )
  }, [permissions])

  return (
    <table className={`w-full table-auto ${className}`} {...attrs}>
      <thead>
        <tr className="text-sm">
          <th className="text-left font-normal">{t`Service`}</th>
          <th className="text-left font-normal">{t`Methods`}</th>
        </tr>
      </thead>
      <tbody>
        {audLxmsEntries.map(([aud, lxms]) => (
          <tr key={aud} className="text-sm">
            <td className="align-top text-slate-500">
              {aud === '*' ? <em>{t`Any service`}</em> : <code>{aud}</code>}
            </td>
            <td className="text-slate-500">
              {lxms.includes('*') ? (
                <em>{t`Any method`}</em>
              ) : (
                lxms.map((lxm) => (
                  <code className="block" key={lxm}>
                    {lxm}
                  </code>
                ))
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function RepoPermissions({
  permissions,
}: {
  permissions: PermissionSetTransition
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
            The application is asking to be able to create, update, and delete
            <b>any data</b> from your repository.
          </Trans>
        </p>
      </DescriptionCard>
    )
  }

  if (permissions.scopes.some((s) => RepoScope.fromString(s) != null)) {
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
            The application wants to be able to perform the following actions on
            your repository:
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
    permissions: PermissionSetTransition
    children?: never
  }
>
function RepoTable({ permissions, className, ...attrs }: RepoTableProps) {
  const { t } = useLingui()

  const nsidActions = useMemo(() => {
    const map = new Map<
      '*' | NSID,
      {
        create: boolean
        update: boolean
        delete: boolean
      }
    >()

    for (const s of permissions.scopes) {
      const parsed = RepoScope.fromString(s)
      if (!parsed) continue

      for (const nsid of parsed.collection) {
        if (map.has(nsid)) {
          const actions = map.get(nsid)!
          for (const action of parsed.action) actions[action] = true
        } else {
          map.set(nsid, {
            create: parsed.action.includes('create'),
            update: parsed.action.includes('update'),
            delete: parsed.action.includes('delete'),
          })
        }
      }
    }

    return map
  }, [permissions])

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
        {nsidActionsEntries.map(([nsid, actions]) => (
          <tr key={nsid} className="text-sm">
            <td className="text-slate-500">
              {nsid === '*' ? (
                <em>{t`Any collection`}</em>
              ) : (
                <code>{nsid}</code>
              )}
            </td>
            <td className="text-center">
              {starActions?.create || actions.create ? (
                <CheckMarkIcon className="inline-block size-4" />
              ) : null}
            </td>
            <td className="text-center">
              {starActions?.update || actions.update ? (
                <CheckMarkIcon className="inline-block size-4" />
              ) : null}
            </td>
            <td className="text-center">
              {starActions?.delete || actions.delete ? (
                <CheckMarkIcon className="inline-block size-4" />
              ) : null}
            </td>
          </tr>
        ))}
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
  const rpc = RpcScope.fromString(scope)
  if (!rpc) return false
  // Official Bluesky chat is not hosted by the appview service
  if (isOfficialBlueskyAppviewServiceId(rpc.aud)) return false
  return rpc.lxm.includes('*') || rpc.lxm.some(isBskyChatNsid)
}

function isBlueskySpecificNsid(nsid: NSID | '*'): boolean {
  return nsid === '*'
    ? false
    : nsid === 'com.atproto.moderation.createReport' ||
        isBskyAppNsid(nsid) ||
        isBskyChatNsid(nsid)
}

function scopeEnablesBskyAppRepo(scope: string): boolean {
  if (scope === 'transition:generic') return true
  const repo = RepoScope.fromString(scope)
  if (!repo) return false
  return (
    repo.collection.includes('*') || repo.collection.some(isBlueskySpecificNsid)
  )
}

function scopeEnablesPrivateBskyAppMethods(scope: string): boolean {
  if (scope === 'transition:generic') return true
  const rpc = RpcScope.fromString(scope)
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
