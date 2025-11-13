import { CID, isCid } from '@atproto/lex-data'
import {
  ValidationContext,
  ValidationResult,
  Validator,
} from '../validation.js'

export { CID }

export type CidSchemaOptions = {
  strict?: boolean
}

export class CidSchema extends Validator<CID> {
  readonly lexiconType = 'cid-link' as const

  constructor(readonly options: CidSchemaOptions = {}) {
    super()
  }

  override validateInContext(
    input: unknown,
    ctx: ValidationContext,
  ): ValidationResult<CID> {
    if (!isCid(input, this.options)) {
      return ctx.issueInvalidType(input, 'cid')
    }

    return ctx.success(input)
  }
}
