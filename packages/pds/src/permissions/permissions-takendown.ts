import { ids } from '../lexicon/lexicons.js'
import { IdentityOptions, PermissionSet, RpcOptions } from './permission-set.js'

export class PermissionsTakendown extends PermissionSet {
  allowsAccount() {
    return true
  }

  allowsBlob(): boolean {
    return false
  }

  allowsIdentity(options: IdentityOptions) {
    if (options.plcOp) return false
    return true
  }

  allowsRepo(): boolean {
    return false
  }

  allowsRpc({ lxm }: RpcOptions): boolean {
    return (
      lxm === ids.AppBskyActorGetPreferences ||
      lxm === ids.ComAtprotoServerCreateAccount
    )
  }
}
