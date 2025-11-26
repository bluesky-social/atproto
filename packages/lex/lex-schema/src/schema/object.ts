import { isPlainObject } from '@atproto/lex-data'
import { Simplify } from '../core.js'
import {
  Infer,
  ValidationResult,
  Validator,
  ValidatorContext,
} from '../validation.js'
import { DictSchema } from './dict.js'

export type ObjectSchemaProperties = Record<string, Validator>
export type ObjectSchemaOptions = {
  readonly required?: readonly string[]
  readonly unknownProperties?: 'strict' | DictSchema
}

export type ObjectSchemaPropertiesOutput<
  P extends ObjectSchemaProperties,
  O extends ObjectSchemaOptions,
> = O extends { readonly required: readonly (infer R extends string)[] }
  ? {
      -readonly [K in string & keyof P & R]-?: Infer<P[K]>
    } & {
      -readonly [K in Exclude<string & keyof P, R>]?: Infer<P[K]>
    }
  : {
      -readonly [K in string & keyof P]?: Infer<P[K]>
    }

/**
 * Allows to more accurately represent the intersection of two object types
 * where both types may share some keys, and one of them uses an index
 * signature.
 *
 * @see {@link https://www.typescriptlang.org/play/?#code/C4TwDgpgBAglC8UDeUBmB7dAuKByARgIYBOuUAvlAGTJQDaA+lAJYB2UAzsMWwOYC6OVgFcAtvgjEKAKGkATCAGMANiWiL0rLlEI4YsjVuBQA1hBA4uPVrwRQARBnT2Dm7QDdCy4dESE6ZiD8UAD0IVAi4pJQABQcABbowspyUBIORMT2AJSyEAAeYOjExqCQUACSrMCSHErAzJoAPNJQsFAFNaxyHFAASkrFck1WfAA0UMKsJqzoAO6sAHxjrVAAQh35XT39g8TDozYTUzPzSyuLdqtwVKttMYHoqO00j88bnRDdvawQ7pJ3NpQAD860BbRwSHBQLadAA0ix2G91oJ1vDggAfWABcxPF5QOH8aFtci5aRlaAwVDMfIQVKIKo1Yh1RQNZq0Jw4AgkMjkCYoRiIzjcPioyISKTkRayBQqNRQQzaQgAMRpdL01NpclcRignm8EFVWrsKrVchxQVC4XF0SxmSAA Playground link}
 */
type Intersect<
  A extends Record<string, unknown>,
  B extends Record<string, unknown>,
> = B[keyof B] extends never
  ? A
  : keyof A & keyof B extends never
    ? // If A and B don't overlap, just return A & B
      A & B
    : // Otherwise, properly represent the fact that accessing using an
      // index signature could return a value from either A or B
      A & { [K in keyof B]: B[K] | A[keyof A & K] }

export type ObjectSchemaOutput<
  P extends ObjectSchemaProperties,
  O extends ObjectSchemaOptions,
> = O extends {
  unknownProperties: Validator<infer D extends Record<string, unknown>>
}
  ? Simplify<Intersect<ObjectSchemaPropertiesOutput<P, O>, D>>
  : Simplify<ObjectSchemaPropertiesOutput<P, O>>

export class ObjectSchema<
  const Validators extends ObjectSchemaProperties = any,
  const Options extends ObjectSchemaOptions = any,
  const Output extends ObjectSchemaOutput<
    Validators,
    Options
  > = ObjectSchemaOutput<Validators, Options>,
> extends Validator<Output> {
  constructor(
    readonly validators: Validators,
    readonly options: Options,
  ) {
    super()
  }

  get validatorsMap(): Map<string, Validator> {
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
    input: unknown,
    ctx: ValidatorContext,
  ): ValidationResult<Output> {
    if (!isPlainObject(input)) {
      return ctx.issueInvalidType(input, ['object'])
    }

    // Lazily copy value
    let copy: undefined | Record<string, unknown>

    for (const [key, propDef] of this.validatorsMap) {
      const result = ctx.validateChild(input, key, propDef)
      if (!result.success) {
        // Because default values are provided by child validators, we need to
        // run the validator to get the default value and, in case of failure,
        // ignore validation error that were caused by missing keys.
        if (!(key in input)) {
          if (this.options.required?.includes(key)) {
            // Transform into "required key" issue
            return ctx.issueRequiredKey(input, key)
          }

          // Ignore missing non-required key
          continue
        }

        return result
      }

      // Skip copying if key is not present in input (and value is undefined)
      if (result.value === undefined && !(key in input)) {
        // Except if the key is required
        if (this.options.required?.includes(key)) {
          return ctx.issueRequiredKey(input, key)
        }

        continue
      }

      if (result.value !== input[key]) {
        copy ??= { ...input }
        copy[key] = result.value
      }
    }

    if (this.options.unknownProperties === 'strict') {
      for (const key of Object.keys(input)) {
        if (!this.validatorsMap.has(key)) {
          return ctx.issueInvalidPropertyType(input, key, 'undefined')
        }
      }
    } else if (this.options.unknownProperties) {
      const result = this.options.unknownProperties.validateInContext(
        copy ?? input,
        ctx,
        { ignoredKeys: this.validatorsMap },
      )
      if (!result.success) return result
      if (result.value !== input) copy = result.value
    }

    const output = (copy ?? input) as Output

    return ctx.success(output)
  }
}
