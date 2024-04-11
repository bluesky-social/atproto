import { AccessToken } from '../access-token/access-token.js'
import { AuthorizationDetails } from '../parameters/authorization-details.js'
import { RefreshToken } from './refresh-token.js'
import { TokenType } from './token-type.js'

/**
 * @see {@link https://www.rfc-editor.org/rfc/rfc6749.html#section-5.1 | RFC 6749 (OAuth2), Section 5.1}
 */
export type TokenResponse = {
  id_token?: string
  access_token?: AccessToken
  token_type?: TokenType
  expires_in?: number
  refresh_token?: RefreshToken
  scope: string
  authorization_details?: AuthorizationDetails

  // https://www.rfc-editor.org/rfc/rfc6749.html#section-5.1
  // > The client MUST ignore unrecognized value names in the response.
  [k: string]: unknown
}
