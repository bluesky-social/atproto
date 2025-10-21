import {
  Infer,
  Simplify,
  ValidationContext,
  ValidationResult,
  Validator,
  isPureObject,
} from '../core.js'
import { cachedGetter } from '../lib/decorators.js'

export type ObjectSchemaUnknownKeysOption = 'strict' | 'passthrough'

export type ObjectSchemaProperties = Record<string, Validator>
export type ObjectSchemaOptions = {
  /** @default "passthrough" */
  unknownKeys?: ObjectSchemaUnknownKeysOption

  required?: readonly string[]
  nullable?: readonly string[]
}

export type ObjectSchemaNullValue<
  O extends ObjectSchemaOptions,
  K extends string,
> = O extends { nullable: readonly (infer N extends string)[] }
  ? K extends N
    ? null
    : never
  : never

export type ObjectSchemaOutput<
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

    if (this.options.unknownKeys === 'strict') {
      for (const key in input) {
        if (this.validatorsMap.has(key)) continue

        return ctx.issueInvalidPropertyType(input, key, ['undefined'])
      }
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

    const output = (copy ?? input) as ObjectSchemaOutput<Validators, Options>

    return ctx.success(output)
  }
}
