import { OAuthAuthorizationDetails } from './oauth-authorization-details.js'
import { OAuthTokenType } from './oauth-token-type.js'

// https://datatracker.ietf.org/doc/html/rfc7662#section-2.2
export type OAuthIntrospectionResponse =
  | { active: false }
  | {
      active: true

      scope?: string
      client_id?: string
      username?: string
      token_type?: OAuthTokenType
      authorization_details?: OAuthAuthorizationDetails

      aud?: string | [string, ...string[]]
      exp?: number
      iat?: number
      iss?: string
      jti?: string
      nbf?: number
      sub?: string
    }
