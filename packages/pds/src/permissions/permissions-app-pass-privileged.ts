import { PRIVILEGED_METHODS } from '../pipethrough.js'
import { RpcOptions } from './permission-set.js'
import { PermissionsAppPass } from './permissions-app-pass.js'

export class PermissionsAppPassPrivileged extends PermissionsAppPass {
  override allowsRpc(params: RpcOptions) {
    const { lxm } = params
    if (lxm && PRIVILEGED_METHODS.has(lxm)) {
      return true
    }

    return super.allowsRpc(params)
  }
}
