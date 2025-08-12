import { NSID, isNSID } from '../lib/nsid.js'
import { Parser, knownValuesValidator } from '../parser.js'
import { NeRoArray, ResourceSyntax, isScopeForResource } from '../syntax.js'

const REPO_ACTIONS = Object.freeze(['create', 'update', 'delete'] as const)
export type RepoAction = (typeof REPO_ACTIONS)[number]
export const isRepoAction = knownValuesValidator(REPO_ACTIONS)

export const repoParser = new Parser(
  'repo',
  {
    collection: {
      multiple: true,
      required: true,
      validate: (value) => value === '*' || isNSID(value),
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

export type RepoScopeMatch = {
  collection: string
  action: RepoAction
}

export class RepoScope {
  constructor(
    public readonly collection: NeRoArray<'*' | NSID>,
    public readonly action: NeRoArray<RepoAction>,
  ) {}

  get allowsAnyCollection() {
    return this.collection.includes('*')
  }

  matches({ action, collection }: RepoScopeMatch): boolean {
    return (
      this.action.includes(action) &&
      (this.allowsAnyCollection ||
        (this.collection as readonly string[]).includes(collection))
    )
  }

  toString(): string {
    // Normalize (compress, de-dupe, sort)
    return repoParser.format({
      collection: this.allowsAnyCollection
        ? ['*']
        : this.collection.length > 1
          ? ([...new Set(this.collection)].sort() as [NSID, ...NSID[]])
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

  static fromString(scope: string): RepoScope | null {
    if (!isScopeForResource(scope, 'repo')) return null
    const syntax = ResourceSyntax.fromString(scope)
    return this.fromSyntax(syntax)
  }

  static fromSyntax(syntax: ResourceSyntax): RepoScope | null {
    const result = repoParser.parse(syntax)
    if (!result) return null

    return new RepoScope(result.collection, result.action)
  }

  static scopeNeededFor(options: RepoScopeMatch): string {
    return repoParser.format({
      collection: [options.collection as '*' | NSID],
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
