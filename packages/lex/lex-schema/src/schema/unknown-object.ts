import { LexMap, isLexMap } from '@atproto/lex-data'
import { Schema, ValidationResult, ValidatorContext } from '../core.js'

export type UnknownObjectOutput = LexMap

export class UnknownObjectSchema extends Schema<UnknownObjectOutput> {
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
