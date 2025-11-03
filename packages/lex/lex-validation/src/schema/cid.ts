import { CID, parseLexLink } from '@atproto/lex-core'
import {
  ValidationContext,
  ValidationResult,
  Validator,
} from '../validation.js'

export class CidSchema extends Validator<CID> {
  readonly lexiconType = 'cid-link' as const

  override validateInContext(
    input: unknown,
    ctx: ValidationContext,
  ): ValidationResult<CID> {
    const cid = CID.asCID(input)
    if (cid) return ctx.success(cid)

    const parsed = parseLexLink(input)
    if (parsed) return ctx.success(parsed)

    return ctx.issueInvalidType(input, 'cid')
  }
}
