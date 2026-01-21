import { app, com } from '../lexicons.ts'
import {
  useOAuthContext,
  useOAuthSession,
} from '../providers/OAuthProvider.tsx'
import { useLexQuery } from '../queries/use-lex-query.ts'
import { useLexRecord } from '../queries/use-lex-record.ts'
import { ButtonDropdown } from './ButtonDropdown.tsx'
import { ClipboardIcon, SquareArrowTopRightIcon } from './Icons.tsx'

export function UserMenu() {
  const { signOut } = useOAuthContext()
  const session = useOAuthSession()

  const profileQuery = useLexRecord(app.bsky.actor.profile)
  const sessionQuery = useLexQuery(com.atproto.server.getSession)

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
                  <ClipboardIcon className="w-4" />
                </>
              ),
              onClick: () => {
                navigator.clipboard.writeText(session.did)
              },
            },
            {
              label: (
                <>
                  <span className="flex-1">Profile</span>
                  <SquareArrowTopRightIcon className="w-4" />
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
