import { isPlainObject } from '@atproto/lex-data'
import {
  Infer,
  InferInput,
  InferOutput,
  Issue,
  IssueInvalidType,
  IssueInvalidValue,
  ParseOptions,
  Schema,
  ValidationContext,
  ValidationError,
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
export const paramSchema = union([
  paramScalarSchema,
  array(boolean()),
  array(integer()),
  array(string()),
])

/**
 * Type for a params object with string keys and optional param values.
 */
export type Params = Infer<typeof paramsSchema>

/**
 * Schema for validating arbitrary params objects.
 */
export const paramsSchema = dict(string(), optional(paramSchema))

export type ParamScalarValidator =
  // @NOTE In order to properly coerce URLSearchParams, we need to distinguish
  // between scalar and array validators, requiring to be able to detect which
  // schema types are being used, restricting the allowed param validators here.
  | LiteralSchema<string>
  | LiteralSchema<number>
  | LiteralSchema<boolean>
  | EnumSchema<string>
  | EnumSchema<number>
  // | EnumSchema<boolean> // Boolean lexicon definitions don't allow "enum"
  | StringSchema<any>
  | BooleanSchema
  | IntegerSchema

type AsArrayParamSchema<TSchema extends Validator> =
  // This allows to "distribute" any union of scalar validators into a union of
  // arrays of those validators, instead of an array of union. If TSchema is
  // BooleanSchema | IntegerSchema, we want the result to be
  // ArraySchema<BooleanSchema> | ArraySchema<IntegerSchema>, not
  // ArraySchema<BooleanSchema | IntegerSchema>, since the latter would allow
  // arrays with mixed types (e.g. [true, 42]), which we don't want.
  TSchema extends any ? ArraySchema<TSchema> : never

export type ParamValueValidator =
  | ParamScalarValidator
  | AsArrayParamSchema<ParamScalarValidator>

export type ParamValidator =
  | ParamValueValidator
  | OptionalSchema<ParamValueValidator>
  | OptionalSchema<WithDefaultSchema<ParamValueValidator>>
  | WithDefaultSchema<ParamValueValidator>

/**
 * Type representing the shape of a params schema definition.
 *
 * Maps parameter names to their validators (must be Param or undefined).
 */
export type ParamsShape = {
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
  const TShape extends ParamsShape = ParamsShape,
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
      return ctx.issueUnexpectedType(input, 'object')
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

  fromURLSearchParams(
    input: string | Iterable<[string, string]>,
    options?: ParseOptions,
  ): InferOutput<this> {
    const params: Record<string, unknown> = {}

    const iterable =
      typeof input === 'string' ? new URLSearchParams(input) : input
    const entries =
      iterable instanceof URLSearchParams ? iterable.entries() : iterable

    for (const [name, value] of entries) {
      const validator = this.shapeValidators.get(name)
      const innerValidator = validator ? unwrapSchema(validator) : undefined
      const expectsArray = innerValidator instanceof ArraySchema
      const scalarValidator = expectsArray
        ? unwrapSchema(innerValidator.validator)
        : innerValidator

      const coerced = coerceParam(name, value, scalarValidator, options)

      const currentParam = params[name]
      if (currentParam === undefined) {
        params[name] = expectsArray ? [coerced] : coerced
      } else if (Array.isArray(currentParam)) {
        currentParam.push(coerced)
      } else {
        params[name] = [currentParam, coerced]
      }
    }

    return this.parse(params, options)
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

function coerceParam(
  name: string,
  param: string,
  schema?: ParamScalarValidator,
  options?: ParseOptions,
): ParamScalar {
  let issue: Issue

  if (!schema) {
    // The param is unknown (not defined in schema), so we don't apply any
    // coercion and just return the string value.
    return param
  } else if (schema instanceof StringSchema) {
    return param
  } else if (schema instanceof IntegerSchema) {
    if (/^-?\d+$/.test(param)) return Number(param)
    issue = new IssueInvalidType(paramPath(name, options), param, ['integer'])
  } else if (schema instanceof BooleanSchema) {
    if (param === 'true') return true
    if (param === 'false') return false
    issue = new IssueInvalidType(paramPath(name, options), param, ['boolean'])
  } else if (schema instanceof LiteralSchema) {
    const { value } = schema
    if (String(value) === param) return value
    issue = new IssueInvalidValue(paramPath(name, options), param, [value])
  } else if (schema instanceof EnumSchema) {
    const { values } = schema
    for (const value of values) {
      if (String(value) === param) return value
    }
    issue = new IssueInvalidValue(paramPath(name, options), param, values)
  } else {
    // This should never happen. If it *does*, it means that the user of
    // lex-schema is mixing different versions of the lib, which is not
    // supported. Throwing an error here is better than silently accepting
    // invalid params and causing unexpected behavior down the line (ie. error
    // message returning the string value instead of the expected
    // boolean/number/string value).
    throw new Error(`Unsupported schema type for param coercion: ${schema}`)
  }

  // We were not able to coerce the param to the expected type. There is no
  // point in returning the original string value since it doesn't conform to
  // the expected schema, so we throw a validation error instead. We could
  // return the "param" here, which would cause the validation to fail later on
  // (see fromURLSearchParams()'s return statement). The main benefit of
  // returning the original "param" value is that the error path would include
  // the index of the param in case of array params (e.g. "tags[1]"), which
  // could be helpful for debugging. The cost overhead is not worth it though
  // (IMO).
  throw new ValidationError([issue])
}

function paramPath(key: string, options?: ParseOptions) {
  return options?.path ? [...options.path, key] : [key]
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
  const TShape extends ParamsShape = NonNullable<unknown>,
>(properties: TShape = {} as TShape) {
  return new ParamsSchema<TShape>(properties)
})

type UnwrapSchema<S extends Validator> =
  S extends OptionalSchema<infer U>
    ? UnwrapSchema<U>
    : S extends WithDefaultSchema<infer U>
      ? UnwrapSchema<U>
      : S

function unwrapSchema<S extends Validator>(schema: S): UnwrapSchema<S> {
  while (
    schema instanceof OptionalSchema ||
    schema instanceof WithDefaultSchema
  ) {
    return unwrapSchema(schema.validator)
  }
  return schema as UnwrapSchema<S>
}
