import { isPlainObject } from '@atproto/lex-data'
import {
  Infer,
  Schema,
  ValidationResult,
  Validator,
  ValidatorContext,
} from '../core.js'

export type DictSchemaOutput<
  KeySchema extends Validator<string>,
  ValueSchema extends Validator,
> = Record<Infer<KeySchema>, Infer<ValueSchema>>

/**
 * @note There is no dictionary in Lexicon schemas. This is a custom extension
 * to allow map-like objects when using the lex library programmatically (i.e.
 * not code generated from a lexicon schema).
 */
export class DictSchema<
  const KeySchema extends Validator<string> = any,
  const ValueSchema extends Validator = any,
> extends Schema<DictSchemaOutput<KeySchema, ValueSchema>> {
  constructor(
    readonly keySchema: KeySchema,
    readonly valueSchema: ValueSchema,
  ) {
    super()
  }

  validateInContext(
    input: unknown,
    ctx: ValidatorContext,
    options?: { ignoredKeys?: { has(k: string): boolean } },
  ): ValidationResult<DictSchemaOutput<KeySchema, ValueSchema>> {
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

      if (valueResult.value !== input[key]) {
        copy ??= { ...input }
        copy[key] = valueResult.value
      }
    }

    return ctx.success(
      (copy ?? input) as DictSchemaOutput<KeySchema, ValueSchema>,
    )
  }
}
