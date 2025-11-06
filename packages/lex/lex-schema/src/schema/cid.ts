import { CID, isPlainObject, parseLexLink } from '@atproto/lex-data'
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

    // Try coalescing from a JSON { "$link": string } object
    if (isPlainObject(input)) {
      try {
        const cid = parseLexLink(input)
        return ctx.success(cid)
      } catch {
        // Not a (valid) CID link object representation
      }
    }

    return ctx.issueInvalidType(input, 'cid')
  }
}
