import { $type, NsidString, Schema, ValidationContext } from '../core.js'

export class TokenSchema<
  const TValue extends string = string,
> extends Schema<TValue> {
  constructor(readonly value: TValue) {
    super()
  }

  validateInContext(input: unknown, ctx: ValidationContext) {
    if (input === this.value) {
      return ctx.success(this.value)
    }

    // @NOTE: allow using the token instance itself (but convert to the actual
    // token value)
    if (input instanceof TokenSchema && input.value === this.value) {
      return ctx.success(this.value)
    }

    if (typeof input !== 'string') {
      return ctx.issueInvalidType(input, 'token')
    }

    return ctx.issueInvalidValue(input, [this.value])
  }

  // When using the TokenSchema instance as data, let's serialize it to the
  // token value

  toJSON(): string {
    return this.value
  }

  toString(): string {
    return this.value
  }
}

/*@__NO_SIDE_EFFECTS__*/
export function token<
  const N extends NsidString,
  const H extends string = 'main',
>(nsid: N, hash: H = 'main' as H) {
  return new TokenSchema($type(nsid, hash))
}
