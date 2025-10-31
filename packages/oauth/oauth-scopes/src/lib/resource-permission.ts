import { ScopeStringFor } from './syntax.js'
import { Matchable } from './util.js'

/**
 * Interface destined to provide consistency across parsed permission scopes for
 * resources (blob, repo, etc.).
 */
export interface ResourcePermission<R extends string, T> extends Matchable<T> {
  toString(): ScopeStringFor<R>
}
