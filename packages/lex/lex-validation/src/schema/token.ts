import {
  ValidationContext,
  ValidationResult,
  Validator,
} from '../validation.js'

export class TokenSchema<V extends string = any> extends Validator<V> {
  readonly lexiconType = 'token' as const

  constructor(readonly value: V) {
    super()
  }

  override validateInContext(
    input: unknown,
    ctx: ValidationContext,
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

  // When using the TokenSchema instance as data, let's serialize to the token
  // value:

  toJSON() {
    return this.value
  }

  toString() {
    return this.value
  }
}
