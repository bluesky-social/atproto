import {
  ValidationContext,
  ValidationResult,
  Validator,
  hasOwn,
  isPureObject,
} from '../core.js'
import { cachedGetter } from '../lib/decorators.js'
import { Parameter, parameterSchema } from './_parameters.js'
import { ObjectSchemaOutput, ObjectSchemaUnknownKeysOption } from './object.js'

export type ParamsSchemaProperties = Record<string, Validator<Parameter>>

export type ParamsSchemaOptions = {
  /** @default "passthrough" */
  unknownKeys?: ObjectSchemaUnknownKeysOption

  required?: readonly string[]
}

export type InferParamsSchemaOptions<
  P extends ParamsSchemaProperties,
  O extends ParamsSchemaOptions,
> = ObjectSchemaOutput<P, O>

export type InferParamsSchema<T> =
  T extends ParamsSchema<infer P, infer O>
    ? // TODO verify this still works as intended (used to be "{}" instead of "Record<string, never>")
      Record<string, never> extends InferParamsSchemaOptions<P, O>
      ? InferParamsSchemaOptions<P, O> | undefined
      : InferParamsSchemaOptions<P, O>
    : never

export class ParamsSchema<
  const Validators extends ParamsSchemaProperties = any,
  const Options extends ParamsSchemaOptions = any,
  Output extends InferParamsSchemaOptions<
    Validators,
    Options
  > = InferParamsSchemaOptions<Validators, Options>,
> extends Validator<Output> {
  constructor(
    readonly validators: Validators,
    readonly options: Options,
  ) {
    super()
  }

  @cachedGetter
  get validatorsMap(): Map<string, Validator<Parameter>> {
    return new Map(Object.entries(this.validators))
  }

  @cachedGetter
  get knownKeys(): Set<string> {
    return new Set(Object.keys(this.validators))
  }

  protected override validateInContext(
    input: unknown = {},
    ctx: ValidationContext,
  ): ValidationResult<Output> {
    if (!isPureObject(input)) {
      return ctx.issueInvalidType(input, 'object')
    }

    if (this.options.required) {
      for (const prop in this.options.required) {
        if (!hasOwn(input, prop)) {
          return ctx.issueRequiredKey(input, prop)
        }
      }
    }

    // Lazily copy value
    let copy: undefined | Record<string, unknown>

    for (const key in input) {
      if (this.knownKeys.has(key)) continue

      if (this.options.unknownKeys === 'strict') {
        return ctx.issueInvalidPropertyType(input, key, 'undefined')
      } else {
        // In "passthrough" mode we still need to ensure that params are valid
        const result = ctx.validateChild(input, key, parameterSchema)
        if (!result.success) return result

        if (result.value !== input[key]) {
          copy ??= { ...input }
          copy[key] = result.value
        }
      }
    }

    for (const [key, propDef] of this.validatorsMap) {
      if (!hasOwn(input, key)) {
        continue
      }

      const result = ctx.validateChild(input, key, propDef)
      if (!result.success) return result

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
