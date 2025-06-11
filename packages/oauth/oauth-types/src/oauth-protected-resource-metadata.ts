import { z } from 'zod'
import { oauthIssuerIdentifierSchema } from './oauth-issuer-identifier.js'
import { webUriSchema } from './uri.js'

/**
 * @see {@link https://datatracker.ietf.org/doc/html/draft-ietf-oauth-resource-metadata-05#name-protected-resource-metadata-r}
 */
export const oauthProtectedResourceMetadataSchema = z.object({
  /**
   * REQUIRED. The protected resource's resource identifier, which is a URL that
   * uses the https scheme and has no query or fragment components. Using these
   * well-known resources is described in Section 3.
   *
   * @note This schema allows non https URLs for testing & development purposes.
   * Make sure to validate the URL before using it in a production environment.
   */
  resource: webUriSchema
    .refine((url) => !url.includes('?'), {
      message: 'Resource URL must not contain query parameters',
    })
    .refine((url) => !url.includes('#'), {
      message: 'Resource URL must not contain a fragment',
    }),

  /**
   * OPTIONAL. JSON array containing a list of OAuth authorization server issuer
   * identifiers, as defined in [RFC8414], for authorization servers that can be
   * used with this protected resource. Protected resources MAY choose not to
   * advertise some supported authorization servers even when this parameter is
   * used. In some use cases, the set of authorization servers will not be
   * enumerable, in which case this metadata parameter would not be used.
   */
  authorization_servers: z.array(oauthIssuerIdentifierSchema).optional(),

  /**
   * OPTIONAL. URL of the protected resource's JWK Set [JWK] document. This
   * contains public keys belonging to the protected resource, such as signing
   * key(s) that the resource server uses to sign resource responses. This URL
   * MUST use the https scheme. When both signing and encryption keys are made
   * available, a use (public key use) parameter value is REQUIRED for all keys
   * in the referenced JWK Set to indicate each key's intended usage.
   */
  jwks_uri: webUriSchema.optional(),

  /**
   * RECOMMENDED. JSON array containing a list of the OAuth 2.0 [RFC6749] scope
   * values that are used in authorization requests to request access to this
   * protected resource. Protected resources MAY choose not to advertise some
   * scope values supported even when this parameter is used.
   */
  scopes_supported: z.array(z.string()).optional(),

  /**
   * OPTIONAL. JSON array containing a list of the supported methods of sending
   * an OAuth 2.0 Bearer Token [RFC6750] to the protected resource. Defined
   * values are ["header", "body", "query"], corresponding to Sections 2.1, 2.2,
   * and 2.3 of RFC 6750.
   */
  bearer_methods_supported: z
    .array(z.enum(['header', 'body', 'query']))
    .optional(),

  /**
   * OPTIONAL. JSON array containing a list of the JWS [JWS] signing algorithms
   * (alg values) [JWA] supported by the protected resource for signing resource
   * responses, for instance, as described in [FAPI.MessageSigning]. No default
   * algorithms are implied if this entry is omitted. The value none MUST NOT be
   * used.
   */
  resource_signing_alg_values_supported: z.array(z.string()).optional(),

  /**
   * OPTIONAL. URL of a page containing human-readable information that
   * developers might want or need to know when using the protected resource
   */
  resource_documentation: webUriSchema.optional(),

  /**
   * OPTIONAL. URL that the protected resource provides to read about the
   * protected resource's requirements on how the client can use the data
   * provided by the protected resource
   */
  resource_policy_uri: webUriSchema.optional(),

  /**
   * OPTIONAL. URL that the protected resource provides to read about the
   * protected resource's terms of service
   */
  resource_tos_uri: webUriSchema.optional(),
})

export type OAuthProtectedResourceMetadata = z.infer<
  typeof oauthProtectedResourceMetadataSchema
>
