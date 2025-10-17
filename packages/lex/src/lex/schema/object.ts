import {
  Infer,
  LexValidator,
  Simplify,
  ValidationContext,
  ValidationResult,
  hasOwn,
  isObject,
} from '../core.js'
import { cachedGetter } from '../lib/decorators.js'

export type LexObjectUnknownKeysOption = 'strict' | 'strip' | 'passthrough'

export type LexObjectProperties = Record<string, LexValidator>
export type LexObjectOptions = {
  /** @default "passthrough" */
  unknownKeys?: LexObjectUnknownKeysOption

  required?: readonly string[]
  nullable?: readonly string[]
}

export type LexObjectNullProp<
  K extends string,
  O extends LexObjectOptions,
> = O extends { nullable: readonly (infer N extends string)[] }
  ? K extends N
    ? null
    : never
  : never

export type LexObjectOutput<
  P extends LexObjectProperties,
  O extends LexObjectOptions,
> = O extends { required: readonly (infer R extends string)[] }
  ? Simplify<
      {
        -readonly [K in string & keyof P & R]-?:
          | Infer<P[K]>
          | LexObjectNullProp<K, O>
      } & {
        -readonly [K in string & Exclude<keyof P, R>]?:
          | Infer<P[K]>
          | LexObjectNullProp<K, O>
      }
    >
  : {
      -readonly [K in string & keyof P]?: Infer<P[K]> | LexObjectNullProp<K, O>
    }

export class LexObject<
  const Properties extends LexObjectProperties = any,
  const Options extends LexObjectOptions = any,
> extends LexValidator<LexObjectOutput<Properties, Options>> {
  constructor(
    readonly $properties: Properties,
    readonly $options: Options,
  ) {
    super()
  }

  @cachedGetter
  get $propertyEntries(): [string, LexValidator][] {
    return Object.entries(this.$properties)
  }

  @cachedGetter
  get $propertyKeys(): Set<string> {
    return new Set(Object.keys(this.$properties))
  }

  protected override $validateInContext(
    input: unknown,
    ctx: ValidationContext,
  ): ValidationResult<LexObjectOutput<Properties, Options>> {
    if (!isObject(input)) {
      return ctx.issueInvalidType(input, 'object')
    }

    // Lazily copy value
    let copy: undefined | Record<string, unknown>

    const { unknownKeys } = this.$options
    if (unknownKeys === 'strict' || unknownKeys === 'strip') {
      for (const key in input) {
        if (this.$propertyKeys.has(key)) continue

        if (unknownKeys === 'strict' || !ctx.allowTransform) {
          return ctx.issueInvalidPropertyType(
            input,
            key as keyof typeof input,
            'undefined',
          )
        }

        copy ??= { ...input }
        delete copy[key]
      }
    }

    for (const [key, propDef] of this.$propertyEntries) {
      if (!hasOwn(input, key)) {
        if (this.$options.required?.includes(key)) {
          return ctx.issueRequiredKey(input, key)
        }
      } else if (input[key] === null) {
        if (!this.$options.nullable?.includes(key)) {
          return ctx.issueInvalidPropertyType(input, key, 'non-null')
        }
      } else {
        const result = ctx.validateChild(input, key, propDef)
        if (!result.success) return result

        if (result.value !== input[key]) {
          copy ??= { ...input }
          copy[key] = result.value
        }
      }
    }

    return ctx.success((copy ?? input) as LexObjectOutput<Properties, Options>)
  }
}
