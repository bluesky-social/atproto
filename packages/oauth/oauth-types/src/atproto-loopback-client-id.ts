import { DEFAULT_LOOPBACK_CLIENT_REDIRECT_URIS } from './atproto-loopback-client-redirect-uris.js'
import {
  AtprotoOAuthScope,
  DEFAULT_ATPROTO_OAUTH_SCOPE,
  asAtprotoOAuthScope,
  isAtprotoOAuthScope,
} from './atproto-oauth-scope.js'
import {
  LOOPBACK_CLIENT_ID_ORIGIN,
  OAuthClientIdLoopback,
  parseOAuthLoopbackClientId,
} from './oauth-client-id-loopback.js'
import {
  OAuthLoopbackRedirectURI,
  oauthLoopbackClientRedirectUriSchema,
} from './oauth-redirect-uri.js'
import { arrayEquivalent, asArray } from './util.js'

export type OAuthLoopbackClientIdConfig = {
  scope?: string
  redirect_uris?: Iterable<string>
}

export function buildAtprotoLoopbackClientId(
  config?: OAuthLoopbackClientIdConfig,
): OAuthClientIdLoopback {
  if (config) {
    const params = new URLSearchParams()

    const { scope } = config
    if (scope != null && scope !== DEFAULT_ATPROTO_OAUTH_SCOPE) {
      params.set('scope', asAtprotoOAuthScope(scope))
    }

    const redirectUris = asArray(config.redirect_uris)
    if (
      redirectUris &&
      !arrayEquivalent(redirectUris, DEFAULT_LOOPBACK_CLIENT_REDIRECT_URIS)
    ) {
      if (!redirectUris.length) {
        throw new TypeError(`Unexpected empty "redirect_uris" config`)
      }
      for (const uri of redirectUris) {
        params.append(
          'redirect_uri',
          oauthLoopbackClientRedirectUriSchema.parse(uri),
        )
      }
    }

    if (params.size) {
      return `${LOOPBACK_CLIENT_ID_ORIGIN}?${params.toString()}`
    }
  }

  return LOOPBACK_CLIENT_ID_ORIGIN
}

export type AtprotoLoopbackClientIdParams = {
  scope: AtprotoOAuthScope
  redirect_uris: [OAuthLoopbackRedirectURI, ...OAuthLoopbackRedirectURI[]]
}

export function parseAtprotoLoopbackClientId(
  clientId: string,
): AtprotoLoopbackClientIdParams {
  const { scope = DEFAULT_ATPROTO_OAUTH_SCOPE, redirect_uris } =
    parseOAuthLoopbackClientId(clientId)
  if (!isAtprotoOAuthScope(scope)) {
    throw new TypeError(
      'ATProto Loopback ClientID must include "atproto" scope',
    )
  }
  return {
    scope,
    redirect_uris: redirect_uris ?? [...DEFAULT_LOOPBACK_CLIENT_REDIRECT_URIS],
  }
}
