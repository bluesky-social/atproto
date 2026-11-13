import { ArrowSquareOutIcon, CopyIcon, UserIcon } from '@phosphor-icons/react'
import { PDS_OPERATOR_URL } from '../constants.ts'
import { app, com } from '../lexicons.ts'
import { useBlobUrl } from '../lib/use-blob-url.ts'
import {
  useOAuthContext,
  useOAuthSession,
} from '../providers/OAuthProvider.tsx'
import { usePdsClient } from '../providers/PdsClientProvider.tsx'
import { useGetBlob } from '../queries/use-get-blob.ts'
import { useGetTokenInfoQuery } from '../queries/use-get-token-info-query.ts'
import { useLexQuery } from '../queries/use-lex-query.ts'
import { useLexRecord } from '../queries/use-lex-record.ts'
import { ButtonDropdown } from './ButtonDropdown.tsx'

export function UserMenu() {
  const { signOut } = useOAuthContext()
  const client = usePdsClient()
  const session = useOAuthSession()

  const tokenInfoQuery = useGetTokenInfoQuery()
  const profileQuery = useLexRecord(client, app.bsky.actor.profile)
  const sessionQuery = useLexQuery(client, com.atproto.server.getSession)

  const iss = tokenInfoQuery.data?.iss
  const displayName = profileQuery.data?.value?.displayName
  const handle = sessionQuery.data?.body.handle

  return (
    <ButtonDropdown
      transparent
      aria-label="User menu"
      menu={[
        {
          label: (
            <b className="flex-1">
              <Avatar profile={profileQuery.data?.value} />
              {handle}
            </b>
          ),
          items: [
            {
              label: (
                <>
                  <span className="flex-1 truncate">{session.did}</span>
                  <CopyIcon weight="bold" className="size-4" />
                </>
              ),
              onClick: () => {
                navigator.clipboard.writeText(session.did)
              },
            },
            {
              label: (
                <>
                  <span className="flex-1 truncate">Bluesky profile</span>
                  <ArrowSquareOutIcon weight="bold" className="size-4" />
                </>
              ),
              onClick: () => {
                window.open(`https://bsky.app/profile/${session.did}`, '_blank')
              },
            },
          ],
        },
        {
          items: [
            iss === PDS_OPERATOR_URL && {
              label: (
                <>
                  <span className="flex-1 truncate">Account manager</span>
                  <ArrowSquareOutIcon weight="bold" className="size-4" />
                </>
              ),
              onClick: () => {
                window.open(`${iss}/account`, '_blank')
              },
            },
            {
              label: 'Sign out',
              onClick: signOut,
            },
          ],
        },
      ]}
    >
      {displayName ||
        (profileQuery.isLoading
          ? null
          : handle || (sessionQuery.isLoading ? null : handle || session.did))}
    </ButtonDropdown>
  )
}

function Avatar({ profile }: { profile?: app.bsky.actor.profile.Main }) {
  // @NOTE Loading an image from a blob is not optimal (esp. since bluesky
  // profile pictures are available via CDN URL). We do use getBlob here for
  // demonstration purposes, to show how to use the getBlob API.

  const client = usePdsClient()
  const avatarBlob = useGetBlob(client, profile?.avatar)
  const avatarUrl = useBlobUrl(avatarBlob.data)

  if (!avatarUrl) {
    return (
      <UserIcon
        weight="bold"
        aria-hidden
        className="mr-2 inline-block size-4 rounded-full"
      />
    )
  }

  return (
    <img
      src={avatarUrl}
      alt="Avatar"
      aria-hidden
      className="mr-2 inline-block size-4 rounded-full"
    />
  )
}
