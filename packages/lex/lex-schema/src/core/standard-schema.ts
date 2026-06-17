import { StandardSchemaV1 } from '@standard-schema/spec'
import { ValidationContext, Validator } from './validator.js'

/**
 * The Standard Schema adapter for {@link Validator} instances.
 */
export class StandardSchemaAdapter<TInput, TOutput>
  implements StandardSchemaV1.Props<TInput, TOutput>
{
  readonly version = 1

  readonly vendor = '@atproto/lex-schema'

  declare readonly types: StandardSchemaV1.Types<TInput, TOutput>

  constructor(private readonly validator: Validator<TInput, TOutput>) {}

  validate(
    value: unknown,
    options?: StandardSchemaV1.Options,
  ): StandardSchemaV1.Result<TOutput> {
    // Perform validation in "parse" mode to ensure transformations (defaults,
    // coercions, etc.) are applied. Also ensures that the output type is
    // returned. Note that ValidationResult is compatible with
    // StandardSchemaV1.Result :-)
    return ValidationContext.validate(value, this.validator, {
      ...options?.libraryOptions,
      mode: 'parse',
    })
  }
}
