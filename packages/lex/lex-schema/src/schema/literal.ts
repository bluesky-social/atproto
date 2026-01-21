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

/*@__NO_SIDE_EFFECTS__*/
export function literal<const V extends null | string | number | boolean>(
  value: V,
) {
  return new LiteralSchema<V>(value)
}
