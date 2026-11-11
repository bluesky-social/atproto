import type { FedcmRegistrationData } from '@atproto/oauth-provider-api'
import type { OAuthProvider } from '../../oauth-provider.js'
import { buildFedcmConfigUrl } from '../create-fedcm-middleware.js'

export function getFedcmRegistrationData(
  server: Pick<OAuthProvider, 'fedcm' | 'issuer' | 'authenticationMaxAge'>,
): FedcmRegistrationData | undefined {
  if (!server.fedcm) return undefined
  return {
    configUrl: buildFedcmConfigUrl(server.issuer),
    accountsExpiration: server.authenticationMaxAge,
  }
}
