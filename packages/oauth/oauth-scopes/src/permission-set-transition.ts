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
  get hasTransitionGeneric(): boolean {
    return this.scopes.has('transition:generic')
  }

  get hasTransitionEmail(): boolean {
    return this.scopes.has('transition:email')
  }

  get hasTransitionChatBsky(): boolean {
    return this.scopes.has('transition:chat.bsky')
  }

  override allowsAccount(options: AccountScopeMatch): boolean {
    if (options.attr === 'email' && this.hasTransitionEmail) {
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

    if (this.hasTransitionGeneric && !lxm.startsWith('chat.bsky.')) {
      return true
    }

    if (this.hasTransitionChatBsky && lxm.startsWith('chat.bsky.')) {
      return true
    }

    return super.allowsRpc(options)
  }
}
