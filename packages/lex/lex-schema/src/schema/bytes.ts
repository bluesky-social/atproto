import { asUint8Array, isPlainObject, parseLexBytes } from '@atproto/lex-data'
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
    // Coalesce different input formats into Uint8Array
    const bytes = coerceToBytes(input)
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

export function coerceToBytes(input: unknown): Uint8Array | undefined {
  const bytes = asUint8Array(input)
  if (bytes) return bytes

  if (isPlainObject(input)) {
    try {
      return parseLexBytes(input)
    } catch {
      // Ignore parse errors (invalid base64)
    }
  }

  // @NOTE We do not attempt to coerce strings as we cannot be sure if they are
  // base64-encoded or not.

  return undefined
}
