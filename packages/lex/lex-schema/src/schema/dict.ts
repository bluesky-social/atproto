import { isPlainObject } from '@atproto/lex-data'
import {
  InferInput,
  InferOutput,
  Schema,
  ValidationContext,
  Validator,
} from '../core.js'

/**
 * Schema for validating dictionary/map-like objects with dynamic keys.
 *
 * Unlike `ObjectSchema` which validates a fixed set of properties, `DictSchema`
 * validates objects where any string key is allowed, with both keys and values
 * validated against their respective schemas.
 *
 * @note There is no dictionary in Lexicon schemas. This is a custom extension
 * to allow map-like objects when using the lex library programmatically (i.e.
 * not code generated from a lexicon schema).
 *
 * @template TKey - The validator type for dictionary keys (must validate strings)
 * @template TValue - The validator type for dictionary values
 *
 * @example
 * ```ts
 * const schema = new DictSchema(l.string(), l.integer())
 * const result = schema.validate({ a: 1, b: 2, c: 3 })
 * ```
 */
export class DictSchema<
  const TKey extends Validator<string> = any,
  const TValue extends Validator = any,
> extends Schema<
  Record<InferInput<TKey>, InferInput<TValue>>,
  Record<InferInput<TKey>, InferOutput<TValue>>
> {
  readonly type = 'dict' as const

  constructor(
    readonly keySchema: TKey,
    readonly valueSchema: TValue,
  ) {
    super()
  }

  validateInContext(
    input: unknown,
    ctx: ValidationContext,
    options?: { ignoredKeys?: { has(k: string): boolean } },
  ) {
    if (!isPlainObject(input)) {
      return ctx.issueUnexpectedType(input, 'dict')
    }

    let copy: undefined | Record<string, unknown>

    for (const key in input) {
      if (options?.ignoredKeys?.has(key)) continue

      const keyResult = ctx.validate(key, this.keySchema)
      if (!keyResult.success) return keyResult
      if (keyResult.value !== key) {
        // We can't safely "move" the key to a different name in the output
        // object (because there may already be something there), so we issue a
        // "required key" error if the key validation changes the key
        return ctx.issueRequiredKey(input, key)
      }

      const valueResult = ctx.validateChild(input, key, this.valueSchema)
      if (!valueResult.success) return valueResult

      if (!Object.is(valueResult.value, input[key])) {
        if (ctx.options.mode === 'validate') {
          // In "validate" mode, we can't modify the input, so we issue an error
          return ctx.issueInvalidPropertyValue(input, key, [valueResult.value])
        }

        copy ??= { ...input }
        copy[key] = valueResult.value
      }
    }

    return ctx.success(copy ?? input)
  }
}

/**
 * Creates a dictionary schema for validating map-like objects.
 *
 * Validates objects where all keys match the key schema and all values
 * match the value schema. Useful for dynamic key-value mappings.
 *
 * @param key - Schema to validate each key (must be a string validator)
 * @param value - Schema to validate each value
 * @returns A new {@link DictSchema} instance
 *
 * @example
 * ```ts
 * // String to number mapping
 * const scoresSchema = l.dict(l.string(), l.integer())
 * scoresSchema.parse({ alice: 100, bob: 85 })
 *
 * // Constrained keys
 * const langSchema = l.dict(
 *   l.string({ minLength: 2, maxLength: 5 }), // Language codes
 *   l.string() // Translations
 * )
 *
 * // Complex values
 * const usersById = l.dict(
 *   l.string({ format: 'did' }),
 *   l.object({ name: l.string(), age: l.integer() })
 * )
 * ```
 */
/*@__NO_SIDE_EFFECTS__*/
export function dict<
  const TKey extends Validator<string>,
  const TValue extends Validator,
>(key: TKey, value: TValue) {
  return new DictSchema<TKey, TValue>(key, value)
}
