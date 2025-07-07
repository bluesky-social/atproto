import { ids } from '../lexicon/lexicons.js'
import { PermissionSet, RpcOptions } from './permission-set.js'

export class PermissionsSignupQueued extends PermissionSet {
  allowsAccount() {
    return true
  }

  allowsBlob(): boolean {
    return false
  }

  allowsIdentity() {
    return false
  }

  allowsRepo(): boolean {
    return false
  }

  allowsRpc({ lxm }: RpcOptions) {
    return lxm === ids.AppBskyNotificationRegisterPush
  }
}
