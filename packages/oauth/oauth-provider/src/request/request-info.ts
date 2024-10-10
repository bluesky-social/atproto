import { OAuthAuthorizationRequestParameters } from '@atproto/oauth-types'
import { ClientId } from '../client/client-id.js'
import { ClientAuth } from '../client/client-auth.js'
import { RequestId } from './request-id.js'
import { RequestUri } from './request-uri.js'

export type RequestInfo = {
  id: RequestId
  uri: RequestUri
  parameters: Readonly<OAuthAuthorizationRequestParameters>
  expiresAt: Date
  clientId: ClientId
  clientAuth: ClientAuth
}
