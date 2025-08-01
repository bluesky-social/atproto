import {
  AccountScopeMatch,
  BlobScopeMatch,
  PermissionSet,
  RepoScopeMatch,
  RpcScopeMatch,
} from './permission-set.js'

/**
 * Overrides the default permission set to allow transitional scopes to be used
 * in place of the generic scopes.
 */
export class PermissionSetTransition extends PermissionSet {
  protected get hasTransitionGeneric(): boolean {
    return this.scopes.has('transition:generic')
  }

  protected get hasTransitionEmail(): boolean {
    return this.scopes.has('transition:email')
  }

  protected get hasTransitionChatBsky(): boolean {
    return this.scopes.has('transition:chat.bsky')
  }

  override allowsAccount(options: AccountScopeMatch): boolean {
    if (this.hasTransitionGeneric && options.attribute !== 'email') {
      return true
    }

    if (
      this.hasTransitionEmail &&
      options.attribute === 'email' &&
      options.action === 'read'
    ) {
      return true
    }

    if (
      this.hasTransitionEmail &&
      this.hasTransitionGeneric &&
      options.attribute === 'email' &&
      options.action === 'manage'
    ) {
      return true
    }

    return super.allowsAccount(options)
  }

  override allowsBlob(options: BlobScopeMatch): boolean {
    if (this.hasTransitionGeneric) {
      return true
    }

    return super.allowsBlob(options)
  }

  override allowsRepo(options: RepoScopeMatch): boolean {
    if (this.hasTransitionGeneric) {
      return true
    }

    return super.allowsRepo(options)
  }

  override allowsRpc(options: RpcScopeMatch) {
    const { lxm } = options

    if (this.hasTransitionGeneric && lxm === '*') {
      return true
    }

    if (this.hasTransitionChatBsky && lxm.startsWith('chat.bsky.')) {
      return true
    }

    return super.allowsRpc(options)
  }
}
