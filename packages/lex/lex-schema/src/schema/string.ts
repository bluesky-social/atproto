import { graphemeLen, ifCid, utf8Len } from '@atproto/lex-data'
import {
  InferStringFormat,
  Schema,
  StringFormat,
  ValidationResult,
  ValidatorContext,
  assertStringFormat,
} from '../core.js'
import { TokenSchema } from './token.js'

export type StringSchemaOptions = {
  default?: string
  format?: StringFormat
  minLength?: number
  maxLength?: number
  minGraphemes?: number
  maxGraphemes?: number
}

export type StringSchemaOutput<Options> =
  //
  Options extends { format: infer F extends StringFormat }
    ? InferStringFormat<F>
    : string

export class StringSchema<
  const Options extends StringSchemaOptions = any,
> extends Schema<StringSchemaOutput<Options>> {
  constructor(readonly options: Options) {
    super()
  }

  validateInContext(
    // @NOTE validation will be applied on the default value as well
    input: unknown = this.options.default,
    ctx: ValidatorContext,
  ): ValidationResult<StringSchemaOutput<Options>> {
    const { options } = this

    const str = coerceToString(input)
    if (str == null) {
      return ctx.issueInvalidType(input, 'string')
    }

    let lazyUtf8Len: number

    const { minLength } = options
    if (minLength != null) {
      if ((lazyUtf8Len ??= utf8Len(str)) < minLength) {
        return ctx.issueTooSmall(str, 'string', minLength, lazyUtf8Len)
      }
    }

    const { maxLength } = options
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

    const { minGraphemes } = options
    if (minGraphemes != null) {
      // Optimization: avoid counting graphemes if the length check already fails
      if (str.length < minGraphemes) {
        return ctx.issueTooSmall(str, 'grapheme', minGraphemes, str.length)
      } else if ((lazyGraphLen ??= graphemeLen(str)) < minGraphemes) {
        return ctx.issueTooSmall(str, 'grapheme', minGraphemes, lazyGraphLen)
      }
    }

    const { maxGraphemes } = options
    if (maxGraphemes != null) {
      if ((lazyGraphLen ??= graphemeLen(str)) > maxGraphemes) {
        return ctx.issueTooBig(str, 'grapheme', maxGraphemes, lazyGraphLen)
      }
    }

    if (options.format !== undefined) {
      try {
        // @TODO optimize to avoid throw cost (requires re-writing utilities
        // from @atproto/syntax)
        assertStringFormat(str, options.format)
      } catch (err) {
        const message = err instanceof Error ? err.message : undefined
        return ctx.issueInvalidFormat(str, options.format, message)
      }
    }

    return ctx.success(str as StringSchemaOutput<Options>)
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
