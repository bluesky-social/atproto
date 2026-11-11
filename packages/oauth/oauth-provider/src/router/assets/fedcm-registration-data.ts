import type { FedcmRegistrationData } from '@atproto/oauth-provider-api'
import type { DeviceAccount } from '../../account/account-store.js'
import type { OAuthProvider } from '../../oauth-provider.js'
import { buildFedcmConfigUrl } from '../create-fedcm-middleware.js'

/**
 * @param eligibleAccounts - {@link OAuthProvider.listFedcmAccounts} for the
 * device, i.e. the same accounts the `Set-Login` header was derived from.
 */
export function getFedcmRegistrationData(
  server: Pick<OAuthProvider, 'fedcm' | 'issuer' | 'authenticationMaxAge'>,
  eligibleAccounts: readonly DeviceAccount[],
): FedcmRegistrationData | undefined {
  if (!server.fedcm) return undefined
  return {
    configUrl: buildFedcmConfigUrl(server.issuer),
    accountsExpiration: server.authenticationMaxAge,
    eligibleDids: eligibleAccounts.map(({ account }) => account.did),
  }
}
