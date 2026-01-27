import { Schema, ValidationContext } from '../core.js'

export class EnumSchema<
  const TValue extends null | string | number | boolean,
> extends Schema<TValue> {
  constructor(readonly values: readonly TValue[]) {
    super()
  }

  validateInContext(input: unknown, ctx: ValidationContext) {
    if (!(this.values as readonly unknown[]).includes(input)) {
      return ctx.issueInvalidValue(input, this.values)
    }

    return ctx.success(input as TValue)
  }
}

/*@__NO_SIDE_EFFECTS__*/
export function enumSchema<const V extends null | string | number | boolean>(
  value: readonly V[],
) {
  return new EnumSchema<V>(value)
}

// @NOTE "enum" is a reserved keyword in JS/TS
export { enumSchema as enum }
