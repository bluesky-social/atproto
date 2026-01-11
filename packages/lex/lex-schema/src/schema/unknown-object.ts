import { LexMap, isLexMap } from '@atproto/lex-data'
import { Schema, ValidationResult, ValidatorContext } from '../core.js'

export type UnknownObject = LexMap

export class UnknownObjectSchema extends Schema<UnknownObject> {
  validateInContext(
    input: unknown,
    ctx: ValidatorContext,
  ): ValidationResult<UnknownObject> {
    if (isLexMap(input)) {
      return ctx.success(input)
    }

    return ctx.issueInvalidType(input, 'unknown')
  }
}
