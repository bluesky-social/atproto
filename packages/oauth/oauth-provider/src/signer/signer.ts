import {
  JwtPayload,
  JwtPayloadGetter,
  JwtSignHeader,
  Keyset,
  SignedJwt,
  VerifyOptions,
} from '@atproto/jwk'
import { EPHEMERAL_SESSION_MAX_AGE } from '../constants.js'
import { dateToEpoch } from '../lib/util/date.js'
import { OmitKey, RequiredKey } from '../lib/util/type.js'
import {
  AccessTokenPayload,
  accessTokenPayloadSchema,
} from './access-token-payload.js'
import { ApiTokenPayload, apiTokenPayloadSchema } from './api-token-payload.js'

export type SignPayload = JwtPayload & { iss?: never }

export { Keyset }
export type { JwtPayloadGetter, JwtSignHeader, SignedJwt, VerifyOptions }

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

  async createAccessToken(
    payload: OmitKey<AccessTokenPayload, 'iss'>,
  ): Promise<SignedJwt> {
    return this.sign(
      {
        // https://datatracker.ietf.org/doc/html/rfc9068#section-2.1
        alg: undefined,
        typ: 'at+jwt',
      },
      payload,
    )
  }

  async verifyAccessToken<C extends string = never>(
    token: SignedJwt,
    options?: Omit<VerifyOptions<C>, 'issuer' | 'typ'>,
  ) {
    const result = await this.verify<C>(token, { ...options, typ: 'at+jwt' })
    return {
      protectedHeader: result.protectedHeader,
      payload: accessTokenPayloadSchema.parse(result.payload) as RequiredKey<
        AccessTokenPayload,
        C
      >,
    }
  }

  async createEphemeralToken(
    payload: OmitKey<ApiTokenPayload, 'iss' | 'aud' | 'iat'>,
  ) {
    return this.sign(
      {
        alg: undefined,
        typ: 'at+jwt',
      },
      {
        ...payload,
        aud: `oauth-provider-api@${this.issuer}`,
        iat: dateToEpoch(),
      },
    )
  }

  async verifyEphemeralToken<C extends string = never>(
    token: SignedJwt,
    options?: Omit<VerifyOptions<C>, 'issuer' | 'audience' | 'typ'>,
  ) {
    const result = await this.verify<C>(token, {
      ...options,
      maxTokenAge: options?.maxTokenAge ?? EPHEMERAL_SESSION_MAX_AGE / 1e3,
      audience: `oauth-provider-api@${this.issuer}`,
      typ: 'at+jwt',
    })
    return {
      protectedHeader: result.protectedHeader,
      payload: apiTokenPayloadSchema.parse(result.payload) as RequiredKey<
        ApiTokenPayload,
        C
      >,
    }
  }
}
