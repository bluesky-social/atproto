import {
  JwtPayload,
  JwtPayloadGetter,
  JwtSignHeader,
  Keyset,
  SignedJwt,
  VerifyOptions,
} from '@atproto/jwk'
import {
  OAuthAuthorizationDetails,
  OAuthAuthorizationRequestParameters,
} from '@atproto/oauth-types'
import { Client } from '../client/client.js'
import { dateToEpoch } from '../lib/util/date.js'
import { TokenId } from '../token/token-id.js'
import {
  SignedTokenPayload,
  signedTokenPayloadSchema,
} from './signed-token-payload.js'

export type SignPayload = JwtPayload & { iss?: never }

export class Signer {
  constructor(
    public readonly issuer: string,
    public readonly keyset: Keyset,
  ) {}

  async verify<C extends string = never>(
    token: SignedJwt,
    options?: Omit<VerifyOptions<C>, 'issuer'>,
  ) {
    return this.keyset.verifyJwt<C>(token, {
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
    parameters: OAuthAuthorizationRequestParameters,
    options: {
      aud: string | [string, ...string[]]
      sub: string
      jti: TokenId
      exp: Date
      iat?: Date
      alg?: string
      cnf?: Record<string, string>
      authorization_details?: OAuthAuthorizationDetails
    },
  ): Promise<SignedJwt> {
    return this.sign(
      {
        // https://datatracker.ietf.org/doc/html/rfc9068#section-2.1
        alg: options.alg,
        typ: 'at+jwt',
      },
      {
        aud: options.aud,
        iat: dateToEpoch(options?.iat),
        exp: dateToEpoch(options.exp),
        sub: options.sub,
        jti: options.jti,
        cnf: options.cnf,
        // https://datatracker.ietf.org/doc/html/rfc8693#section-4.3
        client_id: client.id,
        scope: parameters.scope,
        authorization_details: options.authorization_details,
      },
    )
  }

  async verifyAccessToken<C extends string = never>(
    token: SignedJwt,
    options?: Omit<VerifyOptions<C>, 'issuer' | 'typ'>,
  ) {
    const result = await this.verify<C>(token, { ...options, typ: 'at+jwt' })
    type Payload = typeof result.payload // RequiredKey<JwtPayload, C>
    return {
      protectedHeader: result.protectedHeader,
      payload: signedTokenPayloadSchema.parse(result.payload) as Payload &
        SignedTokenPayload,
    }
  }
}
