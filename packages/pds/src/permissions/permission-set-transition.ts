import { CHAT_BSKY_METHODS, PRIVILEGED_METHODS } from '../pipethrough.js'
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
    if (
      this.hasTransitionGeneric &&
      (options.feature !== 'email' || this.hasTransitionEmail)
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
    if (this.hasTransitionGeneric) {
      const { lxm } = options
      if (lxm && CHAT_BSKY_METHODS.has(lxm)) {
        if (this.hasTransitionChatBsky) {
          return true
        }
      } else if (!lxm || !PRIVILEGED_METHODS.has(lxm)) {
        return true
      }
    }

    return super.allowsRpc(options)
  }
}
