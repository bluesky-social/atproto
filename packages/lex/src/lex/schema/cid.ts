import { CID } from 'multiformats/cid'
import {
  ValidationContext,
  ValidationResult,
  Validator,
  parseIpldLink,
} from '../core.js'

export class CidSchema extends Validator<CID> {
  protected override validateInContext(
    input: unknown,
    ctx: ValidationContext,
  ): ValidationResult<CID> {
    const cid = CID.asCID(input)
    if (cid) return ctx.success(cid)

    const parsed = parseIpldLink(input)
    if (parsed) return ctx.success(parsed)

    return ctx.issueInvalidType(input, 'cid')
  }
}
