import { OAuthAuthorizationRequestParameters } from '@atproto/oauth-types'
import { AuthorizationError } from './authorization-error.js'

/**
 * @see
 * {@link https://datatracker.ietf.org/doc/html/rfc9396#section-14.6 | RFC 9396 - OAuth Dynamic Client Registration Metadata Registration Error}
 *
 * The AS MUST refuse to process any unknown authorization details type or
 * authorization details not conforming to the respective type definition. The
 * AS MUST abort processing and respond with an error
 * invalid_authorization_details to the client if any of the following are true
 * of the objects in the authorization_details structure:
 *  - contains an unknown authorization details type value,
 *  - is an object of known type but containing unknown fields,
 *  - contains fields of the wrong type for the authorization details type,
 *  - contains fields with invalid values for the authorization details type, or
 *  - is missing required fields for the authorization details type.
 */
export class InvalidAuthorizationDetailsError extends AuthorizationError {
  constructor(
    parameters: OAuthAuthorizationRequestParameters,
    error_description: string,
    cause?: unknown,
  ) {
    super(parameters, error_description, 'invalid_authorization_details', cause)
  }
}
