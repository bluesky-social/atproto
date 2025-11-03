import { asUint8Array, parseLexBytes } from '@atproto/lex-core'
import {
  ValidationContext,
  ValidationResult,
  Validator,
} from '../validation.js'

export type BytesSchemaOptions = {
  minLength?: number
  maxLength?: number
}

export class BytesSchema extends Validator<Uint8Array> {
  readonly lexiconType = 'bytes' as const

  constructor(readonly options: BytesSchemaOptions) {
    super()
  }

  override validateInContext(
    input: unknown,
    ctx: ValidationContext,
  ): ValidationResult<Uint8Array> {
    const bytes = asUint8Array(input) ?? parseLexBytes(input)
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
