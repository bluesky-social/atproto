import type { LexiconPermission } from './lexicon.js'
import type { ScopeSyntax } from './syntax.js'

const isArray: (value: unknown) => value is readonly unknown[] = Array.isArray

/**
 * Translates a {@link LexiconPermission} into a {@link ScopeSyntax}.
 */
export class LexPermissionSyntax<
  P extends string = string,
> implements ScopeSyntax<P> {
  constructor(readonly lexPermission: LexiconPermission<P>) {}

  get prefix() {
    return this.lexPermission.resource
  }

  get positional() {
    return undefined
  }

  get(key: string) {
    // Ignore reserved keywords
    if (key === 'type') return undefined
    if (key === 'resource') return undefined

    // Ignore inherited properties (toString(), etc.)
    if (!Object.hasOwn(this.lexPermission, key)) return undefined

    return this.lexPermission[key]
  }

  *keys() {
    for (const key of Object.keys(this.lexPermission)) {
      if (this.get(key) !== undefined) yield key
    }
  }

  getSingle(key: string) {
    const value = this.get(key)
    if (isArray(value)) return null
    return value
  }

  getMulti(key: string) {
    const value = this.get(key)
    if (value === undefined) return undefined
    if (!isArray(value)) return null
    return value
  }

  toJSON() {
    return this.lexPermission
  }
}

/**
 * Lexicon documents cannot use `type` because it is reserved (and should always
 * be "resource"). For that reason, it uses `spaceType`. The `space:` scope
 * syntax, however, uses `type`. This class translates between the two.
 */
export class LexSpacePermissionSyntax extends LexPermissionSyntax<'space'> {
  get(key: string) {
    if (key === 'type') return this.lexPermission.spaceType
    if (key === 'spaceType') return undefined
    return super.get(key)
  }

  *keys() {
    for (const key of super.keys()) {
      yield key === 'spaceType' ? 'type' : key
    }
  }
}
