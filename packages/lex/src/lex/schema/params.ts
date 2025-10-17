import {
  LexValidator,
  ValidationContext,
  ValidationResult,
  hasOwn,
  isPureObject,
} from '../core.js'
import { cachedGetter } from '../lib/decorators.js'
import { LexParameterValue, lexParameterSchema } from './_parameters.js'
import { LexObjectOutput, LexObjectUnknownKeysOption } from './object.js'

export type LexParamsProperties = Record<
  string,
  LexValidator<LexParameterValue>
>

export type LexParamsOptions = {
  /** @default "passthrough" */
  unknownKeys?: LexObjectUnknownKeysOption

  required?: readonly string[]
}

export type InferLexParamsOptions<
  P extends LexParamsProperties,
  O extends LexParamsOptions,
> = LexObjectOutput<P, O>

export type InferLexParams<T> =
  T extends LexParams<infer P, infer O>
    ? // TODO verify this still works as intended (used to be "{}" instead of "Record<string, never>")
      Record<string, never> extends InferLexParamsOptions<P, O>
      ? InferLexParamsOptions<P, O> | undefined
      : InferLexParamsOptions<P, O>
    : never

export class LexParams<
  const Validators extends LexParamsProperties = any,
  const Options extends LexParamsOptions = any,
  Output extends InferLexParamsOptions<
    Validators,
    Options
  > = InferLexParamsOptions<Validators, Options>,
> extends LexValidator<Output> {
  constructor(
    readonly $properties: Validators,
    readonly $options: Options,
  ) {
    super()
  }

  @cachedGetter
  get $propertyEntries(): [string, LexValidator][] {
    const entries = Object.entries(this.$properties)

    // Optimization: sort required keys first for faster failure
    const { required } = this.$options
    if (required?.length) entries.sort(requiredEntriesCmp.bind(required))

    return entries
  }

  @cachedGetter
  get $propertyKeys(): Set<string> {
    return new Set(Object.keys(this.$properties))
  }

  protected override $validateInContext(
    input: unknown = {},
    ctx: ValidationContext,
  ): ValidationResult<Output> {
    if (!isPureObject(input)) {
      return ctx.issueInvalidType(input, 'object')
    }

    // Lazily copy value
    let copy: undefined | Record<string, unknown>

    const { unknownKeys } = this.$options
    for (const key in input) {
      if (this.$propertyKeys.has(key)) continue

      if (unknownKeys === 'strict') {
        return ctx.issueInvalidPropertyType(input, key, 'undefined')
      } else if (unknownKeys === 'strip') {
        copy ??= { ...input }
        delete copy[key]
      } else {
        // "passthrough", ensure that params are valid
        const result = ctx.validateChild(input, key, lexParameterSchema)
        if (!result.success) return result

        if (result.value !== input[key]) {
          copy ??= { ...input }
          copy[key] = result.value
        }
      }
    }

    for (const [key, propDef] of this.$propertyEntries) {
      if (!hasOwn(input, key)) {
        if (this.$options.required?.includes(key)) {
          return ctx.issueRequiredKey(input, key)
        }
      } else {
        const result = ctx.validateChild(input, key, propDef)
        if (!result.success) return result

        if (result.value !== input[key]) {
          // Copy on write
          copy ??= { ...input }
          copy[key] = result.value
        }
      }
    }

    return ctx.success((copy ?? input) as Output)
  }

  $stringify(input: unknown): string {
    const urlSearchParams = new URLSearchParams()

    for (const [key, value] of Object.entries(this.$parse(input))) {
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

function requiredEntriesCmp(
  this: readonly string[],
  a: [string, unknown],
  b: [string, unknown],
) {
  return boolCmp(this.includes(a[0]), this.includes(b[0]))
}

function boolCmp(a: boolean, b: boolean) {
  return (a === b ? 0 : a ? -1 : 1) as -1 | 0 | 1
}
