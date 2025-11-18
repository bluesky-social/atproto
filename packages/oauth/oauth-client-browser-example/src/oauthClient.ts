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
  scope: OAUTH_SCOPE,
  redirect_uris: [LOOPBACK_CANONICAL_LOCATION],
})

export const oauthClient = new BrowserOAuthClient({
  allowHttp: ENV === 'development' || ENV === 'test',
  handleResolver: HANDLE_RESOLVER_URL,
  plcDirectoryUrl: PLC_DIRECTORY_URL,
  clientMetadata,
})
