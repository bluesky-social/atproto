import { Trans, useLingui } from '@lingui/react/macro'
import { useMemo } from 'react'
import { Override } from '#/lib/util'
import {
  BlobScope,
  DIDLike,
  NSID,
  PermissionSetTransition,
  RepoScope,
  RpcScope,
} from '@atproto/oauth-scopes'
import { Admonition } from './admonition'
import { DescriptionCard } from './description-card'
import {
  AccountOutlinedIcon,
  AtSymbolIcon,
  AuthenticateIcon,
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
    scope?: string
  }
>

export function ScopeDescription({
  scope,

  // div
  className = '',
  ...attrs
}: ScopeDescriptionProps) {
  const permissions = useMemo(() => new PermissionSetTransition(scope), [scope])

  if (permissions.scopes.size === 0) return null
  if (permissions.scopes.size === 1 && permissions.scopes.has('atproto')) {
    return null
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`} {...attrs} role="list">
      <EmailPermissions permissions={permissions} />
      <IdentityPermissions permissions={permissions} />
      <AccountPermissions permissions={permissions} />
      <ChatPermissions permissions={permissions} />
      <BlobPermissions permissions={permissions} />
      <RepoPermissions permissions={permissions} />
      <RpcMethodsDetails permissions={permissions} />

      <IdentityWarning permissions={permissions} />
    </div>
  )
}

export function IdentityWarning({
  permissions,
}: {
  permissions: PermissionSetTransition
}) {
  const hasFullIdentityAccess = useMemo(() => {
    return (
      permissions.allowsIdentity({ attr: '*', action: 'manage' }) ||
      permissions.allowsIdentity({ attr: '*', action: 'submit' })
    )
  }, [permissions])

  if (hasFullIdentityAccess) {
    return (
      <Admonition type="alert" prominent title={<Trans>Warning</Trans>}>
        <Trans>
          The application will gain full access over your identity on the
          network, meaning that it could <b>permanently break</b>, or even{' '}
          <b>steal</b>, your account. Only grant this permission to applications
          you trust.
        </Trans>
      </Admonition>
    )
  }

  return null
}

function EmailPermissions({
  permissions,
}: {
  permissions: PermissionSetTransition
}) {
  const { t } = useLingui()

  const allowedAction = useMemo(() => {
    return (['manage', 'read'] as const).find((action) =>
      permissions.allowsAccount({ attr: 'email', action }),
    )
  }, [permissions])

  if (allowedAction === 'manage') {
    return (
      <DescriptionCard
        role="listitem"
        image={<EmailIcon className="size-6" />}
        title={t`Email`}
        description={t`Read and update your account's email address`}
      />
    )
  }

  if (allowedAction === 'read') {
    return (
      <DescriptionCard
        role="listitem"
        image={<EmailIcon className="size-6" />}
        title={t`Email`}
        description={t`Read your account's email address`}
      />
    )
  }

  return null
}

function BlobPermissions({
  permissions,
}: {
  permissions: PermissionSetTransition
}) {
  const { t } = useLingui()

  const blobScopes = useMemo(() => {
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

  if (permissions.allowsAccount({ attr: 'status', action: 'manage' })) {
    return (
      <DescriptionCard
        role="listitem"
        image={<AccountOutlinedIcon className="size-6" />}
        title={t`Account`}
        description={t`Manage your account status`}
      />
    )
  }

  return null
}

const isChatNsid = (nsid: NSID | '*'): nsid is '*' | `chat.bsky.${string}` =>
  nsid === '*' || nsid.startsWith('chat.bsky.')
const isChatRpcScope = (s: string): boolean =>
  RpcScope.fromString(s)?.lxm.some(isChatNsid) || false

function ChatPermissions({
  permissions,
}: {
  permissions: PermissionSetTransition
}) {
  const { t } = useLingui()

  const canChat = useMemo(() => {
    return (
      permissions.hasTransitionChatBsky ||
      permissions.scopes.some(isChatRpcScope)
    )
  }, [permissions])

  if (canChat) {
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

  if (
    permissions.allowsIdentity({ attr: '*', action: 'manage' }) ||
    permissions.allowsIdentity({ attr: '*', action: 'submit' })
  ) {
    return (
      <DescriptionCard
        role="listitem"
        image={<AtSymbolIcon className="h-6" />}
        title={t`Identity`}
        description={t`Manage your full identity (including your @handle)`}
      />
    )
  }

  if (permissions.allowsIdentity({ attr: 'handle', action: 'manage' })) {
    return (
      <DescriptionCard
        role="listitem"
        image={<AtSymbolIcon className="size-6" />}
        title={t`Handle`}
        description={t`Update your network @handle`}
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
        description={t`Perform authenticated actions towards any service on your behalf`}
      />
    )
  }

  if (permissions.scopes.some((s) => RpcScope.fromString(s) != null)) {
    return (
      <DescriptionCard
        role="listitem"
        image={<AuthenticateIcon className="size-6" />}
        title={t`Authenticate`}
        description={t`Perform authenticated actions on your behalf`}
      >
        <RpcMethodsTable permissions={permissions} />
      </DescriptionCard>
    )
  }

  return null
}

function RpcMethodsTable({
  permissions,
}: {
  permissions: PermissionSetTransition
}) {
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
    <table className="w-full table-auto">
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
              {aud === '*' ? <em>{t`Any audience`}</em> : <code>{aud}</code>}
            </td>
            <td className="text-slate-500">
              {lxms.includes('*') ? (
                <em>{t`No restrictions`}</em>
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

  if (permissions.allowsAccount({ attr: 'repo', action: 'manage' })) {
    return (
      <DescriptionCard
        role="listitem"
        image={<NewspaperIcon className="size-6" />}
        title={t`Repository`}
        description={t`Replace your entire public data repository with new data`}
      />
    )
  }

  if (
    permissions.hasTransitionGeneric ||
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
      />
    )
  }

  if (permissions.scopes.some((s) => RepoScope.fromString(s) != null)) {
    return (
      <DescriptionCard
        role="listitem"
        image={<NewspaperIcon className="size-6" />}
        title={t`Repository`}
        description={t`Update public data`}
      >
        <RepoTable permissions={permissions} />
      </DescriptionCard>
    )
  }

  return null
}

function RepoTable({ permissions }: { permissions: PermissionSetTransition }) {
  const { t } = useLingui()

  const nsidActionsEntries = useMemo(() => {
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

    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [permissions])

  return (
    <table className="w-full table-auto text-left">
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
              {actions.create ? (
                <CheckMarkIcon className="inline-block w-4" />
              ) : null}
            </td>
            <td className="text-center">
              {actions.update ? (
                <CheckMarkIcon className="inline-block w-4" />
              ) : null}
            </td>
            <td className="text-center">
              {actions.delete ? (
                <CheckMarkIcon className="inline-block w-4" />
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
