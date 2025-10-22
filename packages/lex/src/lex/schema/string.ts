import {
  InferStringFormat,
  StringFormat,
  UnknownString,
  ValidationContext,
  ValidationResult,
  Validator,
  coerceToString,
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
  constructor(readonly options: Options) {
    super()
  }

  protected override validateInContext(
    // @NOTE validation will be applied on the default value as well
    input: unknown = this.options.default,
    ctx: ValidationContext,
  ): ValidationResult<StringSchemaOutput<Options>> {
    const { options } = this

    const str = coerceToString(input)
    if (str == null) {
      return ctx.issueInvalidType(input, 'string')
    }

    // If the JavaScript string length * 3 is within the maximum limit,
    // its UTF8 length (which <= .length * 3) will also be within.
    // When there's no minimal length, this lets us skip the UTF8 length check.
    const canSkipUtf8LenChecks =
      typeof options.minLength === 'undefined' &&
      typeof options.maxLength === 'number' &&
      str.length * 3 <= options.maxLength

    if (!canSkipUtf8LenChecks) {
      const len = utf8Len(str)

      if (options.minLength != null && len < options.minLength) {
        return ctx.issueTooSmall(str, 'string', options.minLength, len)
      }

      if (options.maxLength != null && len > options.maxLength) {
        return ctx.issueTooBig(str, 'string', options.maxLength, len)
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

const segmenter = /*#__PURE__*/ new Intl.Segmenter()
function graphemeLen(str: string) {
  let length = 0
  for (const _ of segmenter.segment(str)) length++
  return length
}

const textEncoder = /*#__PURE__*/ new TextEncoder()
export function utf8Len(str: string): number {
  return textEncoder.encode(str).byteLength
}
