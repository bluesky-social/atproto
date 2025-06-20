import { z } from 'zod'

/**
 * @see {@link https://openid.net/specs/openid-connect-core-1_0.html#AuthError}
 */
export const oidcAuthorizationResponseErrorSchema = z.enum([
  // The Authorization Server requires End-User interaction of some form to proceed. This error MAY be returned when the prompt parameter value in the Authentication Request is none, but the Authentication Request cannot be completed without displaying a user interface for End-User interaction.
  'interaction_required',
  // The Authorization Server requires End-User authentication. This error MAY be returned when the prompt parameter value in the Authentication Request is none, but the Authentication Request cannot be completed without displaying a user interface for End-User authentication.
  'login_required',
  // The End-User is REQUIRED to select a session at the Authorization Server. The End-User MAY be authenticated at the Authorization Server with different associated accounts, but the End-User did not select a session. This error MAY be returned when the prompt parameter value in the Authentication Request is none, but the Authentication Request cannot be completed without displaying a user interface to prompt for a session to use.
  'account_selection_required',
  // The Authorization Server requires End-User consent. This error MAY be returned when the prompt parameter value in the Authentication Request is none, but the Authentication Request cannot be completed without displaying a user interface for End-User consent.
  'consent_required',
  // The request_uri in the Authorization Request returns an error or contains invalid data.
  'invalid_request_uri',
  // The request parameter contains an invalid Request Object.
  'invalid_request_object',
  // The OP does not support use of the request parameter defined in Section 6.
  'request_not_supported',
  // The OP does not support use of the request_uri parameter defined in Section 6.
  'request_uri_not_supported',
  // The OP does not support use of the registration parameter defined in Section 7.2.1.
  'registration_not_supported',
])

export type OidcAuthorizationResponseError = z.infer<
  typeof oidcAuthorizationResponseErrorSchema
>
