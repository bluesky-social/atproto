import { ERR_JWT_INVALID, JwtVerifyError } from './errors.js'
import {
  JwtHeader,
  JwtPayload,
  jwtHeaderSchema,
  jwtPayloadSchema,
} from './jwt.js'
import { parseB64uJson } from './util.js'

export function unsafeDecodeJwt(jwt: string): {
  header: JwtHeader
  payload: JwtPayload
} {
  const { 0: headerEnc, 1: payloadEnc, length } = jwt.split('.')
  if (length > 3 || length < 2) {
    throw new JwtVerifyError(undefined, ERR_JWT_INVALID)
  }

  const header = jwtHeaderSchema.parse(parseB64uJson(headerEnc!))
  if (length === 2 && header?.alg !== 'none') {
    throw new JwtVerifyError(undefined, ERR_JWT_INVALID)
  }

  const payload = jwtPayloadSchema.parse(parseB64uJson(payloadEnc!))

  return { header, payload }
}
