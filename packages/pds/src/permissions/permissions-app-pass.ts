import { ids } from '../lexicon/lexicons.js'
import { PRIVILEGED_METHODS } from '../pipethrough.js'
import { PermissionSet, RpcOptions } from './permission-set.js'

export class PermissionsAppPass extends PermissionSet {
  allowsAccount() {
    return true
  }

  allowsBlob() {
    return true
  }

  allowsIdentity() {
    return true
  }

  allowsRepo() {
    return true
  }

  allowsRpc({ lxm }: RpcOptions) {
    if (lxm && PRIVILEGED_METHODS.has(lxm)) {
      return false
    }

    if (lxm && lxm === `${ids.AppBskyActorGetPreferences}Full`) {
      return false
    }

    if (lxm && lxm === `${ids.AppBskyActorPutPreferences}Full`) {
      return false
    }

    return true
  }
}
