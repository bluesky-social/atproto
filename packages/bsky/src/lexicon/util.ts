/**
 * GENERATED CODE - DO NOT MODIFY
 */
export type OmitKey<T, K extends keyof T> = {
  [K2 in keyof T as K2 extends K ? never : K2]: T[K2]
}

export type $Typed<V> = V & { $type: string }

export type $Type<Id extends string, Hash extends string> = Hash extends 'main'
  ? Id | `${Id}#${Hash}`
  : `${Id}#${Hash}`

function isObject<V>(v: V): v is V & object {
  return v != null && typeof v === 'object'
}

function check$type<Id extends string, Hash extends string>(
  $type: unknown,
  id: Id,
  hash: Hash,
): $type is $Type<Id, Hash> {
  return $type === id
    ? hash === 'main'
    : // $type === `${id}#${hash}`
      typeof $type === 'string' &&
        $type.length === id.length + 1 + hash.length &&
        $type.charCodeAt(id.length) === 35 /* '#' */ &&
        $type.startsWith(id) &&
        $type.endsWith(hash)
}

export type Is$Typed<V, Id extends string, Hash extends string> = V extends {
  $type: $Type<Id, Hash>
}
  ? V
  : V extends { $type?: string }
    ? V extends { $type?: $Type<Id, Hash> }
      ? $Typed<V>
      : never
    : V & { $type: $Type<Id, Hash> }

export function is$typed<V, Id extends string, Hash extends string>(
  v: V,
  id: Id,
  hash: Hash,
): v is Is$Typed<V, Id, Hash> {
  return isObject(v) && '$type' in v && check$type(v.$type, id, hash)
}

export function maybe$typed<V, Id extends string, Hash extends string>(
  v: V,
  id: Id,
  hash: Hash,
): v is V & object & { $type?: $Type<Id, Hash> } {
  return (
    isObject(v) &&
    ('$type' in v
      ? v.$type === undefined || check$type(v.$type, id, hash)
      : true)
  )
}
