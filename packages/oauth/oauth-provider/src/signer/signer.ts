import {
  JwtPayload,
  JwtPayloadGetter,
  JwtSignHeader,
  Keyset,
  RequiredKey,
  SignedJwt,
  VerifyOptions,
} from '@atproto/jwk'
import { OmitKey } from '../lib/util/type.js'
import {
  SignedTokenPayload,
  signedTokenPayloadSchema,
} from './signed-token-payload.js'

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
    payload: OmitKey<SignedTokenPayload, 'iss'>,
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
      payload: signedTokenPayloadSchema.parse(result.payload) as RequiredKey<
        SignedTokenPayload,
        C
      >,
    }
  }
}
