import type { ServerResponse } from 'node:http'
import type { DeviceAccount } from '../account/account-store.js'
import type { DeviceId } from '../device/device-id.js'
import type { OAuthProvider } from '../oauth-provider.js'

/**
 * Sets `Set-Login` from {@link OAuthProvider.listFedcmAccounts} and returns
 * those eligible accounts (none when FedCM is disabled).
 */
export async function setFedcmLoginStatus(
  server: OAuthProvider,
  deviceId: DeviceId,
  res: ServerResponse,
): Promise<readonly DeviceAccount[]> {
  if (!server.fedcm) return []

  const accounts = await server.listFedcmAccounts(deviceId)
  res.setHeader('Set-Login', accounts.length ? 'logged-in' : 'logged-out')
  return accounts
}
