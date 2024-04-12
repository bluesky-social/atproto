import { JwtHeader, JwtPayload } from './jwt.js'
import { RequiredKey } from './util.js'

export type VerifyOptions<C extends string = string> = {
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

export type VerifyPayload = Record<string, unknown>

export type VerifyResult<P extends VerifyPayload, C extends string> = {
  payload: RequiredKey<P & JwtPayload, C>
  protectedHeader: JwtHeader
}
