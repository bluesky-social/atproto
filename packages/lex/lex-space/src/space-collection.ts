import type { Main, RecordSchema, Restricted } from '@atproto/lex-client'
import type { Space } from '@atproto/lex-schema'

/** The collections declared by a space type. */
export type SpaceCollection<S extends Space> = S['collections'][number]

/**
 * A record schema, restricted to the collections declared by `S`. The
 * `SpaceReader` and `SpaceClient` methods taking one accept any record schema
 * with `validateRequest: false`.
 */
export type SpaceCollectionSchema<S extends Space, T extends RecordSchema> =
  T['$type'] extends SpaceCollection<S>
    ? Main<T>
    : Restricted<'This record type is not a collection of the space type'>
