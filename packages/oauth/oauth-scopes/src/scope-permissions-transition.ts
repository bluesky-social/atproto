import {
  type AccountPermissionMatch,
  type BlobPermissionMatch,
  type RepoPermissionMatch,
  type RpcPermissionMatch,
  ScopePermissions,
  type SpacePermissionMatch,
} from './scope-permissions.js'

/**
 * Overrides the default permission set to allow transitional scopes to be used
 * in place of the generic scopes.
 */
export class ScopePermissionsTransition extends ScopePermissions {
  get hasTransitionGeneric(): boolean {
    return this.scopes.has('transition:generic')
  }

  get hasTransitionEmail(): boolean {
    return this.scopes.has('transition:email')
  }

  get hasTransitionChatBsky(): boolean {
    return this.scopes.has('transition:chat.bsky')
  }

  override allowsAccount(options: AccountPermissionMatch): boolean {
    if (
      options.attr === 'email' &&
      options.action === 'read' &&
      this.hasTransitionEmail
    ) {
      return true
    }

    return super.allowsAccount(options)
  }

  override allowsBlob(options: BlobPermissionMatch): boolean {
    if (this.hasTransitionGeneric) {
      return true
    }

    return super.allowsBlob(options)
  }

  override allowsRepo(options: RepoPermissionMatch): boolean {
    if (this.hasTransitionGeneric) {
      return true
    }

    return super.allowsRepo(options)
  }

  /**
   * Grants nothing extra: `transition:generic` predates permissioned data, so a
   * legacy token must never reach a space. Overridden rather than omitted to
   * keep that a decision rather than an oversight.
   */
  override allowsSpace(options: SpacePermissionMatch): boolean {
    return super.allowsSpace(options)
  }

  override allowsRpc(options: RpcPermissionMatch) {
    const { lxm } = options

    if (this.hasTransitionGeneric && lxm === '*') {
      return true
    }

    if (this.hasTransitionGeneric && !lxm.startsWith('chat.bsky.')) {
      return true
    }

    if (this.hasTransitionChatBsky && lxm.startsWith('chat.bsky.')) {
      return true
    }

    return super.allowsRpc(options)
  }
}
