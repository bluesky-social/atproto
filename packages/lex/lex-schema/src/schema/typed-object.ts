import { isPlainObject } from '@atproto/lex-data'
import {
  $Type,
  $Typed,
  $TypedMaybe,
  Infer,
  Schema,
  ValidationResult,
  Validator,
  ValidatorContext,
} from '../core.js'
import { TypedObject } from './typed-union.js'

export type TypedObjectSchemaOutput<
  T extends $Type,
  S extends Validator<{ [k: string]: unknown }>,
> = $TypedMaybe<Infer<S>, T>

export class TypedObjectSchema<
  const T extends $Type = any,
  const S extends Validator<{ [k: string]: unknown }> = any,
> extends Schema<TypedObjectSchemaOutput<T, S>> {
  constructor(
    readonly $type: T,
    readonly schema: S,
  ) {
    super()
  }

  isTypeOf<X extends Record<string, unknown>>(
    value: X,
  ): value is Exclude<
    X extends { $type?: T } ? X : $TypedMaybe<X, T>,
    TypedObject
  > {
    return value.$type === undefined || value.$type === this.$type
  }

  build<X extends Omit<Infer<S>, '$type'>>(
    input: X,
  ): $Typed<Omit<X, '$type'>, T> {
    return input.$type === this.$type
      ? (input as $Typed<X, T>)
      : { ...input, $type: this.$type }
  }

  $isTypeOf<X extends Record<string, unknown>>(value: X) {
    return this.isTypeOf(value)
  }

  $build<X extends Omit<Infer<S>, '$type'>>(input: X) {
    return this.build<X>(input)
  }

  validateInContext(
    input: unknown,
    ctx: ValidatorContext,
  ): ValidationResult<TypedObjectSchemaOutput<T, S>> {
    if (!isPlainObject(input)) {
      return ctx.issueInvalidType(input, 'object')
    }

    if (
      '$type' in input &&
      input.$type !== undefined &&
      input.$type !== this.$type
    ) {
      return ctx.issueInvalidPropertyValue(input, '$type', [this.$type])
    }

    return ctx.validate(input, this.schema) as ValidationResult<
      TypedObjectSchemaOutput<T, S>
    >
  }
}
