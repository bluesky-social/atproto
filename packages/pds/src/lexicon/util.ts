/**
 * GENERATED CODE - DO NOT MODIFY
 */
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

export function is$typed<V, Id extends string, Hash extends string>(
  v: V,
  id: Id,
  hash: Hash,
): v is V & object & { $type: $Type<Id, Hash> } {
  return has$type(v) && check$type(v.$type, id, hash)
}
