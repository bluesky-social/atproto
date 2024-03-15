import { Jwks } from '@atproto/jwk'
import {
  JWTPayload,
  JWTVerifyGetKey,
  JWTVerifyOptions,
  JWTVerifyResult,
  KeyLike,
  ResolvedKey,
  UnsecuredJWT,
  UnsecuredResult,
  createLocalJWKSet,
  createRemoteJWKSet,
  jwtVerify,
} from 'jose'
import { JOSEError } from 'jose/errors'

import { CLIENT_ASSERTION_MAX_AGE, JAR_MAX_AGE } from '../constants.js'
import { InvalidClientMetadataError } from '../errors/invalid-client-metadata-error.js'
import { InvalidRequestError } from '../errors/invalid-request-error.js'
import { ClientAuth, authJwkThumbprint } from './client-auth.js'
import {
  CLIENT_ASSERTION_TYPE_JWT_BEARER,
  ClientIdentification,
} from './client-credentials.js'
import { ClientId } from './client-id.js'
import { ClientMetadata } from './client-metadata.js'

type AuthEndpoint = 'token' | 'introspection' | 'revocation'

export class Client {
  /**
   * @see {@link https://www.iana.org/assignments/oauth-parameters/oauth-parameters.xhtml#token-endpoint-auth-method}
   */
  static readonly AUTH_METHODS_SUPPORTED = ['none', 'private_key_jwt'] as const

  private readonly keyGetter: JWTVerifyGetKey

  constructor(
    public readonly id: ClientId,
    public readonly metadata: ClientMetadata,
    jwks: undefined | Jwks = metadata.jwks,
  ) {
    // If the remote JWKS content is provided, we don't need to fetch it again.
    this.keyGetter =
      jwks || !metadata.jwks_uri
        ? // @ts-expect-error https://github.com/panva/jose/issues/634
          createLocalJWKSet(jwks || { keys: [] })
        : createRemoteJWKSet(new URL(metadata.jwks_uri), {})
  }

  async decodeRequestObject(jar: string) {
    switch (this.metadata.request_object_signing_alg) {
      case 'none':
        return this.jwtVerifyUnsecured(jar, {
          maxTokenAge: JAR_MAX_AGE / 1000,
        })
      case undefined:
        // https://openid.net/specs/openid-connect-registration-1_0.html#rfc.section.2
        // > The default, if omitted, is that any algorithm supported by the OP
        // > and the RP MAY be used.
        return this.jwtVerify(jar, {
          maxTokenAge: JAR_MAX_AGE / 1000,
        })
      default:
        return this.jwtVerify(jar, {
          maxTokenAge: JAR_MAX_AGE / 1000,
          algorithms: [this.metadata.request_object_signing_alg],
        })
    }
  }

  async jwtVerifyUnsecured<PayloadType = JWTPayload>(
    token: string,
    options?: Omit<JWTVerifyOptions, 'issuer'>,
  ): Promise<UnsecuredResult<PayloadType>> {
    return UnsecuredJWT.decode(token, {
      ...options,
      issuer: this.id,
    })
  }

  async jwtVerify<PayloadType = JWTPayload>(
    token: string,
    options?: Omit<JWTVerifyOptions, 'issuer'>,
  ): Promise<JWTVerifyResult<PayloadType> & ResolvedKey<KeyLike>> {
    return jwtVerify<PayloadType>(token, this.keyGetter, {
      ...options,
      issuer: this.id,
    })
  }

  getAuthMethod(endpoint: AuthEndpoint) {
    return (
      this.metadata[`${endpoint}_endpoint_auth_method`] ||
      this.metadata[`token_endpoint_auth_method`]
    )
  }

  /**
   * @see {@link https://datatracker.ietf.org/doc/html/rfc6749#section-2.3.1}
   * @see {@link https://datatracker.ietf.org/doc/html/draft-ietf-oauth-jwt-bearer-11#section-3}
   * @see {@link https://www.iana.org/assignments/oauth-parameters/oauth-parameters.xhtml#token-endpoint-auth-method}
   */
  async verifyCredentials(
    input: ClientIdentification,
    endpoint: AuthEndpoint,
    checks: {
      audience: string
    },
  ): Promise<{
    clientAuth: ClientAuth
    // for replay protection
    nonce?: string
  }> {
    const method = this.getAuthMethod(endpoint)

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
        }).catch((err) => {
          if (err instanceof JOSEError) {
            const msg = `Invalid "client_assertion": ${err.message}`
            throw new InvalidRequestError(msg, err)
          }

          throw err
        })

        if (!result.protectedHeader.kid) {
          throw new InvalidRequestError(`"kid" required in client_assertion`)
        }

        if (!result.payload.jti) {
          throw new InvalidRequestError(`"jti" required in client_assertion`)
        }

        const clientAuth: ClientAuth = {
          method: CLIENT_ASSERTION_TYPE_JWT_BEARER,
          jkt: await authJwkThumbprint(result.key),
          alg: result.protectedHeader.alg,
          kid: result.protectedHeader.kid,
        }

        return { clientAuth, nonce: result.payload.jti }
      }

      throw new InvalidRequestError(
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
      `Unsupported ${endpoint}_endpoint_auth_method "${method}"`,
    )
  }

  /**
   * Ensures that a {@link ClientAuth} generated in the past is still valid wrt
   * the current client metadata & jwks. This is used to invalidate tokens when
   * the client stops advertising the key that it used to authenticate itself
   * during the initial token request.
   */
  async validateClientAuth(clientAuth: ClientAuth): Promise<boolean> {
    if (clientAuth.method === 'none') {
      return this.getAuthMethod('token') === 'none'
    }

    if (clientAuth.method === CLIENT_ASSERTION_TYPE_JWT_BEARER) {
      if (this.getAuthMethod('token') !== 'private_key_jwt') {
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
}
