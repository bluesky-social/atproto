import { ForbiddenError } from '@atproto/xrpc-server'
import { AccountScope, AccountScopeMatch } from './resources/account-scope'
import { BlobScope, BlobScopeMatch } from './resources/blob-scope'
import { IdentityScope, IdentityScopeMatch } from './resources/identity-scope'
import { RepoScope, RepoScopeMatch } from './resources/repo-scope'
import { RpcScope, RpcScopeMatch } from './resources/rpc-scope'
import { ScopesSet } from './scopes-set'

export type {
  AccountScopeMatch,
  BlobScopeMatch,
  IdentityScopeMatch,
  RepoScopeMatch,
  RpcScopeMatch,
}

export class PermissionSet {
  public readonly scopes: ScopesSet

  constructor(scopes?: null | Iterable<string>) {
    this.scopes = new ScopesSet(scopes)
  }

  public allowsAccount(options: AccountScopeMatch): boolean {
    return this.scopes.matches('account', options)
  }
  public assertAccount(options: AccountScopeMatch): void {
    if (!this.allowsAccount(options)) {
      const scope = AccountScope.scopeNeededFor(options)
      throw new ForbiddenError(`Missing scope "${scope}"`)
    }
  }

  public allowsIdentity(options: IdentityScopeMatch): boolean {
    return this.scopes.matches('identity', options)
  }
  public assertIdentity(options: IdentityScopeMatch): void {
    if (!this.allowsIdentity(options)) {
      const scope = IdentityScope.scopeNeededFor(options)
      throw new ForbiddenError(`Missing scope "${scope}"`)
    }
  }

  public allowsBlob(options: BlobScopeMatch): boolean {
    return this.scopes.matches('blob', options)
  }
  public assertBlob(options: BlobScopeMatch): void {
    if (!this.allowsBlob(options)) {
      const scope = BlobScope.scopeNeededFor(options)
      throw new ForbiddenError(`Missing scope "blob", "blob:*/*" or "${scope}"`)
    }
  }

  public allowsRepo(options: RepoScopeMatch): boolean {
    return this.scopes.matches('repo', options)
  }
  public assertRepo(options: RepoScopeMatch): void {
    if (!this.allowsRepo(options)) {
      const scope = RepoScope.scopeNeededFor(options)
      throw new ForbiddenError(`Missing scope "${scope}"`)
    }
  }

  public allowsRpc(options: RpcScopeMatch): boolean {
    return this.scopes.matches('rpc', options)
  }
  public assertRpc(options: RpcScopeMatch): void {
    if (!this.allowsRpc(options)) {
      const scope = RpcScope.scopeNeededFor(options)
      throw new ForbiddenError(`Missing scope "${scope}"`)
    }
  }
}
