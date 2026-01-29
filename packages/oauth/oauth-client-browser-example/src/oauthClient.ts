import {
  BrowserOAuthClient,
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
  scope: [
    // Always required
    'atproto',
    // Required by this app to setup labelers
    'rpc:app.bsky.actor.getPreferences?aud=*',
    // Additional scopes from env
    OAUTH_SCOPE,
  ]
    .filter(Boolean)
    .join(' '),
  redirect_uris: [LOOPBACK_CANONICAL_LOCATION],
})

export const oauthClient = new BrowserOAuthClient({
  allowHttp: ENV === 'development' || ENV === 'test',
  handleResolver: HANDLE_RESOLVER_URL,
  plcDirectoryUrl: PLC_DIRECTORY_URL,
  clientMetadata,
})
