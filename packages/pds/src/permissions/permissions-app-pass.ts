import { ids } from '../lexicon/lexicons.js'
import { PRIVILEGED_METHODS } from '../pipethrough.js'
import { IdentityOptions, PermissionSet, RpcOptions } from './permission-set.js'

export class PermissionsAppPass extends PermissionSet {
  allowsAccount() {
    return true
  }

  allowsBlob() {
    return true
  }

  allowsIdentity(options: IdentityOptions) {
    if (options.plcOpRequest) return false
    // @NOTE The following is 'true', although it "plcOpRequest" returns false,
    // because "submitPlcOperation" used to allow AppPass to sign PLC
    // operations, while "requestPlcOperationSignature" ("plcOpRequest")
    // required "accessFull" auth.
    if (options.plcOp) return true
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
