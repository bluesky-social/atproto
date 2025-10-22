import {
  Infer,
  ValidationContext,
  ValidationResult,
  Validator,
} from '../core.js'
import { isPureObject } from '../lib/is-object.js'

export type DictSchemaOutput<
  KeySchema extends Validator<string>,
  ValueSchema extends Validator<unknown>,
> = Record<Infer<KeySchema>, Infer<ValueSchema>>

/**
 * @note There is no dictionary in Lexicon schemas. This is a custom extension
 * to allow map-like objects when using the lex library programmatically (i.e.
 * not code generated from a lexicon schema).
 */
export class DictSchema<
  const KeySchema extends Validator<string> = any,
  const ValueSchema extends Validator<unknown> = any,
> extends Validator<DictSchemaOutput<KeySchema, ValueSchema>> {
  constructor(
    readonly keySchema: KeySchema,
    readonly valueSchema: ValueSchema,
  ) {
    super()
  }

  protected override validateInContext(
    input: unknown,
    ctx: ValidationContext,
  ): ValidationResult<DictSchemaOutput<KeySchema, ValueSchema>> {
    if (!isPureObject(input)) {
      return ctx.issueInvalidType(input, 'dict')
    }

    let copy: undefined | Record<string, unknown>

    for (const key in input) {
      const keyResult = ctx.validate(key, this.keySchema)
      if (!keyResult.success) return keyResult

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
