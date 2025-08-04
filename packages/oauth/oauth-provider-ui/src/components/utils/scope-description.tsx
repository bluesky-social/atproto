import { useLingui } from '@lingui/react/macro'
import { useMemo } from 'react'
import { Override } from '#/lib/util'
import {
  BlobScope,
  DIDLike,
  NSID,
  PermissionSet,
  PermissionSetTransition,
  RepoAction,
  RepoScope,
  RpcScope,
} from '@atproto/oauth-scopes'
import { DescriptionCard } from './description-card'
import {
  AccountOutlinedIcon,
  AuthenticateIcon,
  ChatIcon,
  CheckMarkIcon,
  EmailIcon,
  IdentityIcon,
  ImageIcon,
  NewspaperIcon,
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
  const permissions = useMemo(
    () => new PermissionSetTransition(scope?.split(' ')),
    [scope],
  )

  if (permissions.scopes.size === 0) return null
  if (permissions.scopes.size === 1 && permissions.scopes.has('atproto')) {
    return null
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`} {...attrs}>
      <EmailPermissions permissions={permissions} />
      <AccountPermissions permissions={permissions} />
      <ChatPermissions permissions={permissions} />
      <IdentityPermissions permissions={permissions} />
      <BlobPermissions permissions={permissions} />
      <RepoPermissions permissions={permissions} />
      <RpcMethodsDetails permissions={permissions} />
    </div>
  )
}

function EmailPermissions({ permissions }: { permissions: PermissionSet }) {
  const { t } = useLingui()

  if (permissions.allowsAccount({ attribute: 'email', action: 'manage' })) {
    return (
      <DescriptionCard
        image={<EmailIcon className="h-6" />}
        title={t`Email`}
        description={t`Read and update your account's email address`}
      />
    )
  }

  if (permissions.allowsAccount({ attribute: 'email', action: 'read' })) {
    return (
      <DescriptionCard
        image={<EmailIcon className="h-6" />}
        title={t`Email`}
        description={t`Read your account's email address`}
      />
    )
  }

  return null
}

function BlobPermissions({ permissions }: { permissions: PermissionSet }) {
  const { t } = useLingui()

  const blobScopes = useMemo(
    () =>
      Array.from(permissions.scopes.map((v) => BlobScope.fromString(v))).filter(
        (v) => v != null,
      ),
    [permissions],
  )

  const isImagesOnly = useMemo(
    () =>
      blobScopes.every((s) => s.accept.every((a) => a.startsWith('image/'))),
    [blobScopes],
  )

  if (blobScopes.length === 0) return null

  return (
    <DescriptionCard
      image={
        isImagesOnly ? (
          <ImageIcon className="h-6" />
        ) : (
          <AccountOutlinedIcon className="h-6" />
        )
      }
      title={t`Storage`}
      description={
        isImagesOnly ? t`Upload and store images` : t`Upload and store files`
      }
    />
  )
}

function AccountPermissions({ permissions }: { permissions: PermissionSet }) {
  const { t } = useLingui()

  if (permissions.allowsAccount({ attribute: 'status', action: 'manage' })) {
    return (
      <DescriptionCard
        image={<AccountOutlinedIcon className="h-6" />}
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

function ChatPermissions({ permissions }: { permissions: PermissionSet }) {
  const { t } = useLingui()

  const canChat = useMemo(() => {
    return (
      permissions.scopes.has('transition:chat.bsky') ||
      permissions.scopes.some(isChatRpcScope)
    )
  }, [permissions])

  if (canChat) {
    return (
      <DescriptionCard
        image={<ChatIcon className="h-6" />}
        title={t`Chat`}
        description={t`Read and send chat messages`}
      />
    )
  }

  return null
}

function IdentityPermissions({ permissions }: { permissions: PermissionSet }) {
  const { t } = useLingui()

  if (
    permissions.allowsIdentity({ attribute: '*', action: 'manage' }) ||
    permissions.allowsIdentity({ attribute: '*', action: 'submit' })
  ) {
    return (
      <DescriptionCard
        image={<IdentityIcon className="h-6" />}
        title={t`Identity`}
        description={t`Manage your identity`}
      />
    )
  }

  if (permissions.allowsIdentity({ attribute: 'handle', action: 'manage' })) {
    return (
      <DescriptionCard
        image={<IdentityIcon className="h-6" />}
        title={t`Identity`}
        description={t`Update your handle`}
      />
    )
  }

  return null
}

function RpcMethodsDetails({ permissions }: { permissions: PermissionSet }) {
  const { t } = useLingui()

  const audMethods = useMemo(() => {
    const audMethods = new Map<'*' | DIDLike, Set<'*' | NSID>>()

    for (const s of permissions.scopes) {
      const parsed = RpcScope.fromString(s)
      if (!parsed) continue

      let set = audMethods.get(parsed.aud)
      if (!set) audMethods.set(parsed.aud, (set = new Set()))
      for (const lxm of parsed.lxm) set.add(lxm)
    }

    return audMethods
  }, [permissions])

  if (audMethods.size === 0) return null

  return (
    <DescriptionCard
      image={<AuthenticateIcon className="h-6" />}
      title={t`Authenticate`}
      description={t`Perform authenticated actions on your behalf`}
    >
      <table className="w-full table-auto">
        <thead>
          <tr className="text-sm">
            <th className="text-left font-normal">{t`Audience`}</th>
            <th className="text-left font-normal">{t`Methods`}</th>
          </tr>
        </thead>
        <tbody>
          {Array.from(audMethods.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([aud, lxms]) => (
              <tr key={aud} className="text-sm">
                <td className="align-top text-slate-500">
                  {aud === '*' ? (
                    <em>{t`Any audience`}</em>
                  ) : (
                    <code>{aud}</code>
                  )}
                </td>
                <td className="text-slate-500">
                  {lxms.has('*') ? (
                    <em>{t`No restrictions`}</em>
                  ) : (
                    Array.from(lxms)
                      .sort((a, b) => a.localeCompare(b))
                      .map((lxm) => (
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
    </DescriptionCard>
  )
}

function RepoPermissions({ permissions }: { permissions: PermissionSet }) {
  const { t } = useLingui()

  const repoActions = useMemo(() => {
    const repoActions = new Map<'*' | NSID, Set<RepoAction>>()

    for (const s of permissions.scopes) {
      const parsed = RepoScope.fromString(s)
      if (!parsed) continue

      for (const nsid of parsed.collection) {
        let set = repoActions.get(nsid)
        if (!set) repoActions.set(nsid, (set = new Set()))
        for (const action of parsed.action) set.add(action)
      }
    }

    return repoActions
  }, [permissions])

  if (permissions.allowsAccount({ attribute: 'repo', action: 'manage' })) {
    return (
      <DescriptionCard
        image={<NewspaperIcon className="h-6" />}
        title={t`Repository`}
        description={t`Override the entire public data repository`}
      />
    )
  }

  if (
    permissions.allowsRepo({ collection: '*', action: 'create' }) &&
    permissions.allowsRepo({ collection: '*', action: 'delete' }) &&
    permissions.allowsRepo({ collection: '*', action: 'update' })
  ) {
    return (
      <DescriptionCard
        image={<NewspaperIcon className="h-6" />}
        title={t`Repository`}
        description={t`Create, update, and delete any public record`}
      />
    )
  }

  if (repoActions.size === 0) {
    return null
  }

  return (
    <DescriptionCard
      image={<NewspaperIcon className="h-6" />}
      title={t`Repository`}
      description={t`Update public data`}
    >
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
          {Array.from(repoActions.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([nsid, actions]) => (
              <tr key={nsid} className="text-sm">
                <td className="text-slate-500">
                  {nsid === '*' ? (
                    <em>{t`Any collection`}</em>
                  ) : (
                    <code>{nsid}</code>
                  )}
                </td>
                <td className="text-center">
                  {actions.has('create') ? (
                    <CheckMarkIcon className="inline-block w-4" />
                  ) : null}
                </td>
                <td className="text-center">
                  {actions.has('update') ? (
                    <CheckMarkIcon className="inline-block w-4" />
                  ) : null}
                </td>
                <td className="text-center">
                  {actions.has('delete') ? (
                    <CheckMarkIcon className="inline-block w-4" />
                  ) : null}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </DescriptionCard>
  )
}
