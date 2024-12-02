import { TypeOf, z } from 'zod'
import { oauthClientIdSchema } from './oauth-client-id.js'
import { httpsUriSchema } from './uri.js'
import { extractUrlPath, isHostnameIP } from './util.js'

/**
 * @see {@link https://drafts.aaronpk.com/draft-parecki-oauth-client-id-metadata-document/draft-parecki-oauth-client-id-metadata-document.html}
 */
export const oauthClientIdDiscoverableSchema = z
  .intersection(oauthClientIdSchema, httpsUriSchema)
  .superRefine((value, ctx): value is `https://${string}/${string}` => {
    const url = new URL(value)

    if (url.username || url.password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'ClientID must not contain credentials',
      })
      return false
    }

    if (url.hash) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'ClientID must not contain a fragment',
      })
      return false
    }

    if (url.pathname === '/') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'ClientID must contain a path component (e.g. "/client-metadata.json")',
      })
      return false
    }

    if (url.pathname.endsWith('/')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'ClientID path must not end with a trailing slash',
      })
      return false
    }

    if (isHostnameIP(url.hostname)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'ClientID hostname must not be an IP address',
      })
      return false
    }

    // URL constructor normalizes the URL, so we extract the path manually to
    // avoid normalization, then compare it to the normalized path to ensure
    // that the URL does not contain path traversal or other unexpected characters
    if (extractUrlPath(value) !== url.pathname) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `ClientID must be in canonical form ("${url.href}", got "${value}")`,
      })
      return false
    }

    return true
  })

export type OAuthClientIdDiscoverable = TypeOf<
  typeof oauthClientIdDiscoverableSchema
>

export function isOAuthClientIdDiscoverable(
  clientId: string,
): clientId is OAuthClientIdDiscoverable {
  return oauthClientIdDiscoverableSchema.safeParse(clientId).success
}

export function assertOAuthDiscoverableClientId(
  value: string,
): asserts value is OAuthClientIdDiscoverable {
  void oauthClientIdDiscoverableSchema.parse(value)
}

export function parseOAuthDiscoverableClientId(clientId: string): URL {
  return new URL(oauthClientIdDiscoverableSchema.parse(clientId))
}
