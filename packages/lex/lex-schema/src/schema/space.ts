import { SpaceRef } from '@atproto/syntax'
import {
  type DidString,
  type LexiconRecordKey,
  type NsidString,
  type RecordKeyValue,
  asLexiconRecordKey,
} from '../core.js'
import { lazyProperty } from '../util/lazy-property.js'
import { type RecordKeySchema, type RecordSchema, recordKey } from './record.js'
import { TypedRefSchema } from './typed-ref.js'

/**
 * Declares a space type in AT Protocol.
 *
 * A space declaration establishes an NSID for a kind of permissioned space,
 * and lists the recommended record collections for clients of this space type.
 *
 * The `collections` list does not constrain what may actually be written
 * into the space — it's a recommendation for clients.
 *
 * @template TNsid - The NSID identifying this space type
 * @template TKey - The recommended space key type
 * @template TRecord - The record schemas of the recommended collections
 *
 * @example
 * ```ts
 * const forum = new Space('any', 'com.atmoboards.forum', [thread, reply])
 * ```
 */
export class Space<
  const TNsid extends NsidString = NsidString,
  const TKey extends LexiconRecordKey = LexiconRecordKey,
  const TRecord extends RecordSchema = RecordSchema,
> {
  readonly key: TKey
  readonly nsid: TNsid

  readonly #collections: readonly (TRecord | TypedRefSchema<TRecord>)[]

  constructor(
    key: TKey,
    nsid: TNsid,
    collections: readonly (TRecord | TypedRefSchema<TRecord>)[],
  ) {
    this.key = asLexiconRecordKey(key)
    this.nsid = nsid

    // @NOTE We don't build the resolved collection schemas here; they are
    // lazily resolved on first access via the `collections` getter.
    this.#collections = collections
  }

  /**
   * The record schemas of the recommended collections.
   *
   * @note Resolved on first access, allowing collections to be declared as
   * {@link TypedRefSchema} to schemas that are not yet defined (e.g. because
   * of circular imports).
   */
  get collections(): readonly TRecord[] {
    return lazyProperty(
      this,
      'collections',
      this.#collections.map(getCollectionSchema),
    )
  }

  get spaceType(): TNsid {
    return this.nsid
  }

  /**
   * Schema validating a space key against this space type's {@link key}.
   */
  get keySchema(): RecordKeySchema<TKey> {
    return lazyProperty(this, 'keySchema', recordKey(this.key))
  }

  /**
   * Whether `skey` is a valid key for a space of this type.
   */
  isKey(skey: unknown): skey is RecordKeyValue<TKey> {
    return this.keySchema.matches(skey)
  }

  /**
   * Whether `ref` designates a space of this type, with a valid key.
   *
   * @example
   * ```ts
   * if (forum.matchesRef(SpaceRef.parse(uri))) {
   *   // uri references a "com.atmoboards.forum" space
   * }
   * ```
   */
  matchesRef<R extends { spaceType: string; skey: string }>(
    ref: R,
  ): ref is R & { spaceType: TNsid; skey: RecordKeyValue<TKey> } {
    return ref.spaceType === this.nsid && this.isKey(ref.skey)
  }

  spaceRefFor(
    spaceDid: TKey extends `literal:${string}` ? DidString : never,
    skey?: RecordKeyValue<TKey>,
  ): SpaceRef
  spaceRefFor(spaceDid: DidString, skey: RecordKeyValue<TKey>): SpaceRef
  spaceRefFor(spaceDid: DidString, skey?: RecordKeyValue<TKey>): SpaceRef {
    // @NOTE Default can only be computed for literal keys. We *could*
    // technically also default for "tid"/"any" values, but we don't know
    // whether this will be used to reference an existing space, or a new one
    // being created.
    if (this.key.startsWith('literal:')) {
      if (skey == null) {
        skey = this.key.slice(8) as RecordKeyValue<TKey>
      } else if (
        // @NOTE let's check the value (it's cheap since we don't create a new
        // string)
        skey.length !== this.key.length - 8 ||
        !this.key.endsWith(skey)
      ) {
        throw new TypeError(
          'Cannot build SpaceRef: skey does not match literal key',
        )
      }
    } else if (!skey) {
      throw new TypeError(
        'Cannot build SpaceRef: skey is not provided and key is not a literal',
      )
    }

    return new SpaceRef(spaceDid, this.nsid, skey)
  }
}

/**
 * Creates a space declaration.
 *
 * @param key - Recommended space key type
 * @param nsid - The NSID identifying this space type
 * @param collections - The record schemas (or references to them) of the
 *   collections recommended for clients of this space type. The schema types
 *   are not inferred from a list mixing schemas and references: use either
 *   form for all of them.
 * @returns A new {@link Space} instance
 *
 * @example
 * ```ts
 * // Record schemas, or (lazy) references to them
 * const forum = l.space('any', 'com.atmoboards.forum', [thread, reply])
 * ```
 */
/*@__NO_SIDE_EFFECTS__*/
export function space<
  const N extends NsidString,
  const K extends LexiconRecordKey,
  const R extends RecordSchema = never,
>(
  key: K,
  nsid: N,
  collections: readonly (R | TypedRefSchema<R>)[],
): Space<N, K, R> {
  return new Space<N, K, R>(key, nsid, collections)
}

function getCollectionSchema<T extends RecordSchema>(
  collection: T | TypedRefSchema<T>,
): T {
  return collection instanceof TypedRefSchema
    ? collection.validator
    : collection
}
