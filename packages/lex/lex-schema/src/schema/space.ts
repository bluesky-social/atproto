import {
  type LexiconRecordKey,
  type NsidString,
  asLexiconRecordKey,
} from '../core.js'

/**
 * Configuration options for a space declaration.
 *
 * @property title - Human-readable title shown on OAuth consent screens
 * @property title:lang - Localized titles by language code
 * @property description - Developer-facing description of the space type
 */
export type SpaceOptions = {
  title: string
  'title:lang'?: Record<string, undefined | string>
  description?: string
}

/**
 * Declares a space type in AT Protocol.
 *
 * A space declaration establishes an NSID for a kind of permissioned space
 * and supplies the human-readable title shown on OAuth consent screens when
 * an application requests access to a space of this type. It also lists the
 * recommended record collections for clients of this space type.
 *
 * The `collections` list does not constrain what may actually be written
 * into the space — it's a recommendation for clients and (along with `title`)
 * informs how OAuth consent screens describe the access being requested.
 *
 * @template TNsid - The NSID identifying this space type
 * @template TKey - The recommended space key type
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
  const TNsid extends NsidString = any,
  const TKey extends LexiconRecordKey = LexiconRecordKey,
> {
  readonly key: TKey
  readonly nsid: TNsid
  readonly collections: readonly NsidString[]
  readonly options: SpaceOptions

  constructor(
    key: TKey,
    nsid: TNsid,
    collections: readonly NsidString[],
    options: SpaceOptions,
  ) {
    this.key = asLexiconRecordKey(key)
    this.nsid = nsid
    this.collections = collections
    this.options = options
  }

  get title(): string {
    return this.options.title
  }
}

/**
 * Creates a space declaration.
 *
 * @param key - Recommended space key type
 * @param nsid - The NSID identifying this space type
 * @param collections - Recommended record collections for clients of this space type
 * @param options - Display metadata (title, localized titles, description)
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
>(
  key: K,
  nsid: N,
  collections: readonly NsidString[],
  options: SpaceOptions,
): Space<N, K> {
  return new Space<N, K>(key, nsid, collections, options)
}
