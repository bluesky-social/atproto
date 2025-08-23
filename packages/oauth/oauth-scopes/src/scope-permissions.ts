import { ScopeMissingError } from './scope-missing-error.js'
import {
  AccountPermission,
  AccountPermissionMatch,
} from './scopes/account-permission.js'
import {
  BlobPermission,
  BlobPermissionMatch,
} from './scopes/blob-permission.js'
import {
  IdentityPermission,
  IdentityPermissionMatch,
} from './scopes/identity-permission.js'
import {
  RepoPermission,
  RepoPermissionMatch,
} from './scopes/repo-permission.js'
import { RpcPermission, RpcPermissionMatch } from './scopes/rpc-permission.js'
import { ScopesSet } from './scopes-set.js'

export type {
  AccountPermissionMatch,
  BlobPermissionMatch,
  IdentityPermissionMatch,
  RepoPermissionMatch,
  RpcPermissionMatch,
}

export class ScopePermissions {
  public readonly scopes: ScopesSet

  constructor(scope?: null | string | Iterable<string>) {
    this.scopes = new ScopesSet(
      !scope // "" | null | undefined
        ? undefined
        : typeof scope === 'string'
          ? scope.split(' ')
          : scope,
    )
  }

  public allowsAccount(options: AccountPermissionMatch): boolean {
    return this.scopes.matches('account', options)
  }
  public assertAccount(options: AccountPermissionMatch): void {
    if (!this.allowsAccount(options)) {
      const scope = AccountPermission.scopeNeededFor(options)
      throw new ScopeMissingError(scope)
    }
  }

  public allowsIdentity(options: IdentityPermissionMatch): boolean {
    return this.scopes.matches('identity', options)
  }
  public assertIdentity(options: IdentityPermissionMatch): void {
    if (!this.allowsIdentity(options)) {
      const scope = IdentityPermission.scopeNeededFor(options)
      throw new ScopeMissingError(scope)
    }
  }

  public allowsBlob(options: BlobPermissionMatch): boolean {
    return this.scopes.matches('blob', options)
  }
  public assertBlob(options: BlobPermissionMatch): void {
    if (!this.allowsBlob(options)) {
      const scope = BlobPermission.scopeNeededFor(options)
      throw new ScopeMissingError(scope)
    }
  }

  public allowsRepo(options: RepoPermissionMatch): boolean {
    return this.scopes.matches('repo', options)
  }
  public assertRepo(options: RepoPermissionMatch): void {
    if (!this.allowsRepo(options)) {
      const scope = RepoPermission.scopeNeededFor(options)
      throw new ScopeMissingError(scope)
    }
  }

  public allowsRpc(options: RpcPermissionMatch): boolean {
    return this.scopes.matches('rpc', options)
  }
  public assertRpc(options: RpcPermissionMatch): void {
    if (!this.allowsRpc(options)) {
      const scope = RpcPermission.scopeNeededFor(options)
      throw new ScopeMissingError(scope)
    }
  }
}
