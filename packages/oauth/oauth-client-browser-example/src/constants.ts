const { searchParams } = new URL(window.location.href)
const getParam = <T extends string | undefined>(
  name: string,
  defaultValue: T,
): string | T => searchParams.get(name) ?? defaultValue

// Inserted during build
declare const process: { env: { NODE_ENV: string } }

export const ENV_DEFAULT = process.env.NODE_ENV
export const ENV = getParam('env', ENV_DEFAULT)

export const PLC_DIRECTORY_URL_DEFAULT =
  ENV === 'development' ? 'http://localhost:2582' : undefined
export const HANDLE_RESOLVER_URL_DEFAULT =
  ENV === 'development' ? 'http://localhost:2584' : 'https://bsky.social'
export const SIGN_UP_URL_DEFAULT =
  ENV === 'development' ? 'http://localhost:2583' : 'https://bsky.social'
export const BSKY_API_URL_DEFAULT =
  ENV === 'development' ? 'http://localhost:2584' : 'https://api.bsky.app'
export const BSKY_API_DID_DEFAULT =
  ENV === 'development' ? 'did:example:invalid' : 'did:web:api.bsky.app'

export const BSKY_API_URL = getParam('bsky_api_url', BSKY_API_URL_DEFAULT)
export const BSKY_API_DID = getParam('bsky_api_did', BSKY_API_DID_DEFAULT)

export const PLC_DIRECTORY_URL = getParam(
  'plc_directory_url',
  PLC_DIRECTORY_URL_DEFAULT,
)
export const HANDLE_RESOLVER_URL = getParam(
  'handle_resolver',
  HANDLE_RESOLVER_URL_DEFAULT,
)
export const SIGN_UP_URL = getParam('sign_up_url', SIGN_UP_URL_DEFAULT)

export const OAUTH_SCOPE_DEFAULT: string =
  ENV === 'development'
    ? [
        'atproto',
        'account:email',
        'account:status',
        'identity:*',
        'blob:*/*',
        'repo:*',
        'rpc:app.bsky.actor.getPreferences?aud=*',
        `rpc:*?aud=${BSKY_API_DID}#bsky_appview`,
        `include:com.example.calendar.basePermissions?aud=${BSKY_API_DID}#calendar_service`,
      ].join(' ')
    : ENV === 'production'
      ? [
          'atproto',
          'account:email',
          'account:status',
          'blob:*/*',
          'repo:*',
          'rpc:app.bsky.actor.getPreferences?aud=*',
          `rpc:*?aud=${BSKY_API_DID}#bsky_appview`,
          `include:directory.lexicon.calendar.basePermissions?aud=${BSKY_API_DID}#calendar_service`,
        ].join(' ')
      : [
          'atproto',
          'account:email',
          'account:status',
          'blob:*/*',
          'repo:*',
          'rpc:app.bsky.actor.getPreferences?aud=*',
          `rpc:*?aud=${BSKY_API_DID}#bsky_appview`,
        ].join(' ')
export const OAUTH_SCOPE: string =
  searchParams.get('scope') ?? OAUTH_SCOPE_DEFAULT

// This app is dynamically configured via query parameters. The canonical URL is
// always 127.0.0.1 with the relevant params set.
export const LOOPBACK_CANONICAL_LOCATION = Object.assign(
  new URL(window.location.origin),
  {
    protocol: 'http:',
    hostname: '127.0.0.1',
    search: new URLSearchParams({
      ...(ENV !== ENV_DEFAULT && { env: ENV }),
      ...(PLC_DIRECTORY_URL !== PLC_DIRECTORY_URL_DEFAULT && {
        plc_directory_url: PLC_DIRECTORY_URL,
      }),
      ...(HANDLE_RESOLVER_URL !== HANDLE_RESOLVER_URL_DEFAULT && {
        handle_resolver: HANDLE_RESOLVER_URL,
      }),
      ...(SIGN_UP_URL !== SIGN_UP_URL_DEFAULT && { sign_up_url: SIGN_UP_URL }),
      ...(OAUTH_SCOPE !== OAUTH_SCOPE_DEFAULT && { scope: OAUTH_SCOPE }),
    }).toString(),
  },
).href as `http://127.0.0.1/${string}`
