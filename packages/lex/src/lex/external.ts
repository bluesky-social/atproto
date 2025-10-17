import { $Type, $type, Infer, LexRecordKey, LexValidator } from './core.js'
import {
  LexIntersection,
  LexIntersectionObject,
} from './schema/intersection.js'
import { LexLiteral } from './schema/literal.js'
import { LexSubscription } from './schema/subscription.js'
import {
  LexArray,
  LexArrayOptions,
  LexBlob,
  LexBlobOptions,
  LexBoolean,
  LexBooleanOptions,
  LexBytes,
  LexBytesOptions,
  LexCidLink,
  LexDict,
  LexDiscriminatedUnion,
  LexDiscriminatedUnionVariants,
  LexEnum,
  LexInteger,
  LexIntegerOptions,
  LexNever,
  LexObject,
  LexObjectOptions,
  LexObjectProperties,
  LexParams,
  LexParamsOptions,
  LexParamsProperties,
  LexPayload,
  LexPermission,
  LexPermissionOptions,
  LexPermissionSet,
  LexPermissionSetOptions,
  LexProcedure,
  LexQuery,
  LexRecord,
  LexRef,
  LexRefGetter,
  LexString,
  LexStringOptions,
  LexToken,
  LexTypedObject,
  LexTypedRef,
  LexTypedRefGetter,
  LexTypedUnion,
  LexUnion,
  LexUnionOptions,
  LexUnknown,
} from './schema.js'

export * from './core.js'
export * from './schema.js'

////////////////
// IPLD Types //
////////////////

/*@__NO_SIDE_EFFECTS__*/
export function never() {
  return new LexNever()
}

/*@__NO_SIDE_EFFECTS__*/
export function unknown() {
  return new LexUnknown()
}

/*@__NO_SIDE_EFFECTS__*/
export function literal<const V extends null | string | number | boolean>(
  value: V,
) {
  return new LexLiteral<V>(value)
}

/*@__NO_SIDE_EFFECTS__*/
export function _enum<const V extends null | string | number | boolean>(
  value: readonly V[],
) {
  return new LexEnum<V>(value)
}

// @NOTE "enum" is a reserved keyword in JS/TS
export { _enum as enum }

/*@__NO_SIDE_EFFECTS__*/
export function boolean(options: LexBooleanOptions = {}) {
  return new LexBoolean(options)
}

/*@__NO_SIDE_EFFECTS__*/
export function integer(options: LexIntegerOptions = {}) {
  return new LexInteger(options)
}

/*@__NO_SIDE_EFFECTS__*/
export function cidLink() {
  return new LexCidLink()
}

/*@__NO_SIDE_EFFECTS__*/
export function bytes(options: LexBytesOptions = {}) {
  return new LexBytes(options)
}

/*@__NO_SIDE_EFFECTS__*/
export function string<const O extends LexStringOptions = NonNullable<unknown>>(
  options: LexStringOptions & O = {} as O,
) {
  return new LexString<O>(options)
}

/*@__NO_SIDE_EFFECTS__*/
export function array<const T>(
  items: LexValidator<T>,
  options: LexArrayOptions = {},
) {
  return new LexArray(items, options)
}

/*@__NO_SIDE_EFFECTS__*/
export function object<
  const P extends LexObjectProperties,
  const O extends LexObjectOptions = NonNullable<unknown>,
>(
  properties: LexObjectProperties & P,
  options: LexObjectOptions & O = {} as O,
) {
  return new LexObject<P, O>(properties, options)
}

/*@__NO_SIDE_EFFECTS__*/
export function dict<const K extends LexString, const V extends LexValidator>(
  key: K,
  value: V,
) {
  return new LexDict<K, V>(key, value)
}

/////////////////////
// Composite Types //
/////////////////////

/*@__NO_SIDE_EFFECTS__*/
export function ref<const T>(get: LexRefGetter<T>) {
  return new LexRef<T>(get)
}

/*@__NO_SIDE_EFFECTS__*/
export function union<const Options extends LexUnionOptions>(
  validators: Options,
) {
  return new LexUnion<Options>(validators)
}

/*@__NO_SIDE_EFFECTS__*/
export function intersection<
  const Props extends LexIntersectionObject,
  const Extra extends LexDict,
>(props: Props, extra: Extra) {
  return new LexIntersection<Props, Extra>(props, extra)
}

/*@__NO_SIDE_EFFECTS__*/
export function discriminatedUnion<
  const Discriminator extends string,
  const Options extends LexDiscriminatedUnionVariants<Discriminator>,
>(discriminator: Discriminator, variants: Options) {
  return new LexDiscriminatedUnion<Discriminator, Options>(
    discriminator,
    variants,
  )
}

///////////////////
// Lexicon types //
///////////////////

/*@__NO_SIDE_EFFECTS__*/
export function blob(options: LexBlobOptions = {}) {
  return new LexBlob(options)
}

/*@__NO_SIDE_EFFECTS__*/
export function token<const Nsid extends string, const Hash extends string>(
  nsid: Nsid,
  hash: Hash,
) {
  return new LexToken($type(nsid, hash))
}

/*@__NO_SIDE_EFFECTS__*/
export function typedRef<const V extends { $type?: string }>(
  get: LexTypedRefGetter<V>,
) {
  return new LexTypedRef<V>(get)
}

/*@__NO_SIDE_EFFECTS__*/
export function typedUnion<
  const R extends readonly LexTypedRef[],
  const C extends boolean,
>(refs: R, closed: C) {
  return new LexTypedUnion<R, C>(refs, closed)
}

/**
 * This function offers two overloads:
 * - One that allows creating a {@link LexTypedObject}, and infer the output
 *   type from the provided arguments, without requiring to specify any of the
 *   generics. This is useful when you want to define a record without
 *   explicitly defining its interface. This version does not support circular
 *   references, as TypeScript cannot infer types in such cases.
 * - One allows creating a {@link LexTypedObject} with an explicitly defined
 *   interface. This will typically be used by codegen (`lex build`) to generate
 *   schemas that work even if they contain circular references.
 */
export function typedObject<
  const Nsid extends string,
  const Hash extends string,
  const Schema extends LexValidator<object>,
>(
  nsid: Nsid,
  hash: Hash,
  schema: Schema,
): LexTypedObject<$Type<Nsid, Hash>, Schema>
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
  schema: LexValidator<Omit<V, '$type'>>,
): LexTypedObject<NonNullable<V['$type']>, typeof schema, V>
/*@__NO_SIDE_EFFECTS__*/
export function typedObject<
  const Nsid extends string,
  const Hash extends string,
  const Schema extends LexValidator<object>,
>(nsid: Nsid, hash: Hash, schema: Schema) {
  return new LexTypedObject<$Type<Nsid, Hash>, Schema>(
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
 * - One that allows creating a {@link LexRecord}, and infer the output type
 *   from the provided arguments, without requiring to specify any of the
 *   generics. This is useful when you want to define a record without
 *   explicitly defining its interface. This version does not support circular
 *   references, as TypeScript cannot infer types in such cases.
 * - One allows creating a {@link LexRecord} with an explicitly defined
 *   interface. This will typically be used by codegen (`lex build`) to generate
 *   schemas that work even if they contain circular references.
 */
export function record<
  const K extends LexRecordKey,
  const T extends string,
  const S extends LexValidator<object>,
>(
  key: K,
  type: AsNsid<T>,
  schema: S,
): LexRecord<K, T, S, Infer<S> & { $type: T }>
export function record<
  const K extends LexRecordKey,
  const V extends { $type: string },
>(
  key: K,
  type: AsNsid<V['$type']>,
  schema: LexValidator<Omit<V, '$type'>>,
): LexRecord<K, V['$type'], typeof schema, V>
/*@__NO_SIDE_EFFECTS__*/
export function record<
  const K extends LexRecordKey,
  const T extends string,
  const S extends LexValidator<object>,
>(key: K, type: T, schema: S) {
  return new LexRecord<K, T, S, Infer<S> & { $type: T }>(key, type, schema)
}

/*@__NO_SIDE_EFFECTS__*/
export function params<
  const P extends LexParamsProperties = NonNullable<unknown>,
  const O extends LexParamsOptions = LexParamsOptions,
>(properties: P = {} as P, options: LexParamsOptions & O = {} as O) {
  return new LexParams<P, O>(properties, options)
}

/*@__NO_SIDE_EFFECTS__*/
export function payload<
  const E extends string | undefined = undefined,
  const S extends LexValidator | undefined = undefined,
>(encoding: E = undefined as E, schema: S = undefined as S) {
  return new LexPayload<E, S>(encoding, schema)
}

/*@__NO_SIDE_EFFECTS__*/
export function query<
  const N extends string,
  const O extends LexPayload,
  const P extends LexParams,
>(nsid: N, output: O, parameters: P) {
  return new LexQuery<N, O, P>(nsid, output, parameters)
}

/*@__NO_SIDE_EFFECTS__*/
export function procedure<
  const N extends string,
  const I extends LexPayload,
  const O extends LexPayload,
>(nsid: N, input: I, output: O) {
  return new LexProcedure<N, I, O>(nsid, input, output)
}

/*@__NO_SIDE_EFFECTS__*/
export function subscription<
  const N extends string,
  const P extends LexParams,
  const M extends undefined | LexRef | LexTypedUnion | LexObject,
>(nsid: N, parameters: P, message: M) {
  return new LexSubscription<N, P, M>(nsid, parameters, message)
}

/*@__NO_SIDE_EFFECTS__*/
export function permission<
  const R extends string,
  const O extends LexPermissionOptions,
>(resource: R, options: LexPermissionOptions & O = {} as O) {
  return new LexPermission<R, O>(resource, options)
}

/*@__NO_SIDE_EFFECTS__*/
export function permissionSet<
  const N extends string,
  const P extends readonly LexPermission[],
  const O extends LexPermissionSetOptions,
>(nsid: N, permissions: P, options: LexPermissionSetOptions & O = {} as O) {
  return new LexPermissionSet<N, P, O>(nsid, permissions, options)
}
