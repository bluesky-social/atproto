import { ClientId } from '../client/client-id.js'
import { ClientAuth } from '../client/client-auth.js'
import { DeviceId } from '../device/device-id.js'
import { Sub } from '../oidc/sub.js'
import { AuthorizationParameters } from '../parameters/authorization-parameters.js'
import { AuthorizationDetails } from '../parameters/authorization-details.js'
import { Code } from '../request/code.js'

export type {
  ClientId,
  ClientAuth,
  DeviceId,
  Sub,
  AuthorizationParameters,
  AuthorizationDetails,
  Code,
}

export type TokenData = {
  createdAt: Date
  updatedAt: Date
  expiresAt: Date
  clientId: ClientId
  clientAuth: ClientAuth
  deviceId: DeviceId | null
  sub: Sub
  parameters: AuthorizationParameters
  details: AuthorizationDetails | null
  code: Code | null
}
