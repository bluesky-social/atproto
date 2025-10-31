import {
  InferStringFormat,
  StringFormat,
  UnknownString,
  ValidationContext,
  ValidationResult,
  Validator,
  coerceToString,
  graphemeLen,
  utf8Len,
  validateStringFormat,
} from '../core.js'

export type StringSchemaOptions = {
  default?: string
  knownValues?: readonly string[]
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
    : Options extends { knownValues: readonly (infer K extends string)[] }
      ? K | UnknownString
      : string

export class StringSchema<
  const Options extends StringSchemaOptions = any,
> extends Validator<StringSchemaOutput<Options>> {
  readonly lexiconType = 'string' as const

  constructor(readonly options: Options) {
    super()
  }

  override validateInContext(
    // @NOTE validation will be applied on the default value as well
    input: unknown = this.options.default,
    ctx: ValidationContext,
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

    return validateStringFormat(str, ctx, options.format) as ValidationResult<
      StringSchemaOutput<Options>
    >
  }
}
