import type { LexiconRecordKey, NsidString } from '../core.js'

/**
 * Configuration options for a space declaration.
 *
 * @property description - Optional developer-facing description of the space type
 * @property name:lang - Localized names by language code
 */
export type SpaceOptions = {
  name: string
  'name:lang'?: Record<string, undefined | string>
}

/**
 * Declares a space type in AT Protocol.
 *
 * A space declaration establishes an NSID for a kind of permissioned space
 * and supplies the human-readable name shown on OAuth consent screens when
 * an application requests access to a space of this type. It also lists the
 * recommended record collections for clients of this space type.
 *
 * The `collections` list does not constrain what may actually be written
 * into the space — it's a recommendation for clients and (along with `name`)
 * informs how OAuth consent screens describe the access being requested.
 *
 * @template TNsid - The NSID identifying this space type
 * @template TKey - The recommended space key type
 *
 * @example
 * ```ts
 * const forum = new Space(
 *   'com.atmoboards.forum',
 *   'any',
 *   'AtmoBoards Forum',
 *   ['com.atmoboards.thread', 'com.atmoboards.reply'],
 *   { 'name:lang': { es: 'Foro AtmoBoards' } },
 * )
 * ```
 */
export class Space<
  const TNsid extends NsidString = any,
  const TKey extends LexiconRecordKey = LexiconRecordKey,
> {
  readonly nsid: TNsid
  readonly key: TKey
  readonly collections: readonly NsidString[]
  readonly options: SpaceOptions

  constructor(
    nsid: TNsid,
    key: TKey,
    collections: readonly NsidString[],
    options: SpaceOptions,
  ) {
    this.nsid = nsid
    this.key = key
    this.collections = collections
    this.options = options
  }

  get name(): string {
    return this.options.name
  }
}

/**
 * Creates a space declaration.
 *
 * @param nsid - The NSID identifying this space type
 * @param key - Recommended space key type
 * @param name - Human-readable name shown on OAuth consent screens (e.g. "AtmoBoards Forum")
 * @param collections - Recommended record collections for clients of this space type
 * @param options - Optional metadata (description, localized names)
 * @returns A new {@link Space} instance
 *
 * @example
 * ```ts
 * const forum = l.space(
 *   'com.atmoboards.forum',
 *   'any',
 *   'AtmoBoards Forum',
 *   ['com.atmoboards.thread', 'com.atmoboards.reply'],
 *   {
 *     description: 'A discussion forum',
 *     'name:lang': {
 *       es: 'Foro AtmoBoards',
 *       ja: 'AtmoBoards 掲示板',
 *     },
 *   },
 * )
 * ```
 */
/*@__NO_SIDE_EFFECTS__*/
export function space<
  const N extends NsidString,
  const K extends LexiconRecordKey,
>(
  nsid: N,
  key: K,
  collections: readonly NsidString[],
  options: SpaceOptions,
): Space<N, K> {
  return new Space<N, K>(nsid, key, collections, options)
}
