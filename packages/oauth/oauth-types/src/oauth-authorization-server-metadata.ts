import { z } from 'zod'
import { oauthCodeChallengeMethodSchema } from './oauth-code-challenge-method.js'
import { oauthIssuerIdentifierSchema } from './oauth-issuer-identifier.js'
import { webUriSchema } from './uri.js'

/**
 * @see {@link https://datatracker.ietf.org/doc/html/rfc8414}
 * @note we do not enforce https: scheme in URIs to support development
 * environments. Make sure to validate the URIs before using it in a production
 * environment.
 */
export const oauthAuthorizationServerMetadataSchema = z.object({
  issuer: oauthIssuerIdentifierSchema,

  claims_supported: z.array(z.string()).optional(),
  claims_locales_supported: z.array(z.string()).optional(),
  claims_parameter_supported: z.boolean().optional(),
  request_parameter_supported: z.boolean().optional(),
  request_uri_parameter_supported: z.boolean().optional(),
  require_request_uri_registration: z.boolean().optional(),
  scopes_supported: z.array(z.string()).optional(),
  subject_types_supported: z.array(z.string()).optional(),
  response_types_supported: z.array(z.string()).optional(),
  response_modes_supported: z.array(z.string()).optional(),
  grant_types_supported: z.array(z.string()).optional(),
  code_challenge_methods_supported: z
    .array(oauthCodeChallengeMethodSchema)
    .min(1)
    .optional(),
  ui_locales_supported: z.array(z.string()).optional(),
  id_token_signing_alg_values_supported: z.array(z.string()).optional(),
  display_values_supported: z.array(z.string()).optional(),
  request_object_signing_alg_values_supported: z.array(z.string()).optional(),
  authorization_response_iss_parameter_supported: z.boolean().optional(),
  authorization_details_types_supported: z.array(z.string()).optional(),
  request_object_encryption_alg_values_supported: z
    .array(z.string())
    .optional(),
  request_object_encryption_enc_values_supported: z
    .array(z.string())
    .optional(),

  jwks_uri: webUriSchema.optional(),

  authorization_endpoint: webUriSchema, // .optional(),

  token_endpoint: webUriSchema, // .optional(),
  token_endpoint_auth_methods_supported: z.array(z.string()).optional(),
  token_endpoint_auth_signing_alg_values_supported: z
    .array(z.string())
    .optional(),

  revocation_endpoint: webUriSchema.optional(),
  introspection_endpoint: webUriSchema.optional(),
  pushed_authorization_request_endpoint: webUriSchema.optional(),

  require_pushed_authorization_requests: z.boolean().optional(),

  userinfo_endpoint: webUriSchema.optional(),
  end_session_endpoint: webUriSchema.optional(),
  registration_endpoint: webUriSchema.optional(),

  // https://datatracker.ietf.org/doc/html/rfc9449#section-5.1
  dpop_signing_alg_values_supported: z.array(z.string()).optional(),

  // https://datatracker.ietf.org/doc/html/draft-ietf-oauth-resource-metadata-05#section-4
  protected_resources: z.array(webUriSchema).optional(),

  // https://drafts.aaronpk.com/draft-parecki-oauth-client-id-metadata-document/draft-parecki-oauth-client-id-metadata-document.html
  client_id_metadata_document_supported: z.boolean().optional(),
})

export type OAuthAuthorizationServerMetadata = z.infer<
  typeof oauthAuthorizationServerMetadataSchema
>

export const oauthAuthorizationServerMetadataValidator =
  oauthAuthorizationServerMetadataSchema
    .superRefine((data, ctx) => {
      if (
        data.require_pushed_authorization_requests &&
        !data.pushed_authorization_request_endpoint
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            '"pushed_authorization_request_endpoint" required when "require_pushed_authorization_requests" is true',
        })
      }
    })
    .superRefine((data, ctx) => {
      if (data.response_types_supported) {
        if (!data.response_types_supported.includes('code')) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Response type "code" is required',
          })
        }
      }
    })
