import { isPlainObject } from '@atproto/lex-data'
import { lazyProperty } from '../util/lazy-property.js'
import {
  Schema,
  ValidationResult,
  Validator,
  ValidatorContext,
} from '../validation.js'
import { Param, ParamScalar, paramSchema } from './_parameters.js'
import { ObjectSchemaOutput } from './object.js'
import { StringSchema } from './string.js'

export type ParamsSchemaShape = {
  [_ in string]: Validator<Param | undefined>
}

export type ParamsSchemaOutput<P extends ParamsSchemaShape> =
  ObjectSchemaOutput<P>

export type InferParamsSchema<T> =
  T extends ParamsSchema<infer P>
    ? NonNullable<unknown> extends ParamsSchemaOutput<P>
      ? ParamsSchemaOutput<P> | undefined
      : ParamsSchemaOutput<P>
    : never

export class ParamsSchema<
  const Shape extends ParamsSchemaShape = ParamsSchemaShape,
  Output extends ParamsSchemaOutput<Shape> = ParamsSchemaOutput<Shape>,
> extends Schema<Output> {
  constructor(readonly validators: Shape) {
    super()
  }

  get validatorsMap(): Map<string, Validator<Param | undefined>> {
    const map = new Map(Object.entries(this.validators))

    return lazyProperty(this, 'validatorsMap', map)
  }

  validateInContext(
    input: unknown = {},
    ctx: ValidatorContext,
  ): ValidationResult<Output> {
    if (!isPlainObject(input)) {
      return ctx.issueInvalidType(input, 'object')
    }

    // Lazily copy value
    let copy: undefined | Record<string, unknown>

    // Ensure that non-specified params conform to param schema
    for (const key in input) {
      if (this.validatorsMap.has(key)) continue

      const result = ctx.validateChild(input, key, paramSchema)
      if (!result.success) return result

      if (result.value !== input[key]) {
        copy ??= { ...input }
        copy[key] = result.value
      }
    }

    for (const [key, propDef] of this.validatorsMap) {
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

      if (result.value !== input[key]) {
        // Copy on write
        copy ??= { ...input }
        copy[key] = result.value
      }
    }

    return ctx.success((copy ?? input) as Output)
  }

  fromURLSearchParams(urlSearchParams: URLSearchParams): Output {
    const params: Record<string, Param> = {}

    for (const [key, value] of urlSearchParams.entries()) {
      const validator = this.validatorsMap.get(key)

      const coerced: ParamScalar =
        validator != null && validator instanceof StringSchema
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

  toURLSearchParams(input: Output): URLSearchParams {
    const urlSearchParams = new URLSearchParams()

    if (input !== undefined) {
      for (const [key, value] of Object.entries(input)) {
        if (Array.isArray(value)) {
          for (const v of value) {
            urlSearchParams.append(key, String(v))
          }
        } else if (value !== undefined) {
          urlSearchParams.append(key, String(value))
        }
      }
    }

    return urlSearchParams
  }
}
