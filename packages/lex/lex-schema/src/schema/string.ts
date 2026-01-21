import { graphemeLen, ifCid, utf8Len } from '@atproto/lex-data'
import {
  InferStringFormat,
  Schema,
  StringFormat,
  ValidationContext,
  isStringFormat,
} from '../core.js'
import { memoizedOptions } from '../util/memoize.js'
import { TokenSchema } from './token.js'

export type StringSchemaOptions = {
  format?: StringFormat
  minLength?: number
  maxLength?: number
  minGraphemes?: number
  maxGraphemes?: number
}

export class StringSchema<
  const TOptions extends StringSchemaOptions = StringSchemaOptions,
> extends Schema<
  TOptions extends { format: infer F extends StringFormat }
    ? InferStringFormat<F>
    : string
> {
  constructor(readonly options?: TOptions) {
    super()
  }

  validateInContext(input: unknown, ctx: ValidationContext) {
    const str = coerceToString(input)
    if (str == null) {
      return ctx.issueInvalidType(input, 'string')
    }

    let lazyUtf8Len: number

    const minLength = this.options?.minLength
    if (minLength != null) {
      if ((lazyUtf8Len ??= utf8Len(str)) < minLength) {
        return ctx.issueTooSmall(str, 'string', minLength, lazyUtf8Len)
      }
    }

    const maxLength = this.options?.maxLength
    if (maxLength != null) {
      // Optimization: we can avoid computing the UTF-8 length if the maximum
      // possible length, in bytes, of the input JS string is smaller than the
      // maxLength (in UTF-8 string bytes).
      if (str.length * 3 <= maxLength) {
        // Input string so small it can't possibly exceed maxLength
      } else if ((lazyUtf8Len ??= utf8Len(str)) > maxLength) {
        return ctx.issueTooBig(str, 'string', maxLength, lazyUtf8Len)
      }
    }

    let lazyGraphLen: number

    const minGraphemes = this.options?.minGraphemes
    if (minGraphemes != null) {
      // Optimization: avoid counting graphemes if the length check already fails
      if (str.length < minGraphemes) {
        return ctx.issueTooSmall(str, 'grapheme', minGraphemes, str.length)
      } else if ((lazyGraphLen ??= graphemeLen(str)) < minGraphemes) {
        return ctx.issueTooSmall(str, 'grapheme', minGraphemes, lazyGraphLen)
      }
    }

    const maxGraphemes = this.options?.maxGraphemes
    if (maxGraphemes != null) {
      if ((lazyGraphLen ??= graphemeLen(str)) > maxGraphemes) {
        return ctx.issueTooBig(str, 'grapheme', maxGraphemes, lazyGraphLen)
      }
    }

    const format = this.options?.format
    if (format != null && !isStringFormat(str, format)) {
      return ctx.issueInvalidFormat(str, format)
    }

    return ctx.success(str)
  }
}

export function coerceToString(input: unknown): string | null {
  switch (typeof input) {
    // @NOTE We do *not* coerce numbers/booleans to strings because that can
    // lead to them being accepted as string instead of being coerced to
    // number/boolean when the input is a string and the expected result is
    // number/boolean (e.g. in params).
    case 'string':
      return input
    case 'object': {
      if (input == null) return null

      // @NOTE Allow using TokenSchema instances in places expecting strings,
      // converting them to their string value.
      if (input instanceof TokenSchema) {
        return input.toString()
      }

      if (input instanceof Date) {
        if (Number.isNaN(input.getTime())) return null
        return input.toISOString()
      }

      if (input instanceof URL) {
        return input.toString()
      }

      const cid = ifCid(input)
      if (cid) return cid.toString()

      if (input instanceof String) {
        return input.valueOf()
      }
    }

    // falls through
    default:
      return null
  }
}

export const string = /*#__PURE__*/ memoizedOptions(function <
  const O extends StringSchemaOptions = NonNullable<unknown>,
>(options?: StringSchemaOptions & O) {
  return new StringSchema<O>(options)
})
