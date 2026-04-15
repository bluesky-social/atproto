import {
  BrowserOAuthClient,
  OAuthSession,
  buildAtprotoLoopbackClientMetadata,
} from '@atproto/oauth-client-browser'
import {
  ENV,
  HANDLE_RESOLVER_URL,
  LOOPBACK_CANONICAL_LOCATION,
  OAUTH_SCOPE,
  PLC_DIRECTORY_URL,
} from './constants.ts'

export const clientMetadata = buildAtprotoLoopbackClientMetadata({
  scope: Array.from(
    // Strip duplicate values from env
    new Set([
      // Always required
      'atproto',
      // Required by this app to setup labelers
      'rpc:app.bsky.actor.getPreferences?aud=*',
      // Additional scopes from env
      ...OAUTH_SCOPE.split(' ').filter(Boolean),
    ]),
  ).join(' '),
  redirect_uris: [LOOPBACK_CANONICAL_LOCATION],
})

export const oauthEvents = new EventTarget() as EventTarget & {
  addEventListener(
    type: 'deleted',
    listener: (event: CustomEvent<{ sub: string; cause: string }>) => void,
    options?: boolean | AddEventListenerOptions,
  ): void
  addEventListener(
    type: 'updated',
    listener: (
      event: CustomEvent<{ sub: string; session: OAuthSession }>,
    ) => void,
    options?: boolean | AddEventListenerOptions,
  ): void
}

export const oauthClient = new BrowserOAuthClient({
  allowHttp: ENV === 'development' || ENV === 'test',
  handleResolver: HANDLE_RESOLVER_URL,
  plcDirectoryUrl: PLC_DIRECTORY_URL,
  clientMetadata,
  // Since the client is static, let's forward the hooks using a shared event
  // target (oauthEvents) so that they can be consumed by other parts of the
  // app.
  onDelete: (sub, cause) => {
    console.debug('OAuth session deleted:', sub, cause)
    oauthEvents.dispatchEvent(
      new CustomEvent('deleted', { detail: { sub, cause } }),
    )
  },
  onUpdate: (sub, session) => {
    console.debug('OAuth session refreshed:', sub)
    oauthEvents.dispatchEvent(
      new CustomEvent('updated', { detail: { sub, session } }),
    )
  },
})

// We use "false" as refresh parameter to the oauthClient's init method in order
// restore the previously loaded session without making a network request to
// refresh tokens if the session requires a refresh. This allows the app to work
// off-line, and also makes the initial loading faster (by optimistically
// restoring the session in the initPromise).
export const initPromise = oauthClient.init(false).then(
  async (result) => {
    // Only trigger a (background) token refresh if we are not back from an
    // authorization flow (state is undefined).
    if (result && result.state === undefined) {
      void result.session.getTokenInfo(true)
    }
    return result
  },
  (err) => {
    console.warn('Failed to initialize OAuth client:', err)
  },
)
