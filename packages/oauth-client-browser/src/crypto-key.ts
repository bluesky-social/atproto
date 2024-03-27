import {
  Jwt,
  JwtHeader,
  JwtPayload,
  Key,
  VerifyOptions,
  VerifyPayload,
  VerifyResult,
} from '@atproto/jwk'

export class CryptoKey extends Key {
  createJwt(header: JwtHeader, payload: JwtPayload): Promise<Jwt> {
    throw new Error('Not implemented (createJwt)')
  }

  /**
   * Verify the signature, headers and payload of a JWT
   */
  verifyJwt<P extends VerifyPayload = JwtPayload, C extends string = string>(
    token: Jwt,
    options?: VerifyOptions<C>,
  ): Promise<VerifyResult<P, C>> {
    throw new Error('Not implemented (verifyJwt)')
  }
}
