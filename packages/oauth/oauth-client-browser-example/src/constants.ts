const { searchParams } = new URL(window.location.href)

// Inserted during build
declare const process: { env: { NODE_ENV: string } }

export const ENV_DEFAULT = process.env.NODE_ENV
export const ENV = searchParams.get('env') ?? ENV_DEFAULT

export const PLC_DIRECTORY_URL_DEFAULT =
  ENV === 'development' ? 'http://localhost:2582' : undefined
export const PLC_DIRECTORY_URL: string | undefined =
  searchParams.get('plc_directory_url') ?? PLC_DIRECTORY_URL_DEFAULT

export const HANDLE_RESOLVER_URL_DEFAULT =
  ENV === 'development' ? 'http://localhost:2584' : 'https://bsky.social'
export const HANDLE_RESOLVER_URL: string =
  searchParams.get('handle_resolver') ?? HANDLE_RESOLVER_URL_DEFAULT

export const SIGN_UP_URL_DEFAULT =
  ENV === 'development' ? 'http://localhost:2583' : 'https://bsky.social'
export const SIGN_UP_URL: string =
  searchParams.get('sign_up_url') ?? SIGN_UP_URL_DEFAULT

export const OAUTH_SCOPE_DEFAULT: string =
  ENV === 'development'
    ? [
        'atproto',
        'account:email',
        'identity:*',
        'include:com.atproto.moderation.basePermissions',
        'include:com.example.calendar.basePermissions?aud=did:web:api.bsky.app#calendar_service',
      ].join(' ')
    : [
        'atproto',
        'account:email',
        'account:status',
        'blob:*/*',
        'repo:*',
        'rpc:*?aud=did:web:api.bsky.app#bsky_appview',
        'include:directory.lexicon.calendar.basePermissions?aud=did:web:api.bsky.app#calendar_service',
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
