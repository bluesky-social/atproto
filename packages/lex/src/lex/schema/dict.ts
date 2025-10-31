import {
  Infer,
  ValidationContext,
  ValidationResult,
  Validator,
} from '../core.js'
import { isPlainObject } from '../lib/is-object.js'

export type DictSchemaOutput<
  KeySchema extends Validator,
  ValueSchema extends Validator,
> =
  Infer<KeySchema> extends never
    ? Record<string, never>
    : Record<Infer<KeySchema> & string, Infer<ValueSchema>>

/**
 * @note There is no dictionary in Lexicon schemas. This is a custom extension
 * to allow map-like objects when using the lex library programmatically (i.e.
 * not code generated from a lexicon schema).
 */
export class DictSchema<
  const KeySchema extends Validator = any,
  const ValueSchema extends Validator = any,
> extends Validator<DictSchemaOutput<KeySchema, ValueSchema>> {
  constructor(
    readonly keySchema: KeySchema,
    readonly valueSchema: ValueSchema,
  ) {
    super()
  }

  /** @internal **DO NOT USE DIRECTLY** */
  public override validateInContext(
    input: unknown,
    ctx: ValidationContext,
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
