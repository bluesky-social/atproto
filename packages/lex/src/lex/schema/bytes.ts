import {
  LexValidator,
  ValidationContext,
  ValidationResult,
  asUint8Array,
} from '../core.js'

export type LexBytesOptions = {
  minLength?: number
  maxLength?: number
}

export class LexBytes extends LexValidator<Uint8Array> {
  constructor(readonly $options: LexBytesOptions) {
    super()
  }

  protected override $validateInContext(
    input: unknown,
    ctx: ValidationContext,
  ): ValidationResult<Uint8Array> {
    const bytes = asUint8Array(input)
    if (!bytes) return ctx.issueInvalidType(input, 'bytes')

    const { minLength } = this.$options
    if (minLength != null && bytes.length < minLength) {
      return ctx.issueTooSmall(bytes, 'bytes', minLength, bytes.length)
    }

    const { maxLength } = this.$options
    if (maxLength != null && bytes.length > maxLength) {
      return ctx.issueTooBig(bytes, 'bytes', maxLength, bytes.length)
    }

    return ctx.success(bytes)
  }
}
