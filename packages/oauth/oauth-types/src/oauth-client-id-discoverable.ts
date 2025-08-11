import { TypeOf, z } from 'zod'
import { oauthClientIdSchema } from './oauth-client-id.js'
import { httpsUriSchema } from './uri.js'
import { extractUrlPath, isHostnameIP } from './util.js'

/**
 * @see {@link https://drafts.aaronpk.com/draft-parecki-oauth-client-id-metadata-document/draft-parecki-oauth-client-id-metadata-document.html}
 */
export const oauthClientIdDiscoverableSchema = z
  .intersection(oauthClientIdSchema, httpsUriSchema)
  .transform((input, ctx) => {
    const url = new URL(input)

    if (url.username || url.password) {
      ctx.addIssue({
        code: 'custom',
        message: 'ClientID must not contain credentials',
      })
      return z.NEVER
    }

    if (url.hash) {
      ctx.addIssue({
        code: 'custom',
        message: 'ClientID must not contain a fragment',
      })
      return z.NEVER
    }

    if (url.pathname === '/') {
      ctx.addIssue({
        code: 'custom',
        message:
          'ClientID must contain a path component (e.g. "/client-metadata.json")',
      })
      return z.NEVER
    }

    if (url.pathname.endsWith('/')) {
      ctx.addIssue({
        code: 'custom',
        message: 'ClientID path must not end with a trailing slash',
      })
      return z.NEVER
    }

    if (isHostnameIP(url.hostname)) {
      ctx.addIssue({
        code: 'custom',
        message: 'ClientID hostname must not be an IP address',
      })
      return z.NEVER
    }

    // URL constructor normalizes the URL, so we extract the path manually to
    // avoid normalization, then compare it to the normalized path to ensure
    // that the URL does not contain path traversal or other unexpected characters
    if (extractUrlPath(input) !== url.pathname) {
      ctx.addIssue({
        code: 'custom',
        message: `ClientID must be in canonical form ("${url.href}", got "${input}")`,
      })
      return z.NEVER
    }

    return input as `https://${string}/${string}`
  })

export type OAuthClientIdDiscoverable = TypeOf<
  typeof oauthClientIdDiscoverableSchema
>

export function isOAuthClientIdDiscoverable(
  clientId: string,
): clientId is OAuthClientIdDiscoverable {
  return oauthClientIdDiscoverableSchema.safeParse(clientId).success
}

export const conventionalOAuthClientIdSchema =
  oauthClientIdDiscoverableSchema.transform((input, ctx) => {
    const url = new URL(input)

    if (url.port) {
      ctx.addIssue({
        code: 'custom',
        message: 'ClientID must not contain a port',
      })
      return z.NEVER
    }

    if (url.search) {
      ctx.addIssue({
        code: 'custom',
        message: 'ClientID must not contain a query string',
      })
      return z.NEVER
    }

    if (url.pathname !== '/oauth-client-metadata.json') {
      ctx.addIssue({
        code: 'custom',
        message: 'ClientID must be "/oauth-client-metadata.json"',
      })
      return z.NEVER
    }

    return input as `https://${string}/oauth-client-metadata.json`
  })

export type ConventionalOAuthClientId = TypeOf<
  typeof conventionalOAuthClientIdSchema
>

export function isConventionalOAuthClientId(
  clientId: string,
): clientId is ConventionalOAuthClientId {
  return conventionalOAuthClientIdSchema.safeParse(clientId).success
}

export function assertOAuthDiscoverableClientId(
  value: string,
): asserts value is OAuthClientIdDiscoverable {
  void oauthClientIdDiscoverableSchema.parse(value)
}

export function parseOAuthDiscoverableClientId(clientId: string): URL {
  return new URL(oauthClientIdDiscoverableSchema.parse(clientId))
}
