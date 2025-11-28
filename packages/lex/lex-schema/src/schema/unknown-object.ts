import { LexMap, isLexMap } from '@atproto/lex-data'
import { Schema, ValidationResult, ValidatorContext } from '../validation'

export type { LexMap }
export type UnknownObjectOutput = LexMap

export class UnknownObjectSchema extends Schema<UnknownObjectOutput> {
  readonly lexiconType = 'unknown' as const

  validateInContext(
    input: unknown,
    ctx: ValidatorContext,
  ): ValidationResult<UnknownObjectOutput> {
    if (isLexMap(input)) {
      return ctx.success(input)
    }

    return ctx.issueInvalidType(input, 'unknown')
  }
}
