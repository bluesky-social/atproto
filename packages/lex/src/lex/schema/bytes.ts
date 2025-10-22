import {
  ValidationContext,
  ValidationResult,
  Validator,
  asUint8Array,
  parseIpldBytes,
} from '../core.js'

export type BytesSchemaOptions = {
  minLength?: number
  maxLength?: number
}

export class BytesSchema extends Validator<Uint8Array> {
  constructor(readonly options: BytesSchemaOptions) {
    super()
  }

  protected override validateInContext(
    input: unknown,
    ctx: ValidationContext,
  ): ValidationResult<Uint8Array> {
    const bytes = asUint8Array(input) ?? parseIpldBytes(input)
    if (!bytes) return ctx.issueInvalidType(input, 'bytes')

    const { minLength } = this.options
    if (minLength != null && bytes.length < minLength) {
      return ctx.issueTooSmall(bytes, 'bytes', minLength, bytes.length)
    }

    const { maxLength } = this.options
    if (maxLength != null && bytes.length > maxLength) {
      return ctx.issueTooBig(bytes, 'bytes', maxLength, bytes.length)
    }

    return ctx.success(bytes)
  }
}
