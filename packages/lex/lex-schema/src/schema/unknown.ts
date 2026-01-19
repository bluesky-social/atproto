import { Schema, ValidationContext } from '../core.js'
import { memoizedOptions } from '../util/memoize.js'

export class UnknownSchema extends Schema<unknown> {
  validateInContext(input: unknown, ctx: ValidationContext) {
    return ctx.success(input)
  }
}

export const unknown = /*#__PURE__*/ memoizedOptions(function () {
  return new UnknownSchema()
})
