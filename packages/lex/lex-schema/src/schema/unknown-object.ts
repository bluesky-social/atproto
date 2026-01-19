import { LexMap, isLexMap } from '@atproto/lex-data'
import { Schema, ValidationContext } from '../core.js'
import { memoizedOptions } from '../util/memoize.js'

export type UnknownObject = LexMap

export class UnknownObjectSchema extends Schema<UnknownObject> {
  validateInContext(input: unknown, ctx: ValidationContext) {
    if (isLexMap(input)) {
      return ctx.success(input)
    }

    return ctx.issueInvalidType(input, 'unknown')
  }
}

export const unknownObject = /*#__PURE__*/ memoizedOptions(function () {
  return new UnknownObjectSchema()
})
