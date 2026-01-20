import { isPlainObject } from '@atproto/lex-data'
import {
  InferInput,
  InferOutput,
  Schema,
  ValidationContext,
  Validator,
} from '../core.js'

/**
 * @note There is no dictionary in Lexicon schemas. This is a custom extension
 * to allow map-like objects when using the lex library programmatically (i.e.
 * not code generated from a lexicon schema).
 */
export class DictSchema<
  const TKey extends Validator<string> = any,
  const TValue extends Validator = any,
> extends Schema<
  Record<InferInput<TKey>, InferInput<TValue>>,
  Record<InferInput<TKey>, InferOutput<TValue>>
> {
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
      return ctx.issueInvalidType(input, 'dict')
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

/*@__NO_SIDE_EFFECTS__*/
export function dict<
  const TKey extends Validator<string>,
  const TValue extends Validator,
>(key: TKey, value: TValue) {
  return new DictSchema<TKey, TValue>(key, value)
}
