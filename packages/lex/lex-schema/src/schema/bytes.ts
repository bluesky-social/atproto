import { asUint8Array, ifUint8Array } from '@atproto/lex-data'
import { Schema, ValidationContext } from '../core.js'
import { memoizedOptions } from '../util/memoize.js'

export type BytesSchemaOptions = {
  minLength?: number
  maxLength?: number
}

export class BytesSchema extends Schema<Uint8Array> {
  constructor(readonly options: BytesSchemaOptions = {}) {
    super()
  }

  validateInContext(input: unknown, ctx: ValidationContext) {
    // In "parse" mode, coerce different binary formats into Uint8Array
    const bytes =
      ctx.options.mode === 'parse' ? asUint8Array(input) : ifUint8Array(input)
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

export const bytes = /*#__PURE__*/ memoizedOptions(function (
  options?: BytesSchemaOptions,
) {
  return new BytesSchema(options)
})
