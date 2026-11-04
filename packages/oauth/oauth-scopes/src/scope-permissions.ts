import { SpaceRef } from '@atproto/syntax'
import { ScopeMissingError } from './scope-missing-error.js'
import {
  AccountPermission,
  type AccountPermissionMatch,
} from './scopes/account-permission.js'
import {
  BlobPermission,
  type BlobPermissionMatch,
} from './scopes/blob-permission.js'
import {
  IdentityPermission,
  type IdentityPermissionMatch,
} from './scopes/identity-permission.js'
import {
  RepoPermission,
  type RepoPermissionMatch,
} from './scopes/repo-permission.js'
import {
  RpcPermission,
  type RpcPermissionMatch,
} from './scopes/rpc-permission.js'
import {
  SpacePermission,
  type SpacePermissionMatch,
  type SpacePermissionMatchOperation,
  type SpacePermissionMatchReference,
  type SpaceTarget,
} from './scopes/space-permission.js'
import { ScopesSet } from './scopes-set.js'

export type {
  AccountPermissionMatch,
  BlobPermissionMatch,
  IdentityPermissionMatch,
  RepoPermissionMatch,
  RpcPermissionMatch,
  SpacePermissionMatch,
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

  public allowsSpace(
    target: SpaceTarget,
    operation: SpacePermissionMatchOperation,
  ): boolean {
    return this.scopes.matches('space', {
      ...toMatchReference(target),
      ...operation,
    })
  }
  public assertSpace(
    target: SpaceTarget,
    operation: SpacePermissionMatchOperation,
  ): void {
    if (!this.allowsSpace(target, operation)) {
      const scope = SpacePermission.scopeNeededFor({
        ...toMatchReference(target),
        ...operation,
      })
      throw new ScopeMissingError(scope)
    }
  }
}

function toMatchReference(target: SpaceTarget): SpacePermissionMatchReference {
  // A string must be a space ref: a record uri within a space is rejected
  // rather than read as the space it belongs to.
  const ref = typeof target === 'string' ? SpaceRef.parse(target) : target
  if ('spaceDid' in ref) {
    return { spaceType: ref.spaceType, authority: ref.spaceDid, skey: ref.skey }
  }
  return ref
}
