import {
  InferStringFormat,
  LexValidator,
  StringFormat,
  UnknownString,
  ValidationContext,
  ValidationResult,
  coerceToString,
  validateStringFormat,
} from '../core.js'

export type LexStringOptions = {
  default?: string
  knownValues?: readonly string[]
  format?: StringFormat
  minLength?: number
  maxLength?: number
  minGraphemes?: number
  maxGraphemes?: number
}

export type LexStringOutput<Options> =
  //
  Options extends { format: infer F extends StringFormat }
    ? InferStringFormat<F>
    : Options extends { knownValues: readonly (infer K extends string)[] }
      ? K | UnknownString
      : string

export class LexString<
  const Options extends LexStringOptions = any,
> extends LexValidator<LexStringOutput<Options>> {
  constructor(readonly $options: Options) {
    super()
  }

  protected override $validateInContext(
    // @NOTE validation will be applied on the default value as well
    input: unknown = this.$options.default,
    ctx: ValidationContext,
  ): ValidationResult<LexStringOutput<Options>> {
    const { $options } = this

    const str = coerceToString(input, $options.format)
    if (str == null) {
      return ctx.issueInvalidType(input, 'string')
    }

    if ($options.minLength != null && str.length < $options.minLength) {
      return ctx.issueTooSmall(str, 'string', $options.minLength, str.length)
    }

    if ($options.maxLength != null && str.length > $options.maxLength) {
      return ctx.issueTooBig(str, 'string', $options.maxLength, str.length)
    }

    let lazyGraphLen: number

    const { minGraphemes } = $options
    if (minGraphemes != null) {
      // Optimization: avoid counting graphemes if the length check already fails
      if (str.length < minGraphemes) {
        return ctx.issueTooSmall(str, 'string', minGraphemes, str.length)
      } else if ((lazyGraphLen ??= graphemeLen(str)) < minGraphemes) {
        return ctx.issueTooSmall(str, 'grapheme', minGraphemes, lazyGraphLen)
      }
    }

    const { maxGraphemes } = $options
    if (maxGraphemes != null) {
      if ((lazyGraphLen ??= graphemeLen(str)) > maxGraphemes) {
        return ctx.issueTooBig(str, 'grapheme', maxGraphemes, lazyGraphLen)
      }
    }

    return validateStringFormat(str, ctx, $options.format) as ValidationResult<
      LexStringOutput<Options>
    >
  }
}

const segmenter = /*#__PURE__*/ new Intl.Segmenter()
function graphemeLen(str: string) {
  let length = 0
  for (const _ of segmenter.segment(str)) length++
  return length
}
