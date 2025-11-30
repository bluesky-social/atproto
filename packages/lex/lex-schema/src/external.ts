import { $Type, $type, Nsid, RecordKey, Simplify } from './core.js'
import {
  ArraySchema,
  ArraySchemaOptions,
  BlobSchema,
  BlobSchemaOptions,
  BooleanSchema,
  BooleanSchemaOptions,
  BytesSchema,
  BytesSchemaOptions,
  CidSchema,
  CustomAssertion,
  CustomSchema,
  DictSchema,
  DiscriminatedUnionSchema,
  DiscriminatedUnionVariants,
  EnumSchema,
  EnumSchemaOptions,
  IntegerSchema,
  IntegerSchemaOptions,
  IntersectionSchema,
  LiteralSchema,
  LiteralSchemaOptions,
  NeverSchema,
  NullSchema,
  NullableSchema,
  ObjectSchema,
  ObjectSchemaProperties,
  OptionalSchema,
  ParamsSchema,
  ParamsSchemaProperties,
  Payload,
  PayloadBody,
  Permission,
  PermissionOptions,
  PermissionSet,
  PermissionSetOptions,
  Procedure,
  Query,
  RecordSchema,
  RefSchema,
  RefSchemaGetter,
  StringSchema,
  StringSchemaOptions,
  Subscription,
  TokenSchema,
  TypedObjectSchema,
  TypedRefGetter,
  TypedRefSchema,
  TypedUnionSchema,
  UnionSchema,
  UnionSchemaValidators,
  UnknownObjectOutput,
  UnknownObjectSchema,
  UnknownSchema,
  refine,
} from './schema.js'
import { Infer, PropertyKey, Validator } from './validation.js'

export * from './core.js'
export * from './schema.js'
export * from './validation.js'

/*@__NO_SIDE_EFFECTS__*/
export function never() {
  return new NeverSchema()
}

/*@__NO_SIDE_EFFECTS__*/
export function unknown() {
  return new UnknownSchema()
}

/*@__NO_SIDE_EFFECTS__*/
export function _null() {
  return new NullSchema()
}

export { _null as null }

/*@__NO_SIDE_EFFECTS__*/
export function literal<const V extends null | string | number | boolean>(
  value: V,
  options?: LiteralSchemaOptions<V>,
) {
  return new LiteralSchema<V>(value, options)
}

/*@__NO_SIDE_EFFECTS__*/
export function _enum<const V extends null | string | number | boolean>(
  value: readonly V[],
  options?: EnumSchemaOptions<V>,
) {
  return new EnumSchema<V>(value, options)
}

// @NOTE "enum" is a reserved keyword in JS/TS
export { _enum as enum }

/*@__NO_SIDE_EFFECTS__*/
export function boolean(options?: BooleanSchemaOptions) {
  return new BooleanSchema(options)
}

/*@__NO_SIDE_EFFECTS__*/
export function integer(options?: IntegerSchemaOptions) {
  return new IntegerSchema(options)
}

/*@__NO_SIDE_EFFECTS__*/
export function cidLink() {
  return new CidSchema()
}

/*@__NO_SIDE_EFFECTS__*/
export function bytes(options?: BytesSchemaOptions) {
  return new BytesSchema(options)
}

/*@__NO_SIDE_EFFECTS__*/
export function blob<O extends BlobSchemaOptions = NonNullable<unknown>>(
  options: O = {} as O,
) {
  return new BlobSchema(options)
}

/*@__NO_SIDE_EFFECTS__*/
export function string<
  const O extends StringSchemaOptions = NonNullable<unknown>,
>(options: StringSchemaOptions & O = {} as O) {
  return new StringSchema<O>(options)
}

/*@__NO_SIDE_EFFECTS__*/
export function array<T>(items: Validator<T>, options?: ArraySchemaOptions) {
  return new ArraySchema<T>(items, options)
}

/*@__NO_SIDE_EFFECTS__*/
export function object<const P extends ObjectSchemaProperties>(properties: P) {
  return new ObjectSchema<P>(properties)
}

/*@__NO_SIDE_EFFECTS__*/
export function dict<
  const K extends Validator<string>,
  const V extends Validator,
>(key: K, value: V) {
  return new DictSchema<K, V>(key, value)
}

// Utility
export type { UnknownObjectOutput as UnknownObject }

/*@__NO_SIDE_EFFECTS__*/
export function unknownObject() {
  return new UnknownObjectSchema()
}

/*@__NO_SIDE_EFFECTS__*/
export function ref<T>(get: RefSchemaGetter<T>) {
  return new RefSchema<T>(get)
}

/*@__NO_SIDE_EFFECTS__*/
export function custom<T>(
  assertion: CustomAssertion<T>,
  message: string,
  path?: PropertyKey | readonly PropertyKey[],
) {
  return new CustomSchema<T>(assertion, message, path)
}

/*@__NO_SIDE_EFFECTS__*/
export function nullable<const S extends Validator>(schema: S) {
  return new NullableSchema<Infer<S>>(schema)
}

/*@__NO_SIDE_EFFECTS__*/
export function optional<const S extends Validator>(schema: S) {
  return new OptionalSchema<Infer<S>>(schema)
}

/*@__NO_SIDE_EFFECTS__*/
export function union<const V extends UnionSchemaValidators>(validators: V) {
  return new UnionSchema<V>(validators)
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
export function token<const N extends Nsid, const H extends string>(
  nsid: N,
  hash: H,
) {
  return new TokenSchema($type(nsid, hash))
}

/*@__NO_SIDE_EFFECTS__*/
export function typedRef<const V extends { $type?: string }>(
  get: TypedRefGetter<V>,
) {
  return new TypedRefSchema<V>(get)
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
  const N extends Nsid,
  const H extends string,
  const Schema extends Validator<{ [_ in string]?: unknown }>,
>(
  nsid: N,
  hash: H,
  schema: Schema,
): TypedObjectSchema<Simplify<{ $type?: $Type<N, H> } & Infer<Schema>>>
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
  schema: Validator<Omit<V, '$type'>>,
): TypedObjectSchema<V>
/*@__NO_SIDE_EFFECTS__*/
export function typedObject<
  const N extends Nsid,
  const H extends string,
  const Schema extends Validator<{ [_ in string]?: unknown }>,
>(nsid: N, hash: H, schema: Schema) {
  return new TypedObjectSchema($type(nsid, hash), schema)
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
  const K extends RecordKey,
  const T extends Nsid,
  const S extends Validator<{ [_ in string]?: unknown }>,
>(
  key: K,
  type: AsNsid<T>,
  schema: S,
): RecordSchema<K, Simplify<{ $type: T } & Infer<S>>>
export function record<
  const K extends RecordKey,
  const V extends { $type: Nsid },
>(
  key: K,
  type: AsNsid<V['$type']>,
  schema: Validator<Omit<V, '$type'>>,
): RecordSchema<K, V>
/*@__NO_SIDE_EFFECTS__*/
export function record<
  const K extends RecordKey,
  const T extends Nsid,
  const S extends Validator<{ [_ in string]?: unknown }>,
>(key: K, type: T, schema: S) {
  return new RecordSchema(key, type, schema)
}

/*@__NO_SIDE_EFFECTS__*/
export function params<
  const P extends ParamsSchemaProperties = NonNullable<unknown>,
>(properties: P = {} as P) {
  return new ParamsSchema<P>(properties)
}

/*@__NO_SIDE_EFFECTS__*/
export function payload<
  const E extends string | undefined = undefined,
  const S extends PayloadBody<E> = undefined,
>(encoding: E = undefined as E, schema: S = undefined as S) {
  return new Payload<E, S>(encoding, schema)
}

/*@__NO_SIDE_EFFECTS__*/
export function query<
  const N extends Nsid,
  const P extends ParamsSchema,
  const O extends Payload,
  const E extends undefined | readonly string[] = undefined,
>(nsid: N, parameters: P, output: O, errors: E = undefined as E) {
  return new Query<N, P, O, E>(nsid, parameters, output, errors)
}

/*@__NO_SIDE_EFFECTS__*/
export function procedure<
  const N extends Nsid,
  const P extends ParamsSchema,
  const I extends Payload,
  const O extends Payload,
  const E extends undefined | readonly string[] = undefined,
>(nsid: N, parameters: P, input: I, output: O, errors: E = undefined as E) {
  return new Procedure<N, P, I, O, E>(nsid, parameters, input, output, errors)
}

/*@__NO_SIDE_EFFECTS__*/
export function subscription<
  const N extends string,
  const P extends ParamsSchema,
  const M extends undefined | RefSchema | TypedUnionSchema | ObjectSchema,
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
  const N extends string,
  const P extends readonly Permission[],
  const O extends PermissionSetOptions,
>(nsid: N, permissions: P, options: PermissionSetOptions & O = {} as O) {
  return new PermissionSet<N, P, O>(nsid, permissions, options)
}
