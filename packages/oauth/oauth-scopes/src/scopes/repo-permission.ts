import { Nsid, isNsid } from '../lib/nsid.js'
import { Parser } from '../lib/parser.js'
import { ResourcePermission } from '../lib/resource-permission.js'
import { ScopeStringSyntax } from '../lib/syntax-string.js'
import {
  NeArray,
  NeRoArray,
  ScopeSyntax,
  isScopeStringFor,
} from '../lib/syntax.js'
import { knownValuesValidator } from '../lib/util.js'

export { type Nsid, isNsid }

export const REPO_ACTIONS = Object.freeze([
  'create',
  'update',
  'delete',
] as const)
export type RepoAction = (typeof REPO_ACTIONS)[number]
export const isRepoAction = knownValuesValidator(REPO_ACTIONS)

export type CollectionParam = '*' | Nsid
export const isCollectionParam = (value: unknown): value is CollectionParam =>
  value === '*' || isNsid(value)

export type RepoPermissionMatch = {
  collection: string
  action: RepoAction
}

export class RepoPermission
  implements ResourcePermission<'repo', RepoPermissionMatch>
{
  constructor(
    public readonly collection: NeRoArray<'*' | Nsid>,
    public readonly action: NeRoArray<RepoAction>,
  ) {}

  matches({ action, collection }: RepoPermissionMatch) {
    return (
      this.action.includes(action) &&
      (this.collection.includes('*') ||
        (this.collection as readonly string[]).includes(collection))
    )
  }

  toString() {
    return RepoPermission.parser.format(this)
  }

  protected static readonly parser = new Parser(
    'repo',
    {
      collection: {
        multiple: true,
        required: true,
        validate: isCollectionParam,
        normalize: (value) => {
          if (value.length > 1) {
            if (value.includes('*')) return ['*'] as const
            return [...new Set(value)].sort() as NeArray<Nsid>
          }
          return value as ['*' | Nsid]
        },
      },
      action: {
        multiple: true,
        required: false,
        validate: isRepoAction,
        default: REPO_ACTIONS,
        normalize: (value) => {
          return value === REPO_ACTIONS
            ? REPO_ACTIONS // No need to filter if the default was used
            : (REPO_ACTIONS.filter(includedIn, value) as NeArray<RepoAction>)
        },
      },
    },
    'collection',
  )

  static fromString(scope: string): RepoPermission | null {
    if (!isScopeStringFor(scope, 'repo')) return null
    const syntax = ScopeStringSyntax.fromString(scope)
    return RepoPermission.fromSyntax(syntax)
  }

  static fromSyntax(syntax: ScopeSyntax<'repo'>): RepoPermission | null {
    const result = RepoPermission.parser.parse(syntax)
    if (!result) return null

    return new RepoPermission(result.collection, result.action)
  }

  static scopeNeededFor(options: RepoPermissionMatch): string {
    return RepoPermission.parser.format({
      collection: [options.collection as '*' | Nsid],
      action: [options.action],
    })
  }
}

/**
 * Special utility function to be used as predicate for array methods like
 * `Array.prototype.includes`, etc. When used as predicate, it expects that
 * the array method is called with a `thisArg` that is a readonly array of
 * the same type as the `value` parameter.
 */
function includedIn<T>(this: readonly T[], value: T): boolean {
  return this.includes(value)
}
