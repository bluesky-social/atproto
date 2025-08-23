import { Matchable } from '../lib/matchable.js'
import { Nsid, isNsid } from '../lib/nsid.js'
import { knownValuesValidator } from '../lib/util.js'
import { Parser } from '../parser.js'
import { NeRoArray, ScopeSyntax, isScopeSyntaxFor } from '../syntax.js'
import type { LexPermission } from '../types.js'

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

export class RepoPermission implements Matchable<RepoPermissionMatch> {
  constructor(
    public readonly collection: NeRoArray<'*' | Nsid>,
    public readonly action: NeRoArray<RepoAction>,
  ) {}

  get allowsAnyCollection() {
    return this.collection.includes('*')
  }

  matches({ action, collection }: RepoPermissionMatch): boolean {
    return (
      this.action.includes(action) &&
      (this.allowsAnyCollection ||
        (this.collection as readonly string[]).includes(collection))
    )
  }

  toString(): string {
    // Normalize (compress, de-dupe, sort)
    return RepoPermission.parser.format({
      collection: this.allowsAnyCollection
        ? ['*']
        : this.collection.length > 1
          ? ([...new Set(this.collection)].sort() as [Nsid, ...Nsid[]])
          : this.collection,
      action:
        this.action === REPO_ACTIONS
          ? REPO_ACTIONS // No need to filter if the default was used
          : (REPO_ACTIONS.filter(includedIn, this.action) as [
              RepoAction,
              ...RepoAction[],
            ]),
    })
  }

  protected static readonly parser = new Parser(
    'repo',
    {
      collection: {
        multiple: true,
        required: true,
        validate: isCollectionParam,
        normalize: (value) => {
          if (value.length > 1 && value.includes('*')) return ['*'] as const
          return value
        },
      },
      action: {
        multiple: true,
        required: false,
        validate: isRepoAction,
        default: REPO_ACTIONS,
      },
    },
    'collection',
  )

  static fromString(scope: string): RepoPermission | null {
    if (!isScopeSyntaxFor(scope, 'repo')) return null
    const syntax = ScopeSyntax.fromString(scope)
    return RepoPermission.fromSyntax(syntax)
  }

  static fromLex(lexPermission: LexPermission) {
    if (lexPermission.resource !== 'repo') return null
    const syntax = ScopeSyntax.fromLex(lexPermission)
    return RepoPermission.fromSyntax(syntax)
  }

  static fromSyntax(syntax: ScopeSyntax): RepoPermission | null {
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
