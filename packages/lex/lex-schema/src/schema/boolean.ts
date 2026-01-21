import { Schema, ValidationContext } from '../core.js'
import { memoizedOptions } from '../util/memoize.js'

export class BooleanSchema extends Schema<boolean> {
  validateInContext(input: unknown, ctx: ValidationContext) {
    if (typeof input === 'boolean') {
      return ctx.success(input)
    }

    return ctx.issueInvalidType(input, 'boolean')
  }
}

export const boolean = /*#__PURE__*/ memoizedOptions(function () {
  return new BooleanSchema()
})
