import { asUint8Array } from '@atproto/lex-data'
import { Schema, ValidationResult, ValidatorContext } from '../core.js'

export type BytesSchemaOptions = {
  minLength?: number
  maxLength?: number
}

export class BytesSchema extends Schema<Uint8Array> {
  constructor(readonly options: BytesSchemaOptions = {}) {
    super()
  }

  validateInContext(
    input: unknown,
    ctx: ValidatorContext,
  ): ValidationResult<Uint8Array> {
    // Coerce different binary formats into Uint8Array
    const bytes = asUint8Array(input)
    if (!bytes) {
      return ctx.issueInvalidType(input, 'bytes')
    }

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
