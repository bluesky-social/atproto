import { isPlainObject } from '@atproto/lex-data'
import { ValidationResult, Validator, ValidatorContext } from '../validation.js'
import { Parameter, parameterSchema } from './_parameters.js'
import { ObjectSchemaOutput } from './object.js'

export type ParamsSchemaProperties = { [_ in string]: Validator<Parameter> }

export type ParamsSchemaOptions = {
  required?: readonly string[]
}

export type ParamsSchemaOutput<
  P extends ParamsSchemaProperties,
  O extends ParamsSchemaOptions,
> = ObjectSchemaOutput<P, O>

export type InferParamsSchema<T> =
  T extends ParamsSchema<infer P, infer O>
    ? NonNullable<unknown> extends ParamsSchemaOutput<P, O>
      ? ParamsSchemaOutput<P, O> | undefined
      : ParamsSchemaOutput<P, O>
    : never

export class ParamsSchema<
  const Validators extends ParamsSchemaProperties = ParamsSchemaProperties,
  const Options extends ParamsSchemaOptions = ParamsSchemaOptions,
  Output extends ParamsSchemaOutput<Validators, Options> = ParamsSchemaOutput<
    Validators,
    Options
  >,
> extends Validator<Output> {
  readonly lexiconType = 'params' as const

  constructor(
    readonly validators: Validators,
    readonly options: Options,
  ) {
    super()
  }

  get validatorsMap(): Map<string, Validator<Parameter>> {
    const map = new Map(Object.entries(this.validators))

    // Cache the map on the instance (to avoid re-creating it)
    Object.defineProperty(this, 'validatorsMap', {
      value: map,
      writable: false,
      enumerable: false,
      configurable: true,
    })

    return map
  }

  override validateInContext(
    input: unknown = {},
    ctx: ValidatorContext,
  ): ValidationResult<Output> {
    if (!isPlainObject(input)) {
      return ctx.issueInvalidType(input, 'object')
    }

    // Lazily copy value
    let copy: undefined | Record<string, unknown>

    for (const key in input) {
      if (this.validatorsMap.has(key)) continue

      // In "passthrough" mode we still need to ensure that params are valid
      const result = ctx.validateChild(input, key, parameterSchema)
      if (!result.success) return result

      if (result.value !== input[key]) {
        copy ??= { ...input }
        copy[key] = result.value
      }
    }

    for (const [key, propDef] of this.validatorsMap) {
      const result = ctx.validateChild(input, key, propDef)
      if (!result.success) {
        // Because default values are provided by child validators, we need to
        // run the validator to get the default value and, in case of failure,
        // ignore validation error that were caused by missing keys.
        if (!(key in input)) {
          if (!this.options.required?.includes(key)) {
            // Ignore missing non-required key
            continue
          } else {
            // Transform into "required key" issue
            return ctx.issueRequiredKey(input, key)
          }
        }

        return result
      }

      if (result.value !== input[key]) {
        // Copy on write
        copy ??= { ...input }
        copy[key] = result.value
      }
    }

    return ctx.success((copy ?? input) as Output)
  }

  stringify(input: unknown): string {
    const urlSearchParams = new URLSearchParams()

    for (const [key, value] of Object.entries(this.parse(input))) {
      if (Array.isArray(value)) {
        for (const v of value) {
          urlSearchParams.append(key, String(v))
        }
      } else if (value === undefined) {
        urlSearchParams.append(key, String(value))
      }
    }

    return urlSearchParams.toString()
  }
}
