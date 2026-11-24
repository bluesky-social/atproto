import {
  type InferRecordKey,
  type LexiconRecordKey,
  type Main,
  type RecordSchema,
  getMain,
} from '@atproto/lex-schema'

export type RecordKeyOptions<
  T extends RecordSchema,
  AlsoOptionalWhenRecordKeyIs extends LexiconRecordKey = never,
> = T['key'] extends `literal:${string}` | AlsoOptionalWhenRecordKeyIs
  ? { rkey?: InferRecordKey<T> }
  : { rkey: InferRecordKey<T> }

export function rkeyForCreate<const T extends RecordSchema>(
  ns: Main<T>,
  rkey?: InferRecordKey<T>,
): undefined | InferRecordKey<T> {
  if (rkey == null) {
    const schema = getMain(ns)
    // Lets the server generate the TID
    if (schema.key === 'tid') return undefined
    if (schema.key === 'any') return undefined
  }

  return rkeyFor(ns, rkey)
}

/**
 * Returns the record key for a given record schema, using the provided `rkey`
 * if available (validating it against the schema), or deriving it from the
 * schema if it is a literal key.
 */
export function rkeyFor<const T extends RecordSchema>(
  ns: Main<T>,
  rkey?: InferRecordKey<T>,
): InferRecordKey<T> {
  const schema = getMain(ns)
  if (rkey != null) {
    return schema.keySchema.parse(rkey) as InferRecordKey<T>
  }

  if (schema.key.startsWith('literal:')) {
    return schema.key.slice(8) as InferRecordKey<T>
  }

  throw new TypeError(
    `An "rkey" must be provided for record key type "${schema.key}" (${schema.$type})`,
  )
}
