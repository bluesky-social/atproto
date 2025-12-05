import { useOAuthContext } from '../providers/OAuthProvider.tsx'
import { useGetActorProfileQuery } from '../queries/use-get-actor-profile-query.ts'
import { useGetSessionQuery } from '../queries/use-get-session-query.ts'
import { ButtonDropdown } from './ButtonDropdown.tsx'
import { ClipboardIcon, SquareArrowTopRightIcon } from './Icons.tsx'

export function UserMenu() {
  const { session, signOut } = useOAuthContext()
  const getProfile = useGetActorProfileQuery()
  const getSession = useGetSessionQuery()

  if (!session) return null

  const { did } = session

  const displayName = getProfile.data?.value?.displayName
  const handle = getSession.data?.handle

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
                  <span className="flex-1">{did}</span>
                  <ClipboardIcon className="w-4" />
                </>
              ),
              onClick: () => {
                navigator.clipboard.writeText(did)
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
                window.open(`https://bsky.app/profile/${did}`, '_blank')
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
        (getProfile.isLoading
          ? null
          : handle || (getSession.isLoading ? null : handle || did))}
    </ButtonDropdown>
  )
}
