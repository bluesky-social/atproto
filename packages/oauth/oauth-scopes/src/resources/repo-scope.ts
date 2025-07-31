import { NeRoArray, ParsedResourceScope, formatScope } from '../syntax'

const REPO_PARAMS = Object.freeze(['collection', 'action'] as const)
const REPO_ACTIONS = Object.freeze(['create', 'delete', 'update', '*'] as const)

export type RepoAction = (typeof REPO_ACTIONS)[number]
export function isRepoAction(action: string): action is RepoAction {
  return (REPO_ACTIONS as readonly string[]).includes(action)
}

export function isRepoActionArray(
  actions: NeRoArray<string>,
): actions is NeRoArray<RepoAction> {
  return actions.every(isRepoAction)
}

export type RepoScopeMatch = {
  collection: string
  action: RepoAction
}

export class RepoScope {
  constructor(
    public readonly collections: NeRoArray<string>,
    public readonly actions: NeRoArray<RepoAction>,
  ) {}

  matches({ action, collection }: RepoScopeMatch): boolean {
    return (
      (this.actions.includes('*') || this.actions.includes(action)) &&
      (this.collections.includes('*') || this.collections.includes(collection))
    )
  }

  toString(): string {
    const { collections, actions } = this

    // Normalize (wildcard, de-dupe, sort)
    const action: NeRoArray<string> = actions.includes('*')
      ? ['*']
      : (REPO_ACTIONS.filter(includedIn, actions) as [string, ...string[]])

    const collection: NeRoArray<string> = collections.includes('*')
      ? ['*']
      : ([...new Set(collections)].sort() as [string, ...string[]])

    return formatScope(
      'repo',
      [
        ['collection', collection],
        ['action', action],
      ],
      'action',
    )
  }

  static fromString(scope: string): RepoScope | null {
    const parsed = ParsedResourceScope.fromString(scope)
    return this.fromParsed(parsed)
  }

  static fromParsed(parsed: ParsedResourceScope): RepoScope | null {
    if (!parsed.is('repo')) return null

    const collections = parsed.getMulti('collection', true)
    if (!collections) return null

    const actions = parsed.getMulti('action')
    if (!actions || !isRepoActionArray(actions)) return null
    if (actions.includes('*') && actions.length > 1) return null

    if (parsed.containsParamsOtherThan(REPO_PARAMS)) {
      return null
    }

    // @NOTE We do not check for duplicate actions here

    return new RepoScope(collections, actions)
  }

  static scopeNeededFor(options: RepoScopeMatch): string {
    return new RepoScope([options.collection], [options.action]).toString()
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
