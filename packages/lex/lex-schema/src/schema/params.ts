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
import { array } from './array.js'
import { boolean } from './boolean.js'
import { dict } from './dict.js'
import { integer } from './integer.js'
import { optional } from './optional.js'
import { StringSchema, string } from './string.js'
import { union } from './union.js'

export type ParamScalar = Infer<typeof paramScalarSchema>
const paramScalarSchema = union([boolean(), integer(), string()])

export type Param = Infer<typeof paramSchema>
export const paramSchema = union([paramScalarSchema, array(paramScalarSchema)])

export type Params = Infer<typeof paramsSchema>
export const paramsSchema = dict(string(), optional(paramSchema))

export type ParamsSchemaShape = {
  [x: string]: Validator<Param | undefined>
}

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
  constructor(readonly shape: TShape) {
    super()
  }

  get shapeValidators(): Map<string, Validator<Param | undefined>> {
    const map = new Map(Object.entries(this.shape))

    return lazyProperty(this, 'shapeValidators', map)
  }

  validateInContext(input: unknown, ctx: ValidationContext) {
    // @TODO BETTER SUPPORT Input/Output
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

  fromURLSearchParams(urlSearchParams: URLSearchParams): InferOutput<this> {
    const params: Record<string, Param> = {}

    for (const [key, value] of urlSearchParams.entries()) {
      const validator = this.shapeValidators.get(key)

      const coerced: ParamScalar =
        validator instanceof StringSchema
          ? value
          : value === 'true'
            ? true
            : value === 'false'
              ? false
              : /^-?\d+$/.test(value)
                ? Number(value)
                : value

      if (params[key] === undefined) {
        params[key] = coerced
      } else if (Array.isArray(params[key])) {
        params[key].push(coerced)
      } else {
        params[key] = [params[key] as ParamScalar, coerced]
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

export const params = /*#__PURE__*/ memoizedOptions(function params<
  const TShape extends ParamsSchemaShape = NonNullable<unknown>,
>(properties: TShape = {} as TShape) {
  return new ParamsSchema<TShape>(properties)
})
