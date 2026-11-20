import type { InferInput, RecordSchema, Space } from '@atproto/lex-schema'

/** The collections declared by a space type. */
export type SpaceCollection<S extends Space> = S['collections'][number]['$type']

/**
 * The record schemas of the collections declared by a space type, or of its
 * collections `C` only.
 */
export type SpaceRecordSchema<
  S extends Space,
  C extends string = SpaceCollection<S>,
> = S['collections'][number] extends infer T
  ? T extends RecordSchema // Distributes over unions
    ? C extends unknown // Distributes over unions
      ? C extends T['$type']
        ? T
        : never
      : never
    : never
  : never

/**
 * A record of the collections declared by a space type (or of its collections
 * `C` only), as accepted by the space type's schema of its collection.
 */
export type SpaceRecordInput<
  S extends Space,
  C extends string = SpaceCollection<S>,
> = InferInput<SpaceRecordSchema<S, C>>
