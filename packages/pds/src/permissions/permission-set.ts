import { InvalidRequestError } from '@atproto/xrpc-server'

export type AccountOptions = {
  email?: boolean
}
export type IdentityOptions = {
  //
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
      throw new InvalidRequestError('insufficient access to account')
    }
  }

  abstract allowsIdentity(options: IdentityOptions): boolean
  public assertIdentity(options: IdentityOptions): void {
    if (!this.allowsIdentity(options)) {
      throw new InvalidRequestError('insufficient access to identity')
    }
  }

  abstract allowsBlob(): boolean
  public assertBlob(): void {
    if (!this.allowsBlob()) {
      throw new InvalidRequestError('blob upload not allowed')
    }
  }

  abstract allowsRepo(options: RepoOptions): boolean
  public assertRepo(options: RepoOptions): void {
    if (!this.allowsRepo(options)) {
      throw new InvalidRequestError(
        `insufficient access to repo collection "${options.collection}"`,
      )
    }
  }

  abstract allowsRpc(options: RpcOptions): boolean
  public assertRpc(options: RpcOptions): void {
    if (!this.allowsRpc(options)) {
      const { aud, lxm } = options
      throw new InvalidRequestError(
        `Authentication ${lxm ? `for method "${lxm}" ` : ''}against "${aud}" is not allowed`,
      )
    }
  }
}
