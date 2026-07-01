import {
  ArrowSquareOutIcon,
  ClipboardIcon,
  UserGearIcon,
} from '@phosphor-icons/react'
import { PDS_OPERATOR_URL } from '../constants.ts'
import { app, com } from '../lexicons.ts'
import { useAuthenticatedClient } from '../providers/AuthenticationProvider.tsx'
import {
  useOAuthContext,
  useOAuthSession,
} from '../providers/OAuthProvider.tsx'
import { useGetTokenInfoQuery } from '../queries/use-get-token-info-query.ts'
import { useLexQuery } from '../queries/use-lex-query.ts'
import { useLexRecord } from '../queries/use-lex-record.ts'
import { ButtonDropdown } from './ButtonDropdown.tsx'

export function UserMenu() {
  const { signOut } = useOAuthContext()
  const client = useAuthenticatedClient()
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
          label: handle && <b className="flex-1">{handle}</b>,
          onClick: () => {
            if (handle) navigator.clipboard.writeText(handle)
          },
          items: [
            {
              label: (
                <>
                  <span className="flex-1">{session.did}</span>
                  <ClipboardIcon weight="bold" className="size-4" />
                </>
              ),
              onClick: () => {
                navigator.clipboard.writeText(session.did)
              },
            },
            iss === PDS_OPERATOR_URL && {
              label: (
                <>
                  <span className="flex-1">Account manager</span>
                  <UserGearIcon weight="bold" className="size-4" />
                </>
              ),
              onClick: () => {
                window.open(`${iss}/account`, '_blank')
              },
            },
            {
              label: (
                <>
                  <span className="flex-1">Profile</span>
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
          label: 'Sign out',
          onClick: signOut,
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
