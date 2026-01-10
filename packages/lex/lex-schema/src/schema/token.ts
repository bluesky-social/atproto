import { Schema, ValidationResult, ValidatorContext } from '../core.js'

export class TokenSchema<V extends string = any> extends Schema<V> {
  constructor(readonly value: V) {
    super()
  }

  validateInContext(
    input: unknown,
    ctx: ValidatorContext,
  ): ValidationResult<V> {
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
