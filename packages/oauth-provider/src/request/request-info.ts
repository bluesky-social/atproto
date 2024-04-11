import { ClientAuth } from '../client/client-auth.js'
import { AuthorizationParameters } from '../parameters/authorization-parameters.js'
import { RequestId } from './request-id.js'
import { RequestUri } from './request-uri.js'

export type RequestInfo = {
  id: RequestId
  uri: RequestUri
  parameters: AuthorizationParameters
  expiresAt: Date
  clientAuth: ClientAuth
}
