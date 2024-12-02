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

function has$type<V>(v: V): v is $Typed<V & object> {
  return (
    v != null &&
    typeof v === 'object' &&
    '$type' in v &&
    typeof v.$type === 'string'
  )
}

function check$type<Id extends string, Hash extends string>(
  $type: string,
  id: Id,
  hash: Hash,
): $type is $Type<Id, Hash> {
  return $type === id
    ? hash === 'main'
    : // $type === `${id}#${hash}`
      $type.length === id.length + 1 + hash.length &&
        $type.charCodeAt(id.length) === 35 /* '#' */ &&
        $type.startsWith(id) &&
        $type.endsWith(hash)
}

export type Is$Typed<V, Id extends string, Hash extends string> = V extends {
  $type?: string
}
  ? Extract<V, { $type: $Type<Id, Hash> }>
  : V & { $type: $Type<Id, Hash> }

export function is$typed<V, Id extends string, Hash extends string>(
  v: V,
  id: Id,
  hash: Hash,
): v is Is$Typed<V, Id, Hash> {
  return has$type(v) && check$type(v.$type, id, hash)
}
