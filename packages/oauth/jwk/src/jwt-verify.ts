import type { JwtHeader, JwtPayload } from './jwt.js'
import type { RequiredKey } from './util.js'

export type VerifyOptions<C extends string = never> = {
  audience?: string | readonly string[]
  /** in seconds */
  clockTolerance?: number
  issuer?: string | readonly string[]
  /** in seconds */
  maxTokenAge?: number
  subject?: string
  typ?: string
  currentDate?: Date
  requiredClaims?: readonly C[]
}

export type VerifyResult<C extends string = never> = {
  payload: RequiredKey<JwtPayload, C>
  protectedHeader: JwtHeader
}
