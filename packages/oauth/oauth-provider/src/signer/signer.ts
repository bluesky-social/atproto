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

import { Account } from '../account/account.js'
import { Client } from '../client/client.js'
import { dateToEpoch } from '../lib/util/date.js'
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
}
