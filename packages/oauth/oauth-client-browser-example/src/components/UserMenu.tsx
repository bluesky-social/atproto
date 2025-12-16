import { XrpcInvalidResponseError, XrpcResponseError } from '@atproto/lex'
import { app, com } from '../lexicons.ts'
import {
  useOAuthContext,
  useOAuthSession,
} from '../providers/OAuthProvider.tsx'
import { useAtprotoQuery } from '../queries/use-atproto-query.ts'
import { useAtprotoRecord } from '../queries/use-atproto-record.ts'
import { ButtonDropdown } from './ButtonDropdown.tsx'
import { ClipboardIcon, SquareArrowTopRightIcon } from './Icons.tsx'

export function UserMenu() {
  const { signOut } = useOAuthContext()
  const session = useOAuthSession()

  const getProfile = useAtprotoRecord(app.bsky.actor.profile)
  const getSession = useAtprotoQuery(com.atproto.server.getSession)

  const displayName = getProfile.data?.value?.displayName
  const handle = getSession.data?.body.handle

  if (getSession.error) {
    if (getSession.error.error === 'Unexpected') {
      const { reason } = getSession.error
      // Unable to perform the request
      if (reason instanceof XrpcResponseError) {
        // The server returned a syntactically valid XRPC error response, but
        // used an error code that is not declared for this method
        reason.error // string (e.g. "AuthenticationRequired", "RateLimitExceeded", etc.)
        reason.message // string
        reason.status // number
        reason.headers // Headers
        reason.payload // { body: { error: string, message?: string }; encoding: string }
      } else if (reason instanceof XrpcInvalidResponseError) {
        // The response was incomplete (e.g. connection dropped), or
        // invalid (e.g. malformed JSON, data does not match schema).
        reason.error // "InvalidResponse"
        reason.message // string
        reason.response.status // number
        reason.response.headers // Headers
        reason.response.payload // null | { body: unknown; encoding: string }
      } else {
        // Fetch failed or something
        reason
      }
    } else {
      // A declared error for that method
      getSession.error // XrpcResponseError<'KnownError1' | 'KnownError2' | ...>
    }
  }

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
        (getProfile.isLoading
          ? null
          : handle || (getSession.isLoading ? null : handle || session.did))}
    </ButtonDropdown>
  )
}
