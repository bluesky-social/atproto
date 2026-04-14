import { NsidString } from './string-format.js'
import { OmitKey, Simplify } from './types.js'

/**
 * Constructs the `$type` string type for a given NSID and hash.
 *
 * The `$type` value identifies a schema definition within a lexicon:
 * - For "main" definitions: just the NSID (e.g., `'app.bsky.feed.post'`)
 * - For named definitions: NSID + hash + name (e.g., `'app.bsky.feed.defs#postView'`)
 *
 * @typeParam N - The NSID string type
 * @typeParam H - The hash/definition name (use `'main'` for the main definition)
 *
 * @example
 * ```typescript
 * type MainType = $Type<'app.bsky.feed.post', 'main'>
 * // Result: 'app.bsky.feed.post'
 *
 * type DefType = $Type<'app.bsky.feed.defs', 'postView'>
 * // Result: 'app.bsky.feed.defs#postView'
 * ```
 */
export type $Type<
  N extends NsidString = NsidString,
  H extends string = string,
> = N extends NsidString
  ? string extends H
    ? N | `${N}#${string}`
    : H extends 'main'
      ? N
      : `${N}#${H}`
  : never

/**
 * Extracts the `$type` string type from an object type.
 *
 * @typeParam O - An object type with an optional `$type` property
 *
 * @example
 * ```typescript
 * type Post = { $type: 'app.bsky.feed.post'; text: string }
 * type PostType = $TypeOf<Post>
 * // Result: 'app.bsky.feed.post'
 * ```
 */
export type $TypeOf<O extends { $type?: string }> = NonNullable<O['$type']>

/**
 * Constructs a `$type` string value from an NSID and definition name.
 *
 * For the "main" definition, returns just the NSID. For named definitions,
 * returns the NSID followed by `#` and the definition name.
 *
 * @typeParam N - The NSID string type
 * @typeParam H - The definition name type
 * @param nsid - The NSID of the lexicon
 * @param hash - The definition name within the lexicon (use `'main'` for the main definition)
 * @returns The constructed `$type` string
 *
 * @example
 * ```typescript
 * $type('app.bsky.feed.post', 'main')
 * // Returns: 'app.bsky.feed.post'
 *
 * $type('app.bsky.feed.defs', 'postView')
 * // Returns: 'app.bsky.feed.defs#postView'
 * ```
 */
/*@__NO_SIDE_EFFECTS__*/
export function $type<N extends NsidString, H extends string>(
  nsid: N,
  hash: H,
): $Type<N, H> {
  return (hash === 'main' ? nsid : `${nsid}#${hash}`) as $Type<N, H>
}

/**
 * Represents an object with a required `$type` property.
 *
 * This type adds a `$type` property to an existing object type, useful for
 * representing typed AT Protocol objects.
 *
 * @typeParam V - The base object type
 * @typeParam T - The `$type` string literal type
 *
 * @example
 * ```typescript
 * type Post = $Typed<{ text: string; createdAt: string }, 'app.bsky.feed.post'>
 * // Result: { $type: 'app.bsky.feed.post'; text: string; createdAt: string }
 * ```
 */
export type $Typed<V, T extends string = string> = Simplify<
  V & {
    $type: T
  }
>

/**
 * Ensures an object has the specified `$type` property.
 *
 * If the object already has the correct `$type`, returns it unchanged.
 * Otherwise, creates a new object with the `$type` property added.
 *
 * @typeParam V - The object type (may already have `$type`)
 * @typeParam T - The expected `$type` string
 * @param value - The object to add `$type` to
 * @param $type - The `$type` value to ensure
 * @returns The object with the `$type` property
 *
 * @example
 * ```typescript
 * const post = $typed({ text: 'hello' }, 'app.bsky.feed.post')
 * // Result: { $type: 'app.bsky.feed.post', text: 'hello' }
 *
 * // If already typed, returns same object
 * const typed = { $type: 'app.bsky.feed.post', text: 'hello' }
 * const same = $typed(typed, 'app.bsky.feed.post')
 * console.log(typed === same) // true
 * ```
 */
export function $typed<V extends { $type?: unknown }, T extends string>(
  value: V,
  $type: T,
): $Typed<V, T> {
  return value.$type === $type ? (value as $Typed<V, T>) : { ...value, $type }
}

/**
 * Represents an object with an optional `$type` property.
 *
 * This is used for objects that may or may not have type information,
 * such as input parameters that accept both typed and untyped values.
 *
 * @typeParam V - The base object type
 * @typeParam T - The optional `$type` string literal type
 */
export type $TypedMaybe<V, T extends string = string> = Simplify<
  V & {
    $type?: T
  }
>

/**
 * Removes the `$type` property from an object type.
 *
 * Useful for extracting the "content" of a typed object without the type marker.
 *
 * @typeParam V - An object type with an optional `$type` property
 *
 * @example
 * ```typescript
 * type Post = { $type: 'app.bsky.feed.post'; text: string }
 * type PostContent = Un$Typed<Post>
 * // Result: { text: string }
 * ```
 */
export type Un$Typed<V extends { $type?: string }> = OmitKey<V, '$type'>

/**
 * Unique symbol for branding unknown `$type` strings.
 * @internal
 */
declare const unknown$TypeSymbol: unique symbol

/**
 * Represents an unknown or unrecognized `$type` string.
 *
 * This branded type is used in union types to distinguish between
 * known typed objects and unknown typed objects (from open unions).
 * The branding prevents accidentally matching known `$type` values.
 */
export type Unknown$Type = string & { [unknown$TypeSymbol]: true }

/**
 * Represents an object with an unknown `$type` value.
 *
 * This type is used in open union schemas to represent typed objects that
 * don't match any of the known types. The {@link Unknown$Type} branding ensures
 * that invalid instances of known types don't accidentally match this type.
 *
 * For example, in an open union like:
 * ```typescript
 * type MyOpenUnion = { $type: 'A'; a: number } | Unknown$TypedObject
 * ```
 *
 * A value `{ $type: 'A' }` (missing the required `a` property) will NOT match
 * `Unknown$TypedObject` because `'A'` is not assignable to `Unknown$Type`.
 * This ensures that malformed instances of known types are properly rejected.
 *
 * @example
 * ```typescript
 * // This represents any typed object we don't recognize
 * const unknownTyped: Unknown$TypedObject = {
 *   $type: 'some.unknown.type' as Unknown$Type,
 *   // ... arbitrary properties
 * }
 * ```
 */
export type Unknown$TypedObject = { $type: Unknown$Type }
