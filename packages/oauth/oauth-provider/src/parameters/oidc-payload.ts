import { OAuthAuthenticationRequestParameters } from '@atproto/oauth-types'
import { Account } from '../account/account.js'
import { OIDCStandardPayload, OIDC_SCOPE_CLAIMS } from '../oidc/claims.js'
import { claimRequested } from './claims-requested.js'

export function oidcPayload(
  params: OAuthAuthenticationRequestParameters,
  account: Account,
) {
  const payload: OIDCStandardPayload = {}

  const scopes = params.scope ? params.scope?.split(' ') : undefined
  if (scopes) {
    for (const [scope, claims] of Object.entries(OIDC_SCOPE_CLAIMS)) {
      const allowed = scopes.includes(scope)
      for (const claim of claims) {
        const value = allowed ? account[claim] : undefined
        // Should not throw as RequestManager should have already checked
        // that all the essential claims are available.
        if (claimRequested(params, 'id_token', claim, value)) {
          payload[claim] = value as any // All good as long as the account props match the claims
        }
      }
    }
  }

  return payload
}
