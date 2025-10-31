import { ifString } from '../lib/util.ts'
import { useOAuthContext } from '../providers/OAuthProvider.tsx'
import { useGetActorProfileQuery } from '../queries/use-get-actor-profile-query.ts'
import { useGetSessionQuery } from '../queries/use-get-session-query.ts'
import { ButtonDropdown } from './ButtonDropdown.tsx'

export function UserMenu() {
  const { session, signOut } = useOAuthContext()
  const getProfile = useGetActorProfileQuery()
  const getSession = useGetSessionQuery()

  if (!session) return null

  const { did } = session

  const displayName = ifString(getProfile.data?.value?.displayName)
  const handle = getSession.data?.handle

  return (
    <ButtonDropdown
      transparent
      aria-label="User menu"
      menu={[
        {
          label: handle && <b>{handle}</b>,
          items: [
            {
              label: did,
              onClick: () => {
                navigator.clipboard.writeText(did)
              },
            },
            {
              label: 'Profile',
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
