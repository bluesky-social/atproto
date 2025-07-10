import { NeRoArray, ParsedResourceScope, formatScope } from '../scope-syntax'

const REPO_PARAMS = Object.freeze(['collection', 'action'] as const)
const REPO_ACTIONS = Object.freeze(['create', 'delete', 'update'] as const)

export type RepoAction = (typeof REPO_ACTIONS)[number]
export function isRepoAction(action: string): action is RepoAction {
  return (REPO_ACTIONS as readonly string[]).includes(action)
}

export type RepoScopeMatch = {
  collection: string
  action: RepoAction
}

export class RepoScope {
  constructor(
    public readonly collection: string,
    public readonly actions: NeRoArray<RepoAction> = REPO_ACTIONS,
  ) {}

  toString(): string {
    const { collection, actions } = this

    // Normalize action (default value, de-dupe, sort)
    const action = REPO_ACTIONS.every(includedIn, actions)
      ? undefined
      : (REPO_ACTIONS.filter(includedIn, actions) as [string, ...string[]])

    return formatScope('repo', { collection, action }, 'collection')
  }

  matches(options: RepoScopeMatch): boolean {
    const { collection, actions } = this
    if (collection !== options.collection) return false
    return actions.includes(options.action)
  }

  static scopeNeededFor(options: RepoScopeMatch): string {
    return new RepoScope(options.collection, [options.action]).toString()
  }

  static fromString(scope: string): RepoScope | null {
    const parsed = ParsedResourceScope.fromString(scope)

    if (!parsed.is('repo')) return null

    const collection = parsed.getSingle('collection', true)
    if (!collection) return null

    const actions = parsed.getMulti('action')
    if (actions === null) return null
    if (actions !== undefined && !actions.every(isRepoAction)) {
      return null
    }

    if (parsed.containsParamsOtherThan(REPO_PARAMS)) {
      return null
    }

    return new RepoScope(collection, actions as NeRoArray<RepoAction>)
  }
}

function includedIn<T>(this: readonly T[], value: T): boolean {
  return this.includes(value)
}
