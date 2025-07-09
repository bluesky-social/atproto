import { SignedTokenPayload } from '@atproto/oauth-provider'
import { ids } from '../lexicon/lexicons.js'
import { CHAT_BSKY_METHODS, PRIVILEGED_METHODS } from '../pipethrough.js'
import {
  AccountOptions,
  IdentityOptions,
  PermissionSet,
  RepoOptions,
  RpcOptions,
} from './permission-set.js'

export class PermissionsOAuth extends PermissionSet {
  private readonly scopes: Set<string>

  constructor({ scope }: SignedTokenPayload) {
    super()
    this.scopes = new Set(scope?.split(' '))
  }

  protected get hasTransitionGeneric(): boolean {
    return this.scopes.has('transition:generic')
  }

  protected get hasTransitionEmail(): boolean {
    return this.scopes.has('transition:email')
  }

  protected get hasTransitionChatBsky(): boolean {
    return this.scopes.has('transition:chat.bsky')
  }

  allowsAccount(options: AccountOptions): boolean {
    if (options.email && !this.hasTransitionEmail) {
      return false
    }

    return this.hasTransitionGeneric
  }

  allowsBlob(): boolean {
    return this.hasTransitionGeneric
  }

  allowsIdentity(_options: IdentityOptions): boolean {
    return false
  }

  allowsRepo(_options: RepoOptions): boolean {
    return this.hasTransitionGeneric
  }

  allowsRpc({ lxm }: RpcOptions) {
    if (lxm && CHAT_BSKY_METHODS.has(lxm)) {
      return this.hasTransitionChatBsky
    }

    if (lxm && PRIVILEGED_METHODS.has(lxm)) {
      // @NOTE PRIVILEGED_METHODS is a superset of CHAT_BSKY_METHODS so we check
      // it after CHAT_BSKY_METHODS.
      return false
    }

    // @NOTE These are fictional lexicon methods used to determine if the http
    // request has full access to the actor preferences.
    if (lxm && lxm === `${ids.AppBskyActorGetPreferences}Full`) {
      return false
    }
    if (lxm && lxm === `${ids.AppBskyActorPutPreferences}Full`) {
      return false
    }

    return this.hasTransitionGeneric
  }
}
