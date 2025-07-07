import { PermissionSet } from './permission-set.js'

export class PermissionsFull extends PermissionSet {
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

  allowsRpc() {
    return true
  }
}
