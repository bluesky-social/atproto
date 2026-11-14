import { SpaceRef } from '@atproto/syntax'
import {
  type DidString,
  type LexiconRecordKey,
  type NsidString,
  type RecordKeyValue,
  asLexiconRecordKey,
} from '../core.js'
import { lazyProperty } from '../util/lazy-property.js'
import { type RecordKeySchema, recordKey } from './record.js'

/**
 * Configuration options for a space declaration.
 *
 * @property title - Human-readable title shown on OAuth consent screens, which
 *   show the NSID when it is absent
 * @property title:lang - Localized titles by language code
 * @property description - Developer-facing description of the space type
 */
export type SpaceOptions = {
  title?: string
  'title:lang'?: Record<string, undefined | string>
  description?: string
}

/**
 * Declares a space type in AT Protocol.
 *
 * A space declaration establishes an NSID for a kind of permissioned space
 * and may supply the human-readable title shown on OAuth consent screens when
 * an application requests access to a space of this type. It also lists the
 * recommended record collections for clients of this space type.
 *
 * The `collections` list does not constrain what may actually be written
 * into the space — it's a recommendation for clients and (along with `title`)
 * informs how OAuth consent screens describe the access being requested.
 *
 * @template TNsid - The NSID identifying this space type
 * @template TKey - The recommended space key type
 * @template TCollections - The recommended record collections
 *
 * @example
 * ```ts
 * const forum = new Space(
 *   'any',
 *   'com.atmoboards.forum',
 *   ['com.atmoboards.thread', 'com.atmoboards.reply'],
 *   { title: 'AtmoBoards Forum', 'title:lang': { es: 'Foro AtmoBoards' } },
 * )
 * ```
 */
export class Space<
  const TNsid extends NsidString = NsidString,
  const TKey extends LexiconRecordKey = LexiconRecordKey,
  const TCollections extends readonly NsidString[] = readonly NsidString[],
> {
  readonly key: TKey
  readonly nsid: TNsid
  readonly collections: TCollections
  readonly options: SpaceOptions

  constructor(
    key: TKey,
    nsid: TNsid,
    collections: TCollections,
    options: SpaceOptions = {},
  ) {
    this.key = asLexiconRecordKey(key)
    this.nsid = nsid
    this.collections = collections
    this.options = options
  }

  get title(): string | undefined {
    return this.options.title
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
 * @param collections - Recommended record collections for clients of this space type
 * @param options - Optional metadata (title, localized titles, description)
 * @returns A new {@link Space} instance
 *
 * @example
 * ```ts
 * const forum = l.space(
 *   'any',
 *   'com.atmoboards.forum',
 *   ['com.atmoboards.thread', 'com.atmoboards.reply'],
 *   {
 *     title: 'AtmoBoards Forum',
 *     'title:lang': {
 *       es: 'Foro AtmoBoards',
 *       ja: 'AtmoBoards 掲示板',
 *     },
 *     description: 'A discussion forum',
 *   },
 * )
 * ```
 */
/*@__NO_SIDE_EFFECTS__*/
export function space<
  const N extends NsidString,
  const K extends LexiconRecordKey,
  const C extends readonly NsidString[],
>(key: K, nsid: N, collections: C, options?: SpaceOptions): Space<N, K, C> {
  return new Space<N, K, C>(key, nsid, collections, options)
}
