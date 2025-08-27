const { searchParams } = new URL(window.location.href)

// Inserted during build
declare const process: { env: { NODE_ENV: string } }

export const ENV = searchParams.get('env') ?? process.env.NODE_ENV

export const PLC_DIRECTORY_URL: string | undefined =
  searchParams.get('plc_directory_url') ??
  (ENV === 'development' ? 'http://localhost:2582' : undefined)

export const HANDLE_RESOLVER_URL: string =
  searchParams.get('handle_resolver') ??
  (ENV === 'development' ? 'http://localhost:2584' : 'https://bsky.social')

export const SIGN_UP_URL: string =
  searchParams.get('sign_up_url') ??
  (ENV === 'development' ? 'http://localhost:2583' : 'https://bsky.social')

export const OAUTH_SCOPE: string =
  searchParams.get('scope') ??
  (ENV === 'development'
    ? [
        'atproto',
        'account:email',
        'identity:*',
        'include:com.atproto.moderation.basePermissions',
        'include:com.example.calendar.basePermissions?aud=did:web:api.bsky.app#foo',
      ].join(' ')
    : [
        'atproto',
        'account:email',
        'account:status',
        'blob:*/*',
        'repo:*',
        'rpc:*?aud=did:web:bsky.app#bsky_appview',
      ].join(' '))
