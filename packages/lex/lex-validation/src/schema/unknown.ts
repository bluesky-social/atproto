import { Json, jsonToLex } from '@atproto/lex-core'
import { ValidationContext, ValidationResult, Validator } from '../validation'

export class UnknownSchema extends Validator<unknown> {
  readonly lexiconType = 'unknown' as const

  override validateInContext(
    input: unknown,
    ctx: ValidationContext,
  ): ValidationResult<unknown> {
    // By convention, the output of schemas is always coerced into Lex format.
    return ctx.success(jsonToLex(input as Json))
  }
}
