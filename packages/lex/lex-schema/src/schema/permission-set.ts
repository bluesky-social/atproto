import { NsidString } from '../core.js'
import { Permission } from './permission.js'

/**
 * Configuration options for a permission set.
 *
 * @property title - Human-readable title for the permission set
 * @property title:lang - Localized titles by language code
 * @property detail - Detailed description of the permission set
 * @property detail:lang - Localized descriptions by language code
 */
export type PermissionSetOptions = {
  title?: string
  'title:lang'?: Record<string, undefined | string>
  detail?: string
  'detail:lang'?: Record<string, undefined | string>
}

/**
 * Represents a collection of related permissions in AT Protocol.
 *
 * Permission sets group permissions together with metadata for OAuth
 * authorization flows. They are identified by an NSID.
 *
 * @template TNsid - The NSID identifying this permission set
 * @template TPermissions - Tuple type of the included permissions
 *
 * @example
 * ```ts
 * const feedAccess = new PermissionSet(
 *   'app.bsky.feed.access',
 *   [readPermission, writePermission],
 *   { title: 'Feed Access', detail: 'Read and write to your feed' }
 * )
 * ```
 */
export class PermissionSet<
  const TNsid extends NsidString = any,
  const TPermissions extends readonly Permission[] = any,
> {
  constructor(
    readonly nsid: TNsid,
    readonly permissions: TPermissions,
    readonly options: PermissionSetOptions = {},
  ) {}
}

/**
 * Creates a permission set grouping related permissions.
 *
 * Permission sets define OAuth scopes that applications can request.
 * They include human-readable metadata for authorization UIs.
 *
 * @param nsid - The NSID identifying this permission set
 * @param permissions - Array of permissions included in this set
 * @param options - Optional metadata (title, detail, localization)
 * @returns A new {@link PermissionSet} instance
 *
 * @example
 * ```ts
 * // Define individual permissions
 * const readPosts = l.permission('read', { collection: 'app.bsky.feed.post' })
 * const writePosts = l.permission('write', { collection: 'app.bsky.feed.post' })
 *
 * // Group into a permission set
 * const postManagement = l.permissionSet(
 *   'app.bsky.feed.postManagement',
 *   [readPosts, writePosts],
 *   {
 *     title: 'Post Management',
 *     detail: 'View and create posts on your behalf',
 *     'title:lang': {
 *       'es': 'Gestion de publicaciones',
 *       'fr': 'Gestion des publications',
 *     },
 *   }
 * )
 * ```
 */
/*@__NO_SIDE_EFFECTS__*/
export function permissionSet<
  const N extends NsidString,
  const P extends readonly Permission[],
>(nsid: N, permissions: P, options?: PermissionSetOptions) {
  return new PermissionSet<N, P>(nsid, permissions, options)
}
