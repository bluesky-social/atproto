import { graphemeLen, ifCid, utf8Len } from '@atproto/lex-data'
import {
  InferStringFormat,
  Restricted,
  Schema,
  StringFormat,
  UnknownString,
  ValidationContext,
  isStringFormat,
} from '../core.js'
import { IfAny } from '../util/if-any.js'
import { memoizedOptions } from '../util/memoize.js'
import { TokenSchema } from './token.js'

/**
 * Configuration options for string schema validation.
 *
 * @property format - Expected string format (e.g., 'datetime', 'uri', 'at-uri', 'did', 'handle', 'nsid', 'cid', 'tid', 'record-key', 'at-identifier', 'language')
 * @property knownValues - Known string literal values for type narrowing
 * @property minLength - Minimum length in UTF-8 bytes
 * @property maxLength - Maximum length in UTF-8 bytes
 * @property minGraphemes - Minimum number of grapheme clusters
 * @property maxGraphemes - Maximum number of grapheme clusters
 */
export type StringSchemaOptions = {
  format?: StringFormat
  knownValues?: readonly string[]
  minLength?: number
  maxLength?: number
  minGraphemes?: number
  maxGraphemes?: number
}

/**
 * Schema for validating string values with optional format and length constraints.
 *
 * Supports various string formats defined in the Lexicon specification, as well as
 * length constraints measured in UTF-8 bytes or grapheme clusters.
 *
 * @template TOptions - The configuration options type
 *
 * @example
 * ```ts
 * const schema = new StringSchema({ format: 'datetime', maxLength: 64 })
 * const result = schema.validate('2024-01-15T10:30:00Z')
 * ```
 */
export class StringSchema<
  const TOptions extends StringSchemaOptions = StringSchemaOptions,
> extends Schema<
  IfAny<
    TOptions,
    string,
    TOptions extends { format: infer F extends StringFormat }
      ? InferStringFormat<F>
      : TOptions extends { knownValues: readonly (infer V extends string)[] }
        ? V | UnknownString
        : string
  >
> {
  readonly type = 'string' as const

  // @NOTE since the _string utility allows omitting knownValues when TOptions
  // *does* include it (since it's only used for typing), we cannot type options
  // as TOptions directly since it may not actually include knownValues at
  // runtime, making schema.options.knownValues potentially undefined even when
  // TOptions includes it.
  readonly options: StringSchemaOptions

  constructor(options: TOptions) {
    super()
    this.options = options
  }

  validateInContext(input: unknown, ctx: ValidationContext) {
    const str = coerceToString(input)
    if (str == null) {
      return ctx.issueUnexpectedType(input, 'string')
    }

    let lazyUtf8Len: number

    const minLength = this.options.minLength
    if (minLength != null) {
      if ((lazyUtf8Len ??= utf8Len(str)) < minLength) {
        return ctx.issueTooSmall(str, 'string', minLength, lazyUtf8Len)
      }
    }

    const maxLength = this.options.maxLength
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

    const minGraphemes = this.options.minGraphemes
    if (minGraphemes != null) {
      // Optimization: avoid counting graphemes if the length check already fails
      if (str.length < minGraphemes) {
        return ctx.issueTooSmall(str, 'grapheme', minGraphemes, str.length)
      } else if ((lazyGraphLen ??= graphemeLen(str)) < minGraphemes) {
        return ctx.issueTooSmall(str, 'grapheme', minGraphemes, lazyGraphLen)
      }
    }

    const maxGraphemes = this.options.maxGraphemes
    if (maxGraphemes != null) {
      if ((lazyGraphLen ??= graphemeLen(str)) > maxGraphemes) {
        return ctx.issueTooBig(str, 'grapheme', maxGraphemes, lazyGraphLen)
      }
    }

    const format = this.options.format
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

function _string(): StringSchema<NonNullable<unknown>>
function _string<
  // Allow calling `string<{ knownValues: [...] }>()` without passing an options
  // object, since knownValues is only used for typing and has no runtime
  // effect, so it can be safely omitted at runtime.
  const TOptions extends {
    knownValues: StringSchemaOptions['knownValues']
  } & {
    [K in Exclude<
      keyof StringSchemaOptions,
      'knownValues'
    >]?: Restricted<`An options argument is required when using the "${K}" option`>
  },
>(): StringSchema<
  IfAny<TOptions, any, { knownValues: TOptions['knownValues'] }>
>
function _string<const TOptions extends StringSchemaOptions>(
  // If TOptions is explicitly provided (e.g. `string<{ ... }>({ ... })`), we
  // allow the actual options argument to omit the "knownValues" property since
  // it's only used for inferring the type and has no runtime effect.
  options: TOptions | Omit<TOptions, 'knownValues'>,
): StringSchema<TOptions>
function _string(options: StringSchemaOptions = {}) {
  return new StringSchema(options)
}

/**
 * Creates a string schema with optional format and length constraints.
 *
 * Strings can be validated against various formats (datetime, uri, did, handle, etc.)
 * and constrained by length in UTF-8 bytes or grapheme clusters.
 *
 * @param options - Optional configuration for format and length constraints
 * @returns A new {@link StringSchema} instance
 *
 * @example
 * ```ts
 * // Basic string
 * const nameSchema = l.string()
 *
 * // With format validation
 * const dateSchema = l.string({ format: 'datetime' })
 *
 * // With length constraints (UTF-8 bytes)
 * const bioSchema = l.string({ maxLength: 256 })
 *
 * // With grapheme constraints (user-perceived characters)
 * const displayNameSchema = l.string({ maxGraphemes: 64 })
 *
 * // Combining constraints
 * const handleSchema = l.string({ format: 'handle', minLength: 3, maxLength: 253 })
 * ```
 */
export const string = /*#__PURE__*/ memoizedOptions(_string)
