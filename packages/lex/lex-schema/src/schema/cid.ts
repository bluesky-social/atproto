import { Cid, isCid } from '@atproto/lex-data'
import { Schema, ValidationResult, ValidatorContext } from '../validation.js'

export type { Cid }

export type CidSchemaOptions = {
  strict?: boolean
}

export class CidSchema extends Schema<Cid> {
  readonly lexiconType = 'cid-link' as const

  constructor(readonly options: CidSchemaOptions = {}) {
    super()
  }

  validateInContext(
    input: unknown,
    ctx: ValidatorContext,
  ): ValidationResult<Cid> {
    if (!isCid(input, this.options)) {
      return ctx.issueInvalidType(input, 'cid')
    }

    return ctx.success(input)
  }
}
