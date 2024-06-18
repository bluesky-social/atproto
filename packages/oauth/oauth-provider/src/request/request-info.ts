import { OAuthAuthenticationRequestParameters } from '@atproto/oauth-types'
import { ClientAuth } from '../client/client-auth.js'
import { RequestId } from './request-id.js'
import { RequestUri } from './request-uri.js'

export type RequestInfo = {
  id: RequestId
  uri: RequestUri
  parameters: Readonly<OAuthAuthenticationRequestParameters>
  expiresAt: Date
  clientAuth: ClientAuth
}
