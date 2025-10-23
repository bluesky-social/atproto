import {
  Infer,
  Simplify,
  ValidationContext,
  ValidationResult,
  Validator,
} from '../core.js'
import { cachedGetter } from '../lib/decorators.js'
import { isPureObject } from '../lib/is-object.js'
import { DictSchema } from './dict.js'

export type ObjectSchemaProperties = Record<string, Validator>
export type ObjectSchemaOptions = {
  required?: readonly string[]
  nullable?: readonly string[]
  unknownProperties?: DictSchema
}

export type ObjectSchemaNullValue<
  O extends ObjectSchemaOptions,
  K extends string,
> = O extends { nullable: readonly (infer N extends string)[] }
  ? K extends N
    ? null
    : never
  : never

export type ObjectSchemaPropertiesOutput<
  P extends ObjectSchemaProperties,
  O extends ObjectSchemaOptions,
> = O extends { required: readonly (infer R extends string)[] }
  ? Simplify<
      {
        -readonly [K in string & keyof P & R]-?:
          | Infer<P[K]>
          | ObjectSchemaNullValue<O, K>
      } & {
        -readonly [K in Exclude<string & keyof P, R>]?:
          | Infer<P[K]>
          | ObjectSchemaNullValue<O, K>
      }
    >
  : {
      -readonly [K in string & keyof P]?:
        | Infer<P[K]>
        | ObjectSchemaNullValue<O, K>
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
  ? Intersect<ObjectSchemaPropertiesOutput<P, O>, D>
  : ObjectSchemaPropertiesOutput<P, O>

export class ObjectSchema<
  const Validators extends ObjectSchemaProperties = any,
  const Options extends ObjectSchemaOptions = any,
> extends Validator<ObjectSchemaOutput<Validators, Options>> {
  constructor(
    readonly validators: Validators,
    readonly options: Options,
  ) {
    super()
  }

  @cachedGetter
  get validatorsMap(): Map<string, Validator> {
    return new Map(Object.entries(this.validators))
  }

  protected override validateInContext(
    input: unknown,
    ctx: ValidationContext,
  ): ValidationResult<ObjectSchemaOutput<Validators, Options>> {
    if (!isPureObject(input)) {
      return ctx.issueInvalidType(input, ['object'])
    }

    // Lazily copy value
    let copy: undefined | Record<string, unknown>

    for (const [key, propDef] of this.validatorsMap) {
      if (input[key] === null && this.options.nullable?.includes(key)) {
        continue
      }

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
      } else if (result.value === undefined) {
        // Special case for validators that output "undefined" values (typically
        // UnknownSchema) since they cannot differentiate between "missing key"
        // and "key with undefined value"

        if (!(key in input)) {
          // Input was missing the key (was "undefined")
          if (this.options.required?.includes(key)) {
            return ctx.issueRequiredKey(input, key)
          }

          // Ignore missing non-required key
          continue
        }

        // if "key" existed in input (would typically be "undefined"), we keep
        // it as-is by continuing processing as if it was any other value.
      }

      if (result.value !== input[key]) {
        copy ??= { ...input }
        copy[key] = result.value
      }
    }

    if (this.options.unknownProperties) {
      const result = this.options.unknownProperties.validateInContext(
        copy ?? input,
        ctx,
        { ignoredKeys: this.validatorsMap },
      )
      if (!result.success) return result
      if (result.value !== input) copy = result.value
    }

    const output = (copy ?? input) as ObjectSchemaOutput<Validators, Options>

    return ctx.success(output)
  }
}
