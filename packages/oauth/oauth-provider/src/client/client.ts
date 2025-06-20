import {
  JWTClaimVerificationOptions,
  type JWTHeaderParameters,
  type JWTPayload,
  type JWTVerifyOptions,
  type JWTVerifyResult,
  type KeyLike,
  type ResolvedKey,
  UnsecuredJWT,
  type UnsecuredResult,
  calculateJwkThumbprint,
  createLocalJWKSet,
  createRemoteJWKSet,
  errors,
  exportJWK,
  jwtVerify,
} from 'jose'
import { Jwks, SignedJwt, UnsignedJwt } from '@atproto/jwk'
import {
  CLIENT_ASSERTION_TYPE_JWT_BEARER,
  OAuthAuthorizationRequestParameters,
  OAuthClientCredentials,
  OAuthClientMetadata,
  OAuthRedirectUri,
} from '@atproto/oauth-types'
import { CLIENT_ASSERTION_MAX_AGE, JAR_MAX_AGE } from '../constants.js'
import { AuthorizationError } from '../errors/authorization-error.js'
import { InvalidAuthorizationDetailsError } from '../errors/invalid-authorization-details-error.js'
import { InvalidClientError } from '../errors/invalid-client-error.js'
import { InvalidClientMetadataError } from '../errors/invalid-client-metadata-error.js'
import { InvalidRequestError } from '../errors/invalid-request-error.js'
import { InvalidScopeError } from '../errors/invalid-scope-error.js'
import { asArray } from '../lib/util/cast.js'
import { compareRedirectUri } from '../lib/util/redirect-uri.js'
import { Awaitable } from '../lib/util/type.js'
import { ClientAuth } from './client-auth.js'
import { ClientId } from './client-id.js'
import { ClientInfo } from './client-info.js'

const { JOSEError } = errors

export class Client {
  /**
   * @see {@link https://www.iana.org/assignments/oauth-parameters/oauth-parameters.xhtml#token-endpoint-auth-method}
   */
  static readonly AUTH_METHODS_SUPPORTED = ['none', 'private_key_jwt'] as const

  private readonly keyGetter: (
    protectedHeader: JWTHeaderParameters,
  ) => Awaitable<KeyLike | Uint8Array>

  constructor(
    public readonly id: ClientId,
    public readonly metadata: OAuthClientMetadata,
    public readonly jwks: undefined | Jwks = metadata.jwks,
    public readonly info: ClientInfo,
  ) {
    // If the remote JWKS content is provided, we don't need to fetch it again.
    this.keyGetter =
      jwks || !metadata.jwks_uri
        ? createLocalJWKSet(jwks || { keys: [] })
        : createRemoteJWKSet(new URL(metadata.jwks_uri), {})
  }

  /**
   * @see {@link https://www.rfc-editor.org/rfc/rfc9101.html#name-request-object-2}
   */
  public async decodeRequestObject(
    jar: SignedJwt | UnsignedJwt,
    audience: string,
  ) {
    // https://www.rfc-editor.org/rfc/rfc9101.html#name-request-object-2
    // > If signed, the Authorization Request Object SHOULD contain the Claims
    // > iss (issuer) and aud (audience) as members with their semantics being
    // > the same as defined in the JWT [RFC7519] specification. The value of
    // > aud should be the value of the authorization server (AS) issuer, as
    // > defined in RFC 8414 [RFC8414].
    try {
      // We need to special case the "none" algorithm, as the validation method
      // is different for signed and unsigned JWTs.
      if (this.metadata.request_object_signing_alg === 'none') {
        return await this.jwtVerifyUnsecured(jar, {
          audience,
          maxTokenAge: JAR_MAX_AGE / 1e3,
          allowMissingAudience: true,
          allowMissingIssuer: true,
        })
      }

      return await this.jwtVerify(jar, {
        audience,
        maxTokenAge: JAR_MAX_AGE / 1e3,
        algorithms: this.metadata.request_object_signing_alg
          ? [this.metadata.request_object_signing_alg]
          : // https://openid.net/specs/openid-connect-registration-1_0.html#rfc.section.2
            //
            // > The default, if omitted, is that any algorithm supported by the OP
            // > and the RP MAY be used.
            undefined,
      })
    } catch (err) {
      const message =
        err instanceof JOSEError
          ? `Invalid "request" object: ${err.message}`
          : `Invalid "request" object`

      throw new InvalidRequestError(message, err)
    }
  }

  protected async jwtVerifyUnsecured<PayloadType = JWTPayload>(
    token: string,
    {
      audience,
      allowMissingAudience = false,
      allowMissingIssuer = false,
      ...options
    }: Omit<JWTClaimVerificationOptions, 'issuer'> & {
      allowMissingIssuer?: boolean
      allowMissingAudience?: boolean
    } = {},
  ): Promise<UnsecuredResult<PayloadType>> {
    // jose does not support `allowMissingAudience` and `allowMissingIssuer`
    // options, so we need to handle audience and issuer checks manually (see
    // bellow).

    const result = UnsecuredJWT.decode<PayloadType>(token, options)

    if (!allowMissingIssuer || result.payload.iss != null) {
      if (result.payload.iss !== this.id) {
        throw new JOSEError(`Invalid "iss" claim "${result.payload.iss}"`)
      }
    }

    if (!allowMissingAudience || result.payload.aud != null) {
      if (audience != null) {
        const payloadAud = asArray(result.payload.aud)
        if (!asArray(audience).some((aud) => payloadAud.includes(aud))) {
          throw new JOSEError(`Invalid "aud" claim "${result.payload.aud}"`)
        }
      }
    }

    return result
  }

  protected async jwtVerify<PayloadType = JWTPayload>(
    token: string,
    options?: Omit<JWTVerifyOptions, 'issuer'>,
  ): Promise<JWTVerifyResult<PayloadType> & ResolvedKey<KeyLike>> {
    return jwtVerify<PayloadType>(token, this.keyGetter, {
      ...options,
      issuer: this.id,
    })
  }

  /**
   * @see {@link https://datatracker.ietf.org/doc/html/rfc6749#section-2.3.1}
   * @see {@link https://datatracker.ietf.org/doc/html/rfc7523#section-3}
   * @see {@link https://www.iana.org/assignments/oauth-parameters/oauth-parameters.xhtml#token-endpoint-auth-method}
   */
  public async authenticate(
    input: OAuthClientCredentials,
    checks: {
      authorizationServerIdentifier: string
    },
  ): Promise<ClientAuth> {
    const method = this.metadata.token_endpoint_auth_method

    if (method === 'none') {
      return { method: 'none' }
    }

    if (method === 'private_key_jwt') {
      if (!('client_assertion' in input)) {
        throw new InvalidRequestError(
          `client authentication method "${method}" required a "client_assertion"`,
        )
      }

      if (input.client_assertion_type === CLIENT_ASSERTION_TYPE_JWT_BEARER) {
        // https://www.rfc-editor.org/rfc/rfc7523.html#section-3

        const result = await this.jwtVerify<{
          jti: string
          exp?: number
        }>(input.client_assertion, {
          // > 1. The JWT MUST contain an "iss" (issuer) claim that contains a
          // >    unique identifier for the entity that issued the JWT.
          //
          // The "issuer" is already checked by jwtVerify()

          // > 2. The JWT MUST contain a "sub" (subject) claim identifying the
          // >    principal that is the subject of the JWT. Two cases need to be
          // >    differentiated: [...] For client authentication, the subject
          // >    MUST be the "client_id" of the OAuth client.
          subject: this.id,

          // > 3. The JWT MUST contain an "aud" (audience) claim containing a
          // >    value that identifies the authorization server as an intended
          // >    audience. The token endpoint URL of the authorization server
          // >    MAY be used as a value for an "aud" element to identify the
          // >    authorization server as an intended audience of the JWT.
          audience: checks.authorizationServerIdentifier,

          requiredClaims: [
            // > 4. The JWT MUST contain an "exp" (expiration time) claim that
            // >    limits the time window during which the JWT can be used.
            //
            // @TODO The presence of "exp" didn't use to be enforced by this
            // implementation (or provided by the oauth-client). This is mostly
            // fine because "iat" *is* required, but this makes this
            // implementation non compliant with RFC7523. We can't just make it
            // required as it might break existing clients.

            // 'exp',

            // > 7. The JWT MAY contain a "jti" (JWT ID) claim that provides a
            // >    unique identifier for the token. The authorization server
            // >    MAY ensure that JWTs are not replayed by maintaining the set
            // >    of used "jti" values for the length of time for which the
            // >    JWT would be considered valid based on the applicable "exp"
            // >    instant.
            'jti',
          ],

          // > 5. The JWT MAY contain an "nbf" (not before) claim that
          // >    identifies the time before which the token MUST NOT be
          // >    accepted for processing.
          //
          // This is already enforced by jose

          // > 6. The JWT MAY contain an "iat" (issued at) claim that identifies
          // >    the time at which the JWT was issued.  Note that the
          // >    authorization server may reject JWTs with an "iat" claim value
          // >    that is unreasonably far in the past.
          maxTokenAge: CLIENT_ASSERTION_MAX_AGE / 1000,
        }).catch((err) => {
          const msg =
            err instanceof JOSEError
              ? `Validation of "client_assertion" failed: ${err.message}`
              : `Unable to verify "client_assertion" JWT`

          throw new InvalidClientError(msg, err)
        })

        if (!result.protectedHeader.kid) {
          throw new InvalidClientError(`"kid" required in client_assertion`)
        }

        return {
          method: 'private_key_jwt',
          jti: result.payload.jti,
          exp: result.payload.exp,
          jkt: await authJwkThumbprint(result.key),
          alg: result.protectedHeader.alg,
          kid: result.protectedHeader.kid,
        }
      }

      throw new InvalidClientError(
        `Unsupported client_assertion_type "${input.client_assertion_type}"`,
      )
    }

    // @ts-expect-error Ensure to keep Client.AUTH_METHODS_SUPPORTED in sync
    // with the implementation of this function.
    if (Client.AUTH_METHODS_SUPPORTED.includes(method)) {
      throw new Error(
        `verifyCredentials() should implement all of ${[
          Client.AUTH_METHODS_SUPPORTED,
        ]}`,
      )
    }

    throw new InvalidClientMetadataError(
      `Unsupported token_endpoint_auth_method "${method}"`,
    )
  }

  /**
   * Validates the request parameters against the client metadata.
   */
  public validateRequest(
    parameters: Readonly<OAuthAuthorizationRequestParameters>,
  ): Readonly<OAuthAuthorizationRequestParameters> {
    if (parameters.client_id !== this.id) {
      throw new AuthorizationError(
        parameters,
        'The "client_id" parameter field does not match the value used to authenticate the client',
      )
    }

    if (parameters.scope !== undefined) {
      // Any scope requested by the client must be registered in the client
      // metadata.
      const declaredScopes = this.metadata.scope?.split(' ')

      if (!declaredScopes) {
        throw new InvalidScopeError(
          parameters,
          'Client has no declared scopes in its metadata',
        )
      }

      for (const scope of parameters.scope.split(' ')) {
        if (!declaredScopes.includes(scope)) {
          throw new InvalidScopeError(
            parameters,
            `Scope "${scope}" is not declared in the client metadata`,
          )
        }
      }
    }

    if (!this.metadata.response_types.includes(parameters.response_type)) {
      throw new AuthorizationError(
        parameters,
        `Invalid response_type "${parameters.response_type}" requested by the client`,
      )
    }

    if (parameters.response_type.includes('code')) {
      if (!this.metadata.grant_types.includes('authorization_code')) {
        throw new AuthorizationError(
          parameters,
          `This client is not allowed to use the "authorization_code" grant type`,
        )
      }
    }

    const { redirect_uri } = parameters
    if (redirect_uri) {
      if (
        !this.metadata.redirect_uris.some((uri) =>
          compareRedirectUri(uri, redirect_uri),
        )
      ) {
        throw new AuthorizationError(
          parameters,
          `Invalid redirect_uri ${redirect_uri}`,
        )
      }
    } else {
      const { defaultRedirectUri } = this
      if (defaultRedirectUri) {
        parameters = { ...parameters, redirect_uri: defaultRedirectUri }
      } else {
        // https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-10#authorization-request
        //
        // > "redirect_uri": OPTIONAL if only one redirect URI is registered for
        // > this client. REQUIRED if multiple redirect URIs are registered for this
        // > client.
        throw new AuthorizationError(parameters, 'redirect_uri is required')
      }
    }

    if (parameters.authorization_details) {
      const { authorization_details_types } = this.metadata
      if (!authorization_details_types) {
        throw new InvalidAuthorizationDetailsError(
          parameters,
          'Client Metadata does not declare any "authorization_details"',
        )
      }

      for (const detail of parameters.authorization_details) {
        if (!authorization_details_types?.includes(detail.type)) {
          throw new InvalidAuthorizationDetailsError(
            parameters,
            `Client Metadata does not declare any "authorization_details" of type "${detail.type}"`,
          )
        }
      }
    }

    return parameters
  }

  get defaultRedirectUri(): OAuthRedirectUri | undefined {
    const { redirect_uris } = this.metadata
    return redirect_uris.length === 1 ? redirect_uris[0] : undefined
  }
}

export async function authJwkThumbprint(
  key: Uint8Array | KeyLike,
): Promise<string> {
  try {
    return await calculateJwkThumbprint(await exportJWK(key), 'sha512')
  } catch (err) {
    throw new InvalidClientError('Unable to compute JWK thumbprint', err)
  }
}
