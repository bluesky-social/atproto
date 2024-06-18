import { randomBytes } from 'node:crypto'

import {
  JwtPayload,
  JwtPayloadGetter,
  JwtSignHeader,
  Keyset,
  SignedJwt,
  VerifyOptions,
} from '@atproto/jwk'
import {
  OAuthAuthenticationRequestParameters,
  OAuthAuthorizationDetails,
} from '@atproto/oauth-types'
import { generate as hash } from 'oidc-token-hash'

import { Account } from '../account/account.js'
import { Client } from '../client/client.js'
import { InvalidClientMetadataError } from '../errors/invalid-client-metadata-error.js'
import { dateToEpoch } from '../lib/util/date.js'
import { claimRequested } from '../parameters/claims-requested.js'
import { oidcPayload } from '../parameters/oidc-payload.js'
import { TokenId } from '../token/token-id.js'
import {
  SignedTokenPayload,
  signedTokenPayloadSchema,
} from './signed-token-payload.js'

export type SignPayload = Omit<JwtPayload, 'iss'>

export class Signer {
  constructor(
    public readonly issuer: string,
    public readonly keyset: Keyset,
  ) {}

  async verify<P extends Record<string, unknown> = JwtPayload>(
    token: SignedJwt,
    options?: Omit<VerifyOptions, 'issuer'>,
  ) {
    return this.keyset.verifyJwt<P>(token, {
      ...options,
      issuer: [this.issuer],
    })
  }

  public async sign(
    signHeader: JwtSignHeader,
    payload: SignPayload | JwtPayloadGetter<SignPayload>,
  ): Promise<SignedJwt> {
    return this.keyset.createJwt(signHeader, async (protectedHeader, key) => ({
      ...(typeof payload === 'function'
        ? await payload(protectedHeader, key)
        : payload),
      iss: this.issuer,
    }))
  }

  async accessToken(
    client: Client,
    parameters: OAuthAuthenticationRequestParameters,
    account: Account,
    extra: {
      jti: TokenId
      exp: Date
      iat?: Date
      alg?: string
      cnf?: Record<string, string>
      authorization_details?: OAuthAuthorizationDetails
    },
  ): Promise<SignedJwt> {
    const header: JwtSignHeader = {
      // https://datatracker.ietf.org/doc/html/rfc9068#section-2.1
      alg: extra.alg,
      typ: 'at+jwt',
    }

    const payload: Omit<SignedTokenPayload, 'iss'> = {
      aud: account.aud,
      iat: dateToEpoch(extra?.iat),
      exp: dateToEpoch(extra.exp),
      sub: account.sub,
      jti: extra.jti,
      cnf: extra.cnf,
      // https://datatracker.ietf.org/doc/html/rfc8693#section-4.3
      client_id: client.id,
      scope: parameters.scope || client.metadata.scope,
      authorization_details: extra.authorization_details,
    }

    return this.sign(header, payload)
  }

  async verifyAccessToken(token: SignedJwt) {
    const result = await this.verify<SignedTokenPayload>(token, {
      typ: 'at+jwt',
    })

    // The result is already type casted as an AccessTokenPayload, but we need
    // to actually verify this. That should already be covered by the fact that
    // we don't sign 'at+jwt' tokens without a valid token ID. Let's double
    // check in case another version/implementation was used to generate the
    // token.
    signedTokenPayloadSchema.parse(result.payload)

    return result
  }

  async idToken(
    client: Client,
    params: OAuthAuthenticationRequestParameters,
    account: Account,
    extra: {
      exp: Date
      iat?: Date
      auth_time?: Date
      code?: string
      access_token?: string
    },
  ): Promise<SignedJwt> {
    // This can happen when a client is using password_grant. If a client is
    // using password_grant, it should not set "require_auth_time" to true.
    if (client.metadata.require_auth_time && extra.auth_time == null) {
      throw new InvalidClientMetadataError(
        '"require_auth_time" metadata is not compatible with "password_grant" flow',
      )
    }

    return this.sign(
      {
        alg: client.metadata.id_token_signed_response_alg,
        typ: 'JWT',
      },
      async ({ alg }, key) => ({
        ...oidcPayload(params, account),

        aud: client.id,
        iat: dateToEpoch(extra.iat),
        exp: dateToEpoch(extra.exp),
        sub: account.sub,
        jti: randomBytes(16).toString('hex'),
        scope: params.scope,
        nonce: params.nonce,

        s_hash: params.state //
          ? await hash(params.state, alg, key.crv)
          : undefined,
        c_hash: extra.code //
          ? await hash(extra.code, alg, key.crv)
          : undefined,
        at_hash: extra.access_token //
          ? await hash(extra.access_token, alg, key.crv)
          : undefined,

        // https://openid.net/specs/openid-provider-authentication-policy-extension-1_0.html#rfc.section.5.2
        auth_time:
          client.metadata.require_auth_time ||
          (extra.auth_time != null && params.max_age != null) ||
          claimRequested(params, 'id_token', 'auth_time', extra.auth_time)
            ? dateToEpoch(extra.auth_time!)
            : undefined,
      }),
    )
  }
}
