import { Schema, ValidationContext } from '../core.js'

export class RegexpSchema<
  TValue extends string = string,
> extends Schema<TValue> {
  constructor(public readonly pattern: RegExp) {
    super()
  }

  validateInContext(input: unknown, ctx: ValidationContext) {
    if (typeof input !== 'string') {
      return ctx.issueInvalidType(input, 'string')
    }

    if (!this.pattern.test(input)) {
      return ctx.issueInvalidFormat(input, this.pattern.toString())
    }

    return ctx.success(input as TValue)
  }
}
