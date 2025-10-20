import {
  Infer,
  Simplify,
  ValidationContext,
  ValidationResult,
  Validator,
  hasOwn,
  isObject,
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

export type ObjectSchemaNullProp<
  K extends string,
  O extends ObjectSchemaOptions,
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
          | ObjectSchemaNullProp<K, O>
      } & {
        -readonly [K in string & Exclude<keyof P, R>]?:
          | Infer<P[K]>
          | ObjectSchemaNullProp<K, O>
      }
    >
  : {
      -readonly [K in string & keyof P]?:
        | Infer<P[K]>
        | ObjectSchemaNullProp<K, O>
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
    if (!isObject(input)) {
      return ctx.issueInvalidType(input, 'object')
    }

    if (this.options.required) {
      for (const prop in this.options.required) {
        if (!hasOwn(input, prop)) {
          return ctx.issueRequiredKey(input, prop)
        }
      }
    }

    if (this.options.unknownKeys === 'strict') {
      for (const key in input) {
        if (this.validatorsMap.has(key)) continue

        return ctx.issueInvalidPropertyType(
          input,
          key as keyof typeof input,
          'undefined',
        )
      }
    }

    // Lazily copy value
    let copy: undefined | Record<string, unknown>

    for (const [key, propDef] of this.validatorsMap) {
      if (!hasOwn(input, key)) {
        continue
      }

      if (input[key] === null && this.options.nullable?.includes(key)) {
        continue
      }

      const result = ctx.validateChild(input, key, propDef)
      if (!result.success) return result

      if (result.value !== input[key]) {
        copy ??= { ...input }
        copy[key] = result.value
      }
    }

    return ctx.success(
      (copy ?? input) as ObjectSchemaOutput<Validators, Options>,
    )
  }
}
