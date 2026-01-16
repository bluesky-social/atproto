import { isPlainObject } from '@atproto/lex-data'
import {
  $Type,
  $Typed,
  $TypedMaybe,
  $typed,
  InferInput,
  InferOutput,
  Schema,
  Unknown$TypedObject,
  ValidationContext,
  Validator,
} from '../core.js'

export class TypedObjectSchema<
  const TType extends $Type = $Type,
  const TShape extends Validator<{ [k: string]: unknown }> = any,
> extends Schema<
  $TypedMaybe<InferInput<TShape>, TType>,
  $TypedMaybe<InferOutput<TShape>, TType>
> {
  constructor(
    readonly $type: TType,
    readonly schema: TShape,
  ) {
    super()
  }

  isTypeOf<X extends Record<string, unknown>>(
    value: X,
  ): value is X extends { $type?: TType }
    ? X
    : $TypedMaybe<Exclude<X, Unknown$TypedObject>, TType> {
    return value.$type === undefined || value.$type === this.$type
  }

  build(
    input: Omit<InferInput<this>, '$type'>,
  ): $Typed<InferOutput<this>, TType> {
    return this.parse($typed(input, this.$type)) as $Typed<
      InferOutput<this>,
      TType
    >
  }

  $isTypeOf<X extends Record<string, unknown>>(value: X) {
    return this.isTypeOf(value)
  }

  $build(input: Omit<InferInput<this>, '$type'>) {
    return this.build(input)
  }

  validateInContext(input: unknown, ctx: ValidationContext) {
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

    return ctx.validate(input, this.schema)
  }
}
