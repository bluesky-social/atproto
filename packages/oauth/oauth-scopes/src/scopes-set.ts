import { ScopeMissingError } from './scope-missing-error.js'
import {
  ScopeMatchingOptionsByResource,
  scopeMatches,
  scopeNeededFor,
} from './utilities.js'

export { ScopeMissingError }

/**
 * Utility class to manage a set of scopes and check if they match specific
 * options for a given resource.
 */
export class ScopesSet extends Set<string> {
  /**
   * Check if the container has a scope that matches the given options for a
   * specific resource.
   */
  public matches<R extends keyof ScopeMatchingOptionsByResource>(
    resource: R,
    options: ScopeMatchingOptionsByResource[R],
  ): boolean {
    for (const scope of this) {
      if (scopeMatches(scope, resource, options)) return true
    }
    return false
  }

  public assert<R extends keyof ScopeMatchingOptionsByResource>(
    resource: R,
    options: ScopeMatchingOptionsByResource[R],
  ) {
    if (!this.matches(resource, options)) {
      const scope = scopeNeededFor(resource, options)
      throw new ScopeMissingError(scope)
    }
  }

  public some(fn: (scope: string) => boolean): boolean {
    for (const scope of this) if (fn(scope)) return true
    return false
  }

  public every(fn: (scope: string) => boolean): boolean {
    for (const scope of this) if (!fn(scope)) return false
    return true
  }

  public *filter(fn: (scope: string) => boolean) {
    for (const scope of this) if (fn(scope)) yield scope
  }

  public *map<O>(fn: (scope: string) => O) {
    for (const scope of this) yield fn(scope)
  }

  static fromString(string?: string): ScopesSet {
    return new ScopesSet(string?.split(' '))
  }
}
