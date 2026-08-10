import type { Did } from '@atproto/did'
import type {
  OAuthAuthorizationDetails,
  OAuthAuthorizationRequestParameters,
} from '@atproto/oauth-types'
import type { ClientAuth, ClientAuthLegacy } from '../client/client-auth.js'
import type { ClientId } from '../client/client-id.js'
import type { DeviceId } from '../device/device-id.js'
import type { Code } from '../request/code.js'

export type {
  ClientAuth,
  ClientAuthLegacy,
  ClientId,
  Code,
  DeviceId,
  Did,
  OAuthAuthorizationDetails,
  OAuthAuthorizationRequestParameters,
}

export type TokenData = {
  createdAt: Date
  updatedAt: Date
  expiresAt: Date
  clientId: ClientId
  clientAuth: ClientAuth | ClientAuthLegacy
  deviceId: DeviceId | null
  did: Did
  parameters: OAuthAuthorizationRequestParameters
  details?: null // Legacy field, not used
  code: Code | null

  /**
   * This will contain the parameter scope, translated into permissions
   *
   * @note null because this didn't use to exist. New tokens should always
   * include a scope.
   */
  scope: string | null
}
