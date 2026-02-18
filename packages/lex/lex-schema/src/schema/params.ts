import { isPlainObject } from '@atproto/lex-data'
import {
  Infer,
  InferInput,
  InferOutput,
  Schema,
  ValidationContext,
  Validator,
  WithOptionalProperties,
} from '../core.js'
import { lazyProperty } from '../util/lazy-property.js'
import { memoizedOptions } from '../util/memoize.js'
import { ArraySchema, array } from './array.js'
import { BooleanSchema, boolean } from './boolean.js'
import { dict } from './dict.js'
import { EnumSchema } from './enum.js'
import { IntegerSchema, integer } from './integer.js'
import { LiteralSchema } from './literal.js'
import { OptionalSchema, optional } from './optional.js'
import { StringSchema, string } from './string.js'
import { union } from './union.js'
import { WithDefaultSchema } from './with-default.js'

/**
 * Scalar types allowed in URL parameters: boolean, integer, or string.
 */
export type ParamScalar = Infer<typeof paramScalarSchema>
const paramScalarSchema = union([boolean(), integer(), string()])

/**
 * A single parameter value: scalar or array of scalars.
 */
export type Param = Infer<typeof paramSchema>

/**
 * Schema for validating individual parameter values.
 */
export const paramSchema = union([paramScalarSchema, array(paramScalarSchema)])

/**
 * Type for a params object with string keys and optional param values.
 */
export type Params = Infer<typeof paramsSchema>

/**
 * Schema for validating arbitrary params objects.
 */
export const paramsSchema = dict(string(), optional(paramSchema))

// @NOTE In order to properly coerce URLSearchParams, we need to distinguish
// between scalar and array validators, requiring to be able to detect which
// schema types are being used, restricting the allowed param validators here.
type ParamScalarValidator<V extends ParamScalar = ParamScalar> =
  | LiteralSchema<V>
  | EnumSchema<V>
  | (V extends string
      ? StringSchema
      : V extends boolean
        ? BooleanSchema
        : V extends number
          ? IntegerSchema
          : never)
type ParamValueValidator<V extends Param = Param> =
  V extends readonly (infer U)[]
    ? U extends ParamScalar
      ? ArraySchema<ParamScalarValidator<U>>
      : never
    : V extends ParamScalar
      ? ParamScalarValidator<V>
      : never
type ParamValidator<V extends Param | undefined = Param | undefined> =
  //
  undefined extends Extract<V, undefined>
    ?
        | OptionalSchema<ParamValueValidator<NonNullable<V>>>
        | OptionalSchema<WithDefaultSchema<ParamValueValidator<NonNullable<V>>>>
        | ParamValueValidator<NonNullable<V>>
        | WithDefaultSchema<ParamValueValidator<NonNullable<V>>>
    :
        | ParamValueValidator<NonNullable<V>>
        | WithDefaultSchema<ParamValueValidator<NonNullable<V>>>

/**
 * Type representing the shape of a params schema definition.
 *
 * Maps parameter names to their validators (must be Param or undefined).
 */
export type ParamsSchemaShape = {
  [x: string]: ParamValidator
}

/**
 * Schema for validating URL query parameters in Lexicon endpoints.
 *
 * Params are the query string parameters passed to queries, procedures,
 * and subscriptions. Values must be scalars (boolean, integer, string)
 * or arrays of scalars, as they need to be serializable to URL format.
 *
 * Provides methods for converting to/from URLSearchParams.
 *
 * @template TShape - The params shape type mapping names to validators
 *
 * @example
 * ```ts
 * const schema = new ParamsSchema({
 *   limit: l.optional(l.integer({ minimum: 1, maximum: 100 })),
 *   cursor: l.optional(l.string()),
 * })
 * ```
 */
export class ParamsSchema<
  const TShape extends ParamsSchemaShape = ParamsSchemaShape,
> extends Schema<
  WithOptionalProperties<{
    [K in keyof TShape]: InferInput<TShape[K]>
  }>,
  WithOptionalProperties<{
    [K in keyof TShape]: InferOutput<TShape[K]>
  }>
> {
  readonly type = 'params' as const

  constructor(readonly shape: TShape) {
    super()
  }

  get shapeValidators(): Map<string, ParamValidator> {
    const map = new Map(Object.entries(this.shape))

    return lazyProperty(this, 'shapeValidators', map)
  }

  validateInContext(input: unknown, ctx: ValidationContext) {
    if (!isPlainObject(input)) {
      return ctx.issueInvalidType(input, 'object')
    }

    // Lazily copy value
    let copy: undefined | Record<string, unknown>

    // Ensure that non-specified params conform to param schema
    for (const key in input) {
      if (this.shapeValidators.has(key)) continue

      const result = ctx.validateChild(input, key, paramSchema)
      if (!result.success) return result

      if (result.value !== input[key]) {
        if (ctx.options.mode === 'validate') {
          // In "validate" mode, we can't modify the input, so we issue an error
          return ctx.issueInvalidPropertyValue(input, key, [result.value])
        }

        copy ??= { ...input }
        copy[key] = result.value
      }
    }

    for (const [key, propDef] of this.shapeValidators) {
      const result = ctx.validateChild(input, key, propDef)
      if (!result.success) {
        if (!(key in input)) {
          // Transform into "required key" issue
          return ctx.issueRequiredKey(input, key)
        }

        return result
      }

      // Skip copying if key is not present in input (and value is undefined)
      if (result.value === undefined && !(key in input)) {
        continue
      }

      if (!Object.is(result.value, input[key])) {
        if (ctx.options.mode === 'validate') {
          // In "validate" mode, we can't modify the input, so we issue an error
          return ctx.issueInvalidPropertyValue(input, key, [result.value])
        }

        // Copy on write
        copy ??= { ...input }
        copy[key] = result.value
      }
    }

    return ctx.success(copy ?? input)
  }

  fromURLSearchParams(iterable: Iterable<[string, string]>): InferOutput<this> {
    const params: Record<string, Param> = {}

    // Compatibility with URLSearchParams not being iterable in some environments
    const entries =
      iterable instanceof URLSearchParams ? iterable.entries() : iterable

    for (const [key, value] of entries) {
      const validator = unwrapValidator(this.shapeValidators.get(key))
      const expectsArray = validator instanceof ArraySchema
      const scalarValidator = expectsArray
        ? unwrapValidator(validator.validator)
        : validator

      const coerced = coerceParam(value, scalarValidator)

      const currentParam = params[key]
      if (currentParam === undefined) {
        params[key] = expectsArray ? [coerced] : coerced
      } else if (Array.isArray(currentParam)) {
        currentParam.push(coerced)
      } else {
        params[key] = [currentParam, coerced]
      }
    }

    return this.parse(params)
  }

  toURLSearchParams(input: InferInput<this>): URLSearchParams {
    const urlSearchParams = new URLSearchParams()

    // @NOTE We apply defaults here to ensure that server with different
    // defaults still receive all expected parameters.
    const params = this.parse(input)

    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) {
        for (const v of value) {
          urlSearchParams.append(key, String(v))
        }
      } else if (value !== undefined) {
        urlSearchParams.append(key, String(value))
      }
    }

    return urlSearchParams
  }
}

function coerceParam(param: string, schema?: Validator): ParamScalar {
  if (schema) {
    if (schema instanceof LiteralSchema) {
      return String(schema.value) === param ? schema.value : param
    } else if (schema instanceof EnumSchema) {
      return schema.values.find((v) => String(v) === param) ?? param
    } else if (schema instanceof StringSchema) {
      return param
    } else if (schema instanceof BooleanSchema) {
      switch (param) {
        case 'true':
          return true
        case 'false':
          return false
      }
    } else if (schema instanceof IntegerSchema) {
      if (/^-?\d+$/.test(param)) return Number(param)
    }
  }

  return param
}

/**
 * Creates a params schema for URL query parameters.
 *
 * Params schemas validate query string parameters for Lexicon endpoints.
 * Values must be boolean, integer, string, or arrays of those types.
 *
 * @param properties - Object mapping parameter names to their validators
 * @returns A new {@link ParamsSchema} instance
 *
 * @example
 * ```ts
 * // Simple pagination params
 * const paginationParams = l.params({
 *   limit: l.optional(l.withDefault(l.integer({ minimum: 1, maximum: 100 }), 50)),
 *   cursor: l.optional(l.string()),
 * })
 *
 * // Required parameter
 * const actorParams = l.params({
 *   actor: l.string({ format: 'at-identifier' }),
 * })
 *
 * // Array parameter (multiple values)
 * const filterParams = l.params({
 *   tags: l.optional(l.array(l.string())),
 * })
 *
 * // Convert from URL
 * const urlParams = new URLSearchParams('limit=25&cursor=abc')
 * const validated = paginationParams.fromURLSearchParams(urlParams)
 *
 * // Convert to URL
 * const searchParams = paginationParams.toURLSearchParams({ limit: 25 })
 * ```
 */
export const params = /*#__PURE__*/ memoizedOptions(function params<
  const TShape extends ParamsSchemaShape = NonNullable<unknown>,
>(properties: TShape = {} as TShape) {
  return new ParamsSchema<TShape>(properties)
})

function unwrapValidator(schema?: Validator): Validator | undefined {
  while (
    schema instanceof OptionalSchema ||
    schema instanceof WithDefaultSchema
  ) {
    schema = schema.validator
  }
  return schema
}
