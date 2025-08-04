import { AccountScope, AccountScopeMatch } from './resources/account-scope.js'
import { BlobScope, BlobScopeMatch } from './resources/blob-scope.js'
import {
  IdentityScope,
  IdentityScopeMatch,
} from './resources/identity-scope.js'
import { RepoScope, RepoScopeMatch } from './resources/repo-scope.js'
import { RpcScope, RpcScopeMatch } from './resources/rpc-scope.js'
import { ScopeMissingError } from './scope-missing-error.js'
import { ScopesSet } from './scopes-set.js'

export type {
  AccountScopeMatch,
  BlobScopeMatch,
  IdentityScopeMatch,
  RepoScopeMatch,
  RpcScopeMatch,
}

export class PermissionSet {
  public readonly scopes: ScopesSet

  constructor(scopes?: null | string | Iterable<string>) {
    this.scopes = new ScopesSet(
      typeof scopes === 'string' ? scopes.split(' ') : scopes,
    )
  }

  public allowsAccount(options: AccountScopeMatch): boolean {
    return this.scopes.matches('account', options)
  }
  public assertAccount(options: AccountScopeMatch): void {
    if (!this.allowsAccount(options)) {
      const scope = AccountScope.scopeNeededFor(options)
      throw new ScopeMissingError(scope)
    }
  }

  public allowsIdentity(options: IdentityScopeMatch): boolean {
    return this.scopes.matches('identity', options)
  }
  public assertIdentity(options: IdentityScopeMatch): void {
    if (!this.allowsIdentity(options)) {
      const scope = IdentityScope.scopeNeededFor(options)
      throw new ScopeMissingError(scope)
    }
  }

  public allowsBlob(options: BlobScopeMatch): boolean {
    return this.scopes.matches('blob', options)
  }
  public assertBlob(options: BlobScopeMatch): void {
    if (!this.allowsBlob(options)) {
      const scope = BlobScope.scopeNeededFor(options)
      throw new ScopeMissingError(scope)
    }
  }

  public allowsRepo(options: RepoScopeMatch): boolean {
    return this.scopes.matches('repo', options)
  }
  public assertRepo(options: RepoScopeMatch): void {
    if (!this.allowsRepo(options)) {
      const scope = RepoScope.scopeNeededFor(options)
      throw new ScopeMissingError(scope)
    }
  }

  public allowsRpc(options: RpcScopeMatch): boolean {
    return this.scopes.matches('rpc', options)
  }
  public assertRpc(options: RpcScopeMatch): void {
    if (!this.allowsRpc(options)) {
      const scope = RpcScope.scopeNeededFor(options)
      throw new ScopeMissingError(scope)
    }
  }
}
