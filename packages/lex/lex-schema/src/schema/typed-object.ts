import { isPlainObject } from '@atproto/lex-data'
import {
  $Type,
  $TypeOf,
  $Typed,
  $TypedMaybe,
  $type,
  $typed,
  InferInput,
  InferOutput,
  NsidString,
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

/**
 * This function offers two overloads:
 * - One that allows creating a {@link TypedObjectSchema}, and infer the output
 *   type from the provided arguments, without requiring to specify any of the
 *   generics. This is useful when you want to define a record without
 *   explicitly defining its interface. This version does not support circular
 *   references, as TypeScript cannot infer types in such cases.
 * - One allows creating a {@link TypedObjectSchema} with an explicitly defined
 *   interface. This will typically be used by codegen (`lex build`) to generate
 *   schemas that work even if they contain circular references.
 */
export function typedObject<
  const N extends NsidString,
  const H extends string,
  const S extends Validator<{ [k: string]: unknown }>,
>(nsid: N, hash: H, validator: S): TypedObjectSchema<$Type<N, H>, S>
export function typedObject<V extends { $type?: $Type }>(
  nsid: V extends { $type?: infer T extends string }
    ? T extends `${infer N}#${string}`
      ? N
      : T // (T is a "main" type, so already an NSID)
    : never,
  hash: V extends { $type?: infer T extends string }
    ? T extends `${string}#${infer H}`
      ? H
      : 'main'
    : never,
  validator: Validator<Omit<V, '$type'>>,
): TypedObjectSchema<$TypeOf<V>, Validator<V>>
/*@__NO_SIDE_EFFECTS__*/
export function typedObject<
  const N extends NsidString,
  const H extends string,
  const S extends Validator<{ [k: string]: unknown }>,
>(nsid: N, hash: H, validator: S) {
  return new TypedObjectSchema<$Type<N, H>, S>($type(nsid, hash), validator)
}
