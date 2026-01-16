import { Schema, ValidationContext } from '../core.js'

export class LiteralSchema<
  const TValue extends null | string | number | boolean,
> extends Schema<TValue> {
  constructor(readonly value: TValue) {
    super()
  }

  validateInContext(input: unknown, ctx: ValidationContext) {
    if (input !== this.value) {
      return ctx.issueInvalidValue(input, [this.value])
    }

    return ctx.success(this.value)
  }
}
