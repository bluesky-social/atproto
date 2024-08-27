import { Jwks } from '@atproto/jwk'
import {
  CLIENT_ASSERTION_TYPE_JWT_BEARER,
  OAuthClientIdentification,
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
import { InvalidClientError } from '../errors/invalid-client-error.js'
import { InvalidClientMetadataError } from '../errors/invalid-client-metadata-error.js'
import { InvalidRequestError } from '../errors/invalid-request-error.js'
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
   * @see {@link https://datatracker.ietf.org/doc/html/draft-ietf-oauth-jwt-bearer-11#section-3}
   * @see {@link https://www.iana.org/assignments/oauth-parameters/oauth-parameters.xhtml#token-endpoint-auth-method}
   */
  public async verifyCredentials(
    input: OAuthClientIdentification,
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
}
