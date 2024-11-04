import { Jwks } from '@atproto/jwk'
import {
  CLIENT_ASSERTION_TYPE_JWT_BEARER,
  OAuthAuthorizationRequestParameters,
  OAuthClientCredentials,
  OAuthClientMetadata,
} from '@atproto/oauth-types'
import {
  UnsecuredJWT,
  createLocalJWKSet,
  createRemoteJWKSet,
  errors,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyGetKey,
  type JWTVerifyOptions,
  type JWTVerifyResult,
  type KeyLike,
  type ResolvedKey,
  type UnsecuredResult,
} from 'jose'

import { CLIENT_ASSERTION_MAX_AGE, JAR_MAX_AGE } from '../constants.js'
import { InvalidAuthorizationDetailsError } from '../errors/invalid-authorization-details-error.js'
import { InvalidClientError } from '../errors/invalid-client-error.js'
import { InvalidClientMetadataError } from '../errors/invalid-client-metadata-error.js'
import { InvalidParametersError } from '../errors/invalid-parameters-error.js'
import { InvalidRequestError } from '../errors/invalid-request-error.js'
import { InvalidScopeError } from '../errors/invalid-scope-error.js'
import { compareRedirectUri } from '../lib/util/redirect-uri.js'
import { ClientAuth, authJwkThumbprint } from './client-auth.js'
import { ClientId } from './client-id.js'
import { ClientInfo } from './client-info.js'

const { JOSEError } = errors

export class Client {
  /**
   * @see {@link https://www.iana.org/assignments/oauth-parameters/oauth-parameters.xhtml#token-endpoint-auth-method}
   */
  static readonly AUTH_METHODS_SUPPORTED = ['none', 'private_key_jwt'] as const

  private readonly keyGetter: JWTVerifyGetKey

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

  public async decodeRequestObject(jar: string) {
    try {
      switch (this.metadata.request_object_signing_alg) {
        case 'none':
          return await this.jwtVerifyUnsecured(jar, {
            maxTokenAge: JAR_MAX_AGE / 1000,
          })
        case undefined:
          // https://openid.net/specs/openid-connect-registration-1_0.html#rfc.section.2
          // > The default, if omitted, is that any algorithm supported by the OP
          // > and the RP MAY be used.
          return await this.jwtVerify(jar, {
            maxTokenAge: JAR_MAX_AGE / 1000,
          })
        default:
          return await this.jwtVerify(jar, {
            maxTokenAge: JAR_MAX_AGE / 1000,
            algorithms: [this.metadata.request_object_signing_alg],
          })
      }
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
    options?: Omit<JWTVerifyOptions, 'issuer'>,
  ): Promise<UnsecuredResult<PayloadType>> {
    return UnsecuredJWT.decode(token, {
      ...options,
      issuer: this.id,
    })
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
  public async verifyCredentials(
    input: OAuthClientCredentials,
    checks: {
      audience: string
    },
  ): Promise<{
    clientAuth: ClientAuth
    // for replay protection
    nonce?: string
  }> {
    const method = this.metadata[`token_endpoint_auth_method`]

    if (method === 'none') {
      const clientAuth: ClientAuth = { method: 'none' }
      return { clientAuth }
    }

    if (method === 'private_key_jwt') {
      if (!('client_assertion_type' in input) || !input.client_assertion_type) {
        throw new InvalidRequestError(
          `client_assertion_type required for "${method}"`,
        )
      } else if (!input.client_assertion) {
        throw new InvalidRequestError(
          `client_assertion required for "${method}"`,
        )
      }

      if (input.client_assertion_type === CLIENT_ASSERTION_TYPE_JWT_BEARER) {
        const result = await this.jwtVerify<{
          jti: string
        }>(input.client_assertion, {
          audience: checks.audience,
          subject: this.id,
          maxTokenAge: CLIENT_ASSERTION_MAX_AGE / 1000,
          requiredClaims: ['jti'],
        }).catch((err) => {
          if (err instanceof JOSEError) {
            const msg = `Validation of "client_assertion" failed: ${err.message}`
            throw new InvalidClientError(msg, err)
          }

          throw err
        })

        if (!result.protectedHeader.kid) {
          throw new InvalidClientError(`"kid" required in client_assertion`)
        }

        const clientAuth: ClientAuth = {
          method: CLIENT_ASSERTION_TYPE_JWT_BEARER,
          jkt: await authJwkThumbprint(result.key),
          alg: result.protectedHeader.alg,
          kid: result.protectedHeader.kid,
        }

        return { clientAuth, nonce: result.payload.jti }
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
   * Ensures that a {@link ClientAuth} generated in the past is still valid wrt
   * the current client metadata & jwks. This is used to invalidate tokens when
   * the client stops advertising the key that it used to authenticate itself
   * during the initial token request.
   */
  public async validateClientAuth(clientAuth: ClientAuth): Promise<boolean> {
    if (clientAuth.method === 'none') {
      return this.metadata[`token_endpoint_auth_method`] === 'none'
    }

    if (clientAuth.method === CLIENT_ASSERTION_TYPE_JWT_BEARER) {
      if (this.metadata[`token_endpoint_auth_method`] !== 'private_key_jwt') {
        return false
      }
      try {
        const key = await this.keyGetter(
          {
            kid: clientAuth.kid,
            alg: clientAuth.alg,
          },
          { payload: '', signature: '' },
        )
        const jtk = await authJwkThumbprint(key)

        return jtk === clientAuth.jkt
      } catch (e) {
        return false
      }
    }

    // @ts-expect-error
    throw new Error(`Invalid method "${clientAuth.method}"`)
  }

  /**
   * Validates the request parameters against the client metadata.
   */
  public validateRequest(
    parameters: Readonly<OAuthAuthorizationRequestParameters>,
  ): Readonly<OAuthAuthorizationRequestParameters> {
    if (parameters.client_id !== this.id) {
      throw new InvalidParametersError(
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
      throw new InvalidParametersError(
        parameters,
        `Invalid response_type "${parameters.response_type}" requested by the client`,
      )
    }

    if (parameters.response_type.includes('code')) {
      if (!this.metadata.grant_types.includes('authorization_code')) {
        throw new InvalidParametersError(
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
        throw new InvalidParametersError(
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
        throw new InvalidParametersError(parameters, 'redirect_uri is required')
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

  get defaultRedirectUri(): string | undefined {
    const { redirect_uris } = this.metadata
    return redirect_uris.length === 1 ? redirect_uris[0] : undefined
  }
}
