import { Params } from './params.js'

/**
 * Type alias for permission options (same as Params).
 */
export type PermissionOptions = Params

/**
 * Represents a single permission in an AT Protocol permission set.
 *
 * Permissions define access rights to specific resources with optional
 * parameters for fine-grained control.
 *
 * @template TResource - The resource identifier string type
 * @template TOptions - The options type (must be valid Params)
 *
 * @example
 * ```ts
 * const readPermission = new Permission('read', { collection: 'app.bsky.feed.post' })
 * ```
 */
export class Permission<
  const TResource extends string = any,
  const TOptions extends PermissionOptions = any,
> {
  constructor(
    readonly resource: TResource,
    readonly options: TOptions,
  ) {}
}

/**
 * Creates a permission definition for AT Protocol authorization.
 *
 * Permissions specify what resources an application can access.
 * Used in permission sets to define OAuth scopes.
 *
 * @param resource - The resource identifier (e.g., 'read', 'write', 'admin')
 * @param options - Optional parameters for the permission
 * @returns A new {@link Permission} instance
 *
 * @example
 * ```ts
 * // Simple permission
 * const readPermission = l.permission('read')
 *
 * // Permission with options
 * const writePostsPermission = l.permission('write', {
 *   collection: 'app.bsky.feed.post',
 * })
 *
 * // Multiple permissions with different scopes
 * const readProfile = l.permission('read', { collection: 'app.bsky.actor.profile' })
 * const readFeed = l.permission('read', { collection: 'app.bsky.feed.*' })
 * ```
 */
/*@__NO_SIDE_EFFECTS__*/
export function permission<
  const R extends string,
  const O extends PermissionOptions,
>(resource: R, options: PermissionOptions & O = {} as O) {
  return new Permission<R, O>(resource, options)
}
