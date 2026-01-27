import { NsidString } from './string-format.js'
import { OmitKey, Simplify } from './types.js'

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

export type $TypeOf<O extends { $type?: string }> = NonNullable<O['$type']>

/*@__NO_SIDE_EFFECTS__*/
export function $type<N extends NsidString, H extends string>(
  nsid: N,
  hash: H,
): $Type<N, H> {
  return (hash === 'main' ? nsid : `${nsid}#${hash}`) as $Type<N, H>
}

export type $Typed<V, T extends string = string> = Simplify<
  V & {
    $type: T
  }
>

export function $typed<V extends { $type?: unknown }, T extends string>(
  value: V,
  $type: T,
): $Typed<V, T> {
  return value.$type === $type ? (value as $Typed<V, T>) : { ...value, $type }
}

export type $TypedMaybe<V, T extends string = string> = Simplify<
  V & {
    $type?: T
  }
>

export type Un$Typed<V extends { $type?: string }> = OmitKey<V, '$type'>

declare const unknown$TypeSymbol: unique symbol
export type Unknown$Type = string & { [unknown$TypeSymbol]: true }

// In order to prevent places that expect a union of known and unknown $typed
// objects (like lexicons schema open unions), from accepting an invalid version
// of the known $typed objects, we need to prevent any other properties from
// being present.
//
// For example, if we expect:
// ```ts
// type MyOpenUnion = { $type: 'A'; a: number } | Unknown$TypedObject
// ```
// we want to make that that the following is rejected:
// ```ts
// { $type: 'A' }
// ```
//
// If we typed `Unknown$TypedObject` as `{ $type: string }`, `{ $type: 'A' }`
// would be a valid `MyOpenUnion` as it would match the `Unknown$TypedObject`.
// By using a $type property that uniquely describes unknown values, we ensure
// that only valid known typed objects, or a type casted value, can be used.
export type Unknown$TypedObject = { $type: Unknown$Type }
