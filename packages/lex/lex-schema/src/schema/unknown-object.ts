import { LexMap, isLexMap } from '@atproto/lex-data'
import { ValidationContext, ValidationResult, Validator } from '../validation'

export type UnknownObjectOutput = LexMap

export class UnknownObjectSchema extends Validator<UnknownObjectOutput> {
  readonly lexiconType = 'unknown' as const

  override validateInContext(
    input: unknown,
    ctx: ValidationContext,
  ): ValidationResult<UnknownObjectOutput> {
    if (isLexMap(input)) {
      return ctx.success(input)
    }

    return ctx.issueInvalidType(input, 'unknown')
  }
}
