import { Schema, ValidationContext } from '../core.js'
import { memoizedOptions } from '../util/memoize.js'

export class NeverSchema extends Schema<never> {
  validateInContext(input: unknown, ctx: ValidationContext) {
    return ctx.issueInvalidType(input, 'never')
  }
}

export const never = /*#__PURE__*/ memoizedOptions(function () {
  return new NeverSchema()
})
