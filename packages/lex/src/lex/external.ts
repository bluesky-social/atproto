import { $Type, $type, Infer, RecordKey, Validator } from './core.js'
import {
  IntersectionSchema,
  IntersectionSchemaObject,
} from './schema/intersection.js'
import { LiteralSchema } from './schema/literal.js'
import { Subscription } from './schema/subscription.js'
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
  DictSchema,
  DiscriminatedUnionSchema,
  DiscriminatedUnionSchemaVariants,
  EnumSchema,
  IntegerSchema,
  IntegerSchemaOptions,
  NeverSchema,
  ObjectSchema,
  ObjectSchemaOptions,
  ObjectSchemaProperties,
  ParamsSchema,
  ParamsSchemaOptions,
  ParamsSchemaProperties,
  PayloadSchema,
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
  TokenSchema,
  TypedObjectSchema,
  TypedRefSchema,
  TypedRefSchemaGetter,
  TypedUnionSchema,
  UnionSchema,
  UnionSchemaOptions,
  UnknownSchema,
} from './schema.js'

export * from './core.js'
export * from './schema.js'

////////////////
// IPLD Types //
////////////////

/*@__NO_SIDE_EFFECTS__*/
export function never() {
  return new NeverSchema()
}

/*@__NO_SIDE_EFFECTS__*/
export function unknown() {
  return new UnknownSchema()
}

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

/*@__NO_SIDE_EFFECTS__*/
export function boolean(options: BooleanSchemaOptions = {}) {
  return new BooleanSchema(options)
}

/*@__NO_SIDE_EFFECTS__*/
export function integer(options: IntegerSchemaOptions = {}) {
  return new IntegerSchema(options)
}

/*@__NO_SIDE_EFFECTS__*/
export function cidLink() {
  return new CidSchema()
}

/*@__NO_SIDE_EFFECTS__*/
export function bytes(options: BytesSchemaOptions = {}) {
  return new BytesSchema(options)
}

/*@__NO_SIDE_EFFECTS__*/
export function string<
  const O extends StringSchemaOptions = NonNullable<unknown>,
>(options: StringSchemaOptions & O = {} as O) {
  return new StringSchema<O>(options)
}

/*@__NO_SIDE_EFFECTS__*/
export function array<const T>(
  items: Validator<T>,
  options: ArraySchemaOptions = {},
) {
  return new ArraySchema(items, options)
}

/*@__NO_SIDE_EFFECTS__*/
export function object<
  const P extends ObjectSchemaProperties,
  const O extends ObjectSchemaOptions = NonNullable<unknown>,
>(
  properties: ObjectSchemaProperties & P,
  options: ObjectSchemaOptions & O = {} as O,
) {
  return new ObjectSchema<P, O>(properties, options)
}

/*@__NO_SIDE_EFFECTS__*/
export function dict<const K extends StringSchema, const V extends Validator>(
  key: K,
  value: V,
) {
  return new DictSchema<K, V>(key, value)
}

/////////////////////
// Composite Types //
/////////////////////

/*@__NO_SIDE_EFFECTS__*/
export function ref<const T>(get: RefSchemaGetter<T>) {
  return new RefSchema<T>(get)
}

/*@__NO_SIDE_EFFECTS__*/
export function union<const Options extends UnionSchemaOptions>(
  validators: Options,
) {
  return new UnionSchema<Options>(validators)
}

/*@__NO_SIDE_EFFECTS__*/
export function intersection<
  const Props extends IntersectionSchemaObject,
  const Extra extends DictSchema,
>(props: Props, extra: Extra) {
  return new IntersectionSchema<Props, Extra>(props, extra)
}

/*@__NO_SIDE_EFFECTS__*/
export function discriminatedUnion<
  const Discriminator extends string,
  const Options extends DiscriminatedUnionSchemaVariants<Discriminator>,
>(discriminator: Discriminator, variants: Options) {
  return new DiscriminatedUnionSchema<Discriminator, Options>(
    discriminator,
    variants,
  )
}

///////////////////
// Lexicon types //
///////////////////

/*@__NO_SIDE_EFFECTS__*/
export function blob(options: BlobSchemaOptions = {}) {
  return new BlobSchema(options)
}

/*@__NO_SIDE_EFFECTS__*/
export function token<const Nsid extends string, const Hash extends string>(
  nsid: Nsid,
  hash: Hash,
) {
  return new TokenSchema($type(nsid, hash))
}

/*@__NO_SIDE_EFFECTS__*/
export function typedRef<const V extends { $type?: string }>(
  get: TypedRefSchemaGetter<V>,
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
  const Nsid extends string,
  const Hash extends string,
  const Schema extends Validator<object>,
>(
  nsid: Nsid,
  hash: Hash,
  schema: Schema,
): TypedObjectSchema<$Type<Nsid, Hash>, Schema>
export function typedObject<const V extends { $type?: string }>(
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
): TypedObjectSchema<NonNullable<V['$type']>, typeof schema, V>
/*@__NO_SIDE_EFFECTS__*/
export function typedObject<
  const Nsid extends string,
  const Hash extends string,
  const Schema extends Validator<object>,
>(nsid: Nsid, hash: Hash, schema: Schema) {
  return new TypedObjectSchema<$Type<Nsid, Hash>, Schema>(
    $type(nsid, hash),
    schema,
  )
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
  const T extends string,
  const S extends Validator<object>,
>(
  key: K,
  type: AsNsid<T>,
  schema: S,
): RecordSchema<K, T, S, Infer<S> & { $type: T }>
export function record<
  const K extends RecordKey,
  const V extends { $type: string },
>(
  key: K,
  type: AsNsid<V['$type']>,
  schema: Validator<Omit<V, '$type'>>,
): RecordSchema<K, V['$type'], typeof schema, V>
/*@__NO_SIDE_EFFECTS__*/
export function record<
  const K extends RecordKey,
  const T extends string,
  const S extends Validator<object>,
>(key: K, type: T, schema: S) {
  return new RecordSchema<K, T, S, Infer<S> & { $type: T }>(key, type, schema)
}

/*@__NO_SIDE_EFFECTS__*/
export function params<
  const P extends ParamsSchemaProperties = NonNullable<unknown>,
  const O extends ParamsSchemaOptions = ParamsSchemaOptions,
>(properties: P = {} as P, options: ParamsSchemaOptions & O = {} as O) {
  return new ParamsSchema<P, O>(properties, options)
}

/*@__NO_SIDE_EFFECTS__*/
export function payload<
  const E extends string | undefined = undefined,
  const S extends Validator | undefined = undefined,
>(encoding: E = undefined as E, schema: S = undefined as S) {
  return new PayloadSchema<E, S>(encoding, schema)
}

/*@__NO_SIDE_EFFECTS__*/
export function query<
  const N extends string,
  const P extends ParamsSchema,
  const O extends PayloadSchema,
>(nsid: N, parameters: P, output: O) {
  return new Query<N, P, O>(nsid, parameters, output)
}

/*@__NO_SIDE_EFFECTS__*/
export function procedure<
  const N extends string,
  const P extends ParamsSchema,
  const I extends PayloadSchema,
  const O extends PayloadSchema,
>(nsid: N, parameters: P, input: I, output: O) {
  return new Procedure<N, P, I, O>(nsid, parameters, input, output)
}

/*@__NO_SIDE_EFFECTS__*/
export function subscription<
  const N extends string,
  const P extends ParamsSchema,
  const M extends undefined | RefSchema | TypedUnionSchema | ObjectSchema,
>(nsid: N, parameters: P, message: M) {
  return new Subscription<N, P, M>(nsid, parameters, message)
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
