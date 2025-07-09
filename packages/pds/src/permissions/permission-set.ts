import { ForbiddenError } from '@atproto/xrpc-server'

export type AccountOptions = {
  email?: boolean
}
export type IdentityOptions = {
  plcOp?: boolean
  plcOpRequest?: boolean
  handle?: boolean
}
export type RepoOptions = {
  collection: string
  action: 'create' | 'update' | 'delete' | '*'
}
export type RpcOptions = {
  aud: string
  lxm?: string
}

export abstract class PermissionSet {
  abstract allowsAccount(options: AccountOptions): boolean
  public assertAccount(options: AccountOptions): void {
    if (!this.allowsAccount(options)) {
      throw new ForbiddenError(
        options.email
          ? 'Email access is forbidden'
          : 'Access to account is forbidden',
      )
    }
  }

  abstract allowsIdentity(options: IdentityOptions): boolean
  public assertIdentity(options: IdentityOptions): void {
    if (!this.allowsIdentity(options)) {
      const actionsName = options.plcOpRequest
        ? 'PLC operation request'
        : options.plcOp
          ? 'PLC operation'
          : options.handle
            ? 'handle update'
            : null
      throw new ForbiddenError(
        actionsName
          ? `Missing identity permission to access ${actionsName}`
          : 'Access to identity is forbidden',
      )
    }
  }

  abstract allowsBlob(): boolean
  public assertBlob(): void {
    if (!this.allowsBlob()) {
      throw new ForbiddenError('Blob upload not allowed')
    }
  }

  abstract allowsRepo(options: RepoOptions): boolean
  public assertRepo(options: RepoOptions): void {
    if (!this.allowsRepo(options)) {
      throw new ForbiddenError(
        `Access (${options.action}) to collection "${options.collection}" is forbidden`,
      )
    }
  }

  abstract allowsRpc(options: RpcOptions): boolean
  public assertRpc(options: RpcOptions): void {
    if (!this.allowsRpc(options)) {
      const { aud, lxm } = options
      throw new ForbiddenError(
        `Authentication ${lxm ? `using method "${lxm}" ` : ''}against "${aud}" is forbidden`,
      )
    }
  }
}
