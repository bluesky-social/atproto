import { Schema, ValidationContext } from '../core.js'
import { memoizedOptions } from '../util/memoize.js'

export class NullSchema extends Schema<null> {
  validateInContext(input: unknown, ctx: ValidationContext) {
    if (input !== null) {
      return ctx.issueInvalidType(input, 'null')
    }

    return ctx.success(null)
  }
}

export const nullSchema = /*#__PURE__*/ memoizedOptions(function () {
  return new NullSchema()
})

export { nullSchema as null }
