import {
  $Type,
  $TypeOf,
  $type,
  InferInput,
  LexiconRecordKey,
  NsidString,
  PropertyKey,
  Schema,
  Validator,
} from './core.js'
import {
  ArraySchema,
  ArraySchemaOptions,
  BlobSchema,
  BlobSchemaOptions,
  BooleanSchema,
  BytesSchema,
  BytesSchemaOptions,
  CidSchema,
  CidSchemaOptions,
  CustomAssertion,
  CustomSchema,
  DictSchema,
  DiscriminatedUnionSchema,
  DiscriminatedUnionVariants,
  EnumSchema,
  IntegerSchema,
  IntegerSchemaOptions,
  IntersectionSchema,
  LiteralSchema,
  NeverSchema,
  NullSchema,
  NullableSchema,
  ObjectSchema,
  ObjectSchemaShape,
  OptionalSchema,
  ParamsSchema,
  ParamsSchemaShape,
  Payload,
  PayloadShape,
  Permission,
  PermissionOptions,
  PermissionSet,
  PermissionSetOptions,
  Procedure,
  Query,
  RecordSchema,
  RefSchema,
  RefSchemaGetter,
  RegexpSchema,
  StringSchema,
  StringSchemaOptions,
  Subscription,
  TokenSchema,
  TypedObjectSchema,
  TypedObjectValidator,
  TypedRefGetter,
  TypedRefSchema,
  TypedUnionSchema,
  UnionSchema,
  UnionSchemaValidators,
  UnknownObjectSchema,
  UnknownSchema,
  WithDefaultSchema,
  refine,
} from './schema.js'
import { memoizedOptions, memoizedTransformer } from './util/memoize.js'

export * from './core.js'
export * from './helpers.js'
export * from './schema.js'

export { _null as null }

export const never = /*#__PURE__*/ memoizedOptions(function () {
  return new NeverSchema()
})

export const unknown = /*#__PURE__*/ memoizedOptions(function () {
  return new UnknownSchema()
})

const _null = /*#__PURE__*/ memoizedOptions(function () {
  return new NullSchema()
})

/*@__NO_SIDE_EFFECTS__*/
export function literal<const V extends null | string | number | boolean>(
  value: V,
) {
  return new LiteralSchema<V>(value)
}

/*@__NO_SIDE_EFFECTS__*/
export function _enum<const V extends null | string | number | boolean>(
  value: readonly V[],
) {
  return new EnumSchema<V>(value)
}

// @NOTE "enum" is a reserved keyword in JS/TS
export { _enum as enum }

export const boolean = /*#__PURE__*/ memoizedOptions(function () {
  return new BooleanSchema()
})

export const integer = /*#__PURE__*/ memoizedOptions(function (
  options?: IntegerSchemaOptions,
) {
  return new IntegerSchema(options)
})

export const cidLink = /*#__PURE__*/ memoizedOptions(function <
  O extends CidSchemaOptions = NonNullable<unknown>,
>(options: O = {} as O) {
  return new CidSchema(options)
})

export const bytes = /*#__PURE__*/ memoizedOptions(function (
  options?: BytesSchemaOptions,
) {
  return new BytesSchema(options)
})

export const blob = /*#__PURE__*/ memoizedOptions(function <
  O extends BlobSchemaOptions = NonNullable<unknown>,
>(options: O = {} as O) {
  return new BlobSchema(options)
})

export const string = /*#__PURE__*/ memoizedOptions(function <
  const O extends StringSchemaOptions = NonNullable<unknown>,
>(options: StringSchemaOptions & O = {} as O) {
  return new StringSchema<O>(options)
})

/*@__NO_SIDE_EFFECTS__*/
export function regexp<TInput extends string = string>(pattern: RegExp) {
  return new RegexpSchema<TInput>(pattern)
}

/*@__NO_SIDE_EFFECTS__*/
export function array<const TValidator extends Validator>(
  items: TValidator,
  options?: ArraySchemaOptions,
): ArraySchema<TValidator>
export function array<
  const TValue,
  const TValidator extends Validator<TValue> = Validator<TValue>,
>(items: TValidator, options?: ArraySchemaOptions): ArraySchema<TValidator>
export function array<const TValidator extends Validator>(
  items: TValidator,
  options?: ArraySchemaOptions,
) {
  return new ArraySchema<TValidator>(items, options)
}

/*@__NO_SIDE_EFFECTS__*/
export function object<const P extends ObjectSchemaShape>(properties: P) {
  return new ObjectSchema<P>(properties)
}

/*@__NO_SIDE_EFFECTS__*/
export function dict<
  const TKey extends Validator<string>,
  const TValue extends Validator,
>(key: TKey, value: TValue) {
  return new DictSchema<TKey, TValue>(key, value)
}

// Utility
export const unknownObject = /*#__PURE__*/ memoizedOptions(function () {
  return new UnknownObjectSchema()
})

/*@__NO_SIDE_EFFECTS__*/
export function ref<const TValidator extends Validator>(
  get: RefSchemaGetter<TValidator>,
): RefSchema<TValidator>
export function ref<TInput, TOutput extends TInput = TInput>(
  get: RefSchemaGetter<Validator<TInput, TOutput>>,
): RefSchema<Validator<TInput, TOutput>>
export function ref<const TValidator extends Validator>(
  get: RefSchemaGetter<TValidator>,
) {
  return new RefSchema<TValidator>(get)
}

/*@__NO_SIDE_EFFECTS__*/
export function custom<TValue>(
  assertion: CustomAssertion<TValue>,
  message: string,
  path?: PropertyKey | readonly PropertyKey[],
) {
  return new CustomSchema<TValue>(assertion, message, path)
}

export const nullable = /*#__PURE__*/ memoizedTransformer(function <
  const TValidator extends Validator,
>(validator: TValidator) {
  return new NullableSchema<TValidator>(validator)
})

export const optional = /*#__PURE__*/ memoizedTransformer(function <
  const TValidator extends Validator,
>(validator: TValidator) {
  return new OptionalSchema<TValidator>(validator)
})

export function withDefault<const TValidator extends Validator>(
  validator: TValidator,
  defaultValue: InferInput<TValidator>,
) {
  return new WithDefaultSchema<TValidator>(validator, defaultValue)
}

/*@__NO_SIDE_EFFECTS__*/
export function union<const TValidators extends UnionSchemaValidators>(
  validators: TValidators,
) {
  return new UnionSchema<TValidators>(validators)
}

/*@__NO_SIDE_EFFECTS__*/
export function intersection<
  const Left extends ObjectSchema,
  const Right extends DictSchema,
>(left: Left, right: Right) {
  return new IntersectionSchema<Left, Right>(left, right)
}

export { refine }

/*@__NO_SIDE_EFFECTS__*/
export function discriminatedUnion<
  const Discriminator extends string,
  const Options extends DiscriminatedUnionVariants<Discriminator>,
>(discriminator: Discriminator, variants: Options) {
  return new DiscriminatedUnionSchema<Discriminator, Options>(
    discriminator,
    variants,
  )
}

/*@__NO_SIDE_EFFECTS__*/
export function token<const N extends NsidString, const H extends string>(
  nsid: N,
  hash: H,
) {
  return new TokenSchema($type(nsid, hash))
}

/*@__NO_SIDE_EFFECTS__*/
export function typedRef<const TValidator extends TypedObjectValidator>(
  get: TypedRefGetter<TValidator>,
): TypedRefSchema<TValidator>
export function typedRef<
  TInput extends { $type?: string },
  TOutput extends TInput = TInput,
>(
  get: TypedRefGetter<TypedObjectValidator<TInput, TOutput>>,
): TypedRefSchema<TypedObjectValidator<TInput, TOutput>>
export function typedRef<const TValidator extends TypedObjectValidator>(
  get: TypedRefGetter<TValidator>,
): TypedRefSchema<TValidator> {
  return new TypedRefSchema<TValidator>(get)
}

/*@__NO_SIDE_EFFECTS__*/
export function typedUnion<
  const R extends readonly TypedRefSchema[],
  const C extends boolean,
>(refs: R, closed: C) {
  return new TypedUnionSchema<R, C>(refs, closed)
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

/**
 * Ensures that a `$type` used in a record is a valid NSID (i.e. no fragment).
 */
type AsNsid<T> = T extends `${string}#${string}` ? never : T

/**
 * This function offers two overloads:
 * - One that allows creating a {@link RecordSchema}, and infer the output type
 *   from the provided arguments, without requiring to specify any of the
 *   generics. This is useful when you want to define a record without
 *   explicitly defining its interface. This version does not support circular
 *   references, as TypeScript cannot infer types in such cases.
 * - One allows creating a {@link RecordSchema} with an explicitly defined
 *   interface. This will typically be used by codegen (`lex build`) to generate
 *   schemas that work even if they contain circular references.
 */
export function record<
  const K extends LexiconRecordKey,
  const T extends NsidString,
  const S extends Validator<{ [k: string]: unknown }>,
>(key: K, type: AsNsid<T>, validator: S): RecordSchema<K, T, S>
export function record<
  const K extends LexiconRecordKey,
  const V extends { $type: NsidString },
>(
  key: K,
  type: AsNsid<V['$type']>,
  validator: Validator<Omit<V, '$type'>>,
): RecordSchema<K, V['$type'], Validator<Omit<V, '$type'>>>
/*@__NO_SIDE_EFFECTS__*/
export function record<
  const K extends LexiconRecordKey,
  const T extends NsidString,
  const S extends Validator<{ [k: string]: unknown }>,
>(key: K, type: T, validator: S) {
  return new RecordSchema<K, T, S>(key, type, validator)
}

export const params = /*#__PURE__*/ memoizedOptions(function <
  const P extends ParamsSchemaShape = NonNullable<unknown>,
>(properties: P = {} as P) {
  return new ParamsSchema<P>(properties)
})

/*@__NO_SIDE_EFFECTS__*/
export function payload<
  const E extends string | undefined = undefined,
  const S extends PayloadShape<E> = undefined,
>(encoding: E = undefined as E, validator: S = undefined as S) {
  return new Payload<E, S>(encoding, validator)
}

/*@__NO_SIDE_EFFECTS__*/
export function jsonPayload<const P extends ObjectSchemaShape>(
  properties: P,
): Payload<'application/json', ObjectSchema<P>> {
  return payload('application/json', object(properties))
}

/*@__NO_SIDE_EFFECTS__*/
export function query<
  const N extends NsidString,
  const P extends ParamsSchema,
  const O extends Payload,
  const E extends undefined | readonly string[] = undefined,
>(nsid: N, parameters: P, output: O, errors: E = undefined as E) {
  return new Query<N, P, O, E>(nsid, parameters, output, errors)
}

/*@__NO_SIDE_EFFECTS__*/
export function procedure<
  const N extends NsidString,
  const P extends ParamsSchema,
  const I extends Payload,
  const O extends Payload,
  const E extends undefined | readonly string[] = undefined,
>(nsid: N, parameters: P, input: I, output: O, errors: E = undefined as E) {
  return new Procedure<N, P, I, O, E>(nsid, parameters, input, output, errors)
}

/*@__NO_SIDE_EFFECTS__*/
export function subscription<
  const N extends NsidString,
  const P extends ParamsSchema,
  const M extends Schema,
  const E extends undefined | readonly string[] = undefined,
>(nsid: N, parameters: P, message: M, errors: E = undefined as E) {
  return new Subscription<N, P, M, E>(nsid, parameters, message, errors)
}

/*@__NO_SIDE_EFFECTS__*/
export function permission<
  const R extends string,
  const O extends PermissionOptions,
>(resource: R, options: PermissionOptions & O = {} as O) {
  return new Permission<R, O>(resource, options)
}

/*@__NO_SIDE_EFFECTS__*/
export function permissionSet<
  const N extends NsidString,
  const P extends readonly Permission[],
>(nsid: N, permissions: P, options?: PermissionSetOptions) {
  return new PermissionSet<N, P>(nsid, permissions, options)
}
