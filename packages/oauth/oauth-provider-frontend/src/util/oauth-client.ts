export type { OAuthClientMetadata } from '@atproto/oauth-types'

// @NOTE: not importing these from @atproto/oauth-types here because 1) we don't
// need to validate here and 2) we prefer not to import un-necessary code to
// improve bundle size (~100k impact)
export const isOAuthClientIdLoopback = (clientId: string) =>
  clientId.startsWith('http://')
export const isConventionalOAuthClientId = (clientId: string) => {
  try {
    const url = new URL(clientId)
    return (
      url.protocol === 'https:' &&
      url.pathname === '/oauth-client-metadata.json' &&
      !url.port &&
      !url.search
    )
  } catch {
    return false
  }
}
