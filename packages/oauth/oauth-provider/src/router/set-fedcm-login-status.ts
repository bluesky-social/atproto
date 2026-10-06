import type { ServerResponse } from 'node:http'
import type { DeviceId } from '../device/device-id.js'
import type { OAuthProvider } from '../oauth-provider.js'

export async function setFedcmLoginStatus(
  server: OAuthProvider,
  deviceId: DeviceId,
  res: ServerResponse,
): Promise<void> {
  if (!server.fedcm) return

  const accounts = await server.listFedcmAccounts(deviceId)
  res.setHeader('Set-Login', accounts.length ? 'logged-in' : 'logged-out')
}
