import { NsidString } from '../core.js'

/**
 * Configuration options for a space declaration.
 *
 * @property description - Optional human-readable description of the space type
 * @property name:lang - Localized names by language code
 */
export type SpaceOptions = {
  description?: string
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
 *
 * @example
 * ```ts
 * const forum = new Space(
 *   'com.atmoboards.forum',
 *   'AtmoBoards Forum',
 *   ['com.atmoboards.thread', 'com.atmoboards.reply'],
 *   { 'name:lang': { es: 'Foro AtmoBoards' } },
 * )
 * ```
 */
export class Space<const TNsid extends NsidString = any> {
  constructor(
    readonly nsid: TNsid,
    readonly name: string,
    readonly collections: readonly NsidString[],
    readonly options: SpaceOptions = {},
  ) {}
}

/**
 * Creates a space declaration.
 *
 * @param nsid - The NSID identifying this space type
 * @param name - Human-readable name shown on OAuth consent screens (e.g. "AtmoBoards Forum")
 * @param collections - Recommended record collections for clients of this space type
 * @param options - Optional metadata (description, localized names)
 * @returns A new {@link Space} instance
 *
 * @example
 * ```ts
 * const forum = l.space(
 *   'com.atmoboards.forum',
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
export function space<const N extends NsidString>(
  nsid: N,
  name: string,
  collections: readonly NsidString[],
  options?: SpaceOptions,
) {
  return new Space<N>(nsid, name, collections, options)
}
