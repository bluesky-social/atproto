import { LexMap, isLexMap } from '@atproto/lex-data'
import { Schema, ValidationContext } from '../core.js'

export type UnknownObject = LexMap

export class UnknownObjectSchema extends Schema<UnknownObject> {
  validateInContext(input: unknown, ctx: ValidationContext) {
    if (isLexMap(input)) {
      return ctx.success(input)
    }

    return ctx.issueInvalidType(input, 'unknown')
  }
}
