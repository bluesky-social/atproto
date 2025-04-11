import { OAuthTokenType } from '@atproto/oauth-types'
import { Code } from '../request/code.js'

/**
 * @note `iss` and `state` will be added from the
 * {@link AuthorizationResultRedirect} object.
 */
export type AuthorizationRedirectParameters =
  | {
      // iss: string
      // state?: string
      code: Code
      id_token?: string
      access_token?: string
      token_type?: OAuthTokenType
      expires_in?: string
    }
  | {
      // iss: string
      // state?: string
      error: string
      error_description?: string
      error_uri?: string
    }
