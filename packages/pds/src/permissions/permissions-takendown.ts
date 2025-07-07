import { ids } from '../lexicon/lexicons.js'
import { PermissionSet, RpcOptions } from './permission-set.js'

export class PermissionsTakendown extends PermissionSet {
  allowsAccount() {
    return true
  }

  allowsBlob(): boolean {
    return false
  }

  allowsIdentity() {
    return true
  }

  allowsRepo(): boolean {
    return false
  }

  allowsRpc({ lxm }: RpcOptions): boolean {
    return (
      lxm === ids.AppBskyActorGetPreferences ||
      lxm === ids.AppBskyActorPutPreferences ||
      lxm === ids.ComAtprotoServerCreateAccount
    )
  }
}
