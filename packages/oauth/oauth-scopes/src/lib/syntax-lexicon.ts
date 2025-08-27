import { LexPermission } from './lexicon.js'
import { ScopeSyntax } from './syntax.js'

/**
 * Translates a {@link LexPermission} into a {@link ScopeSyntax}.
 */
export class LexPermissionSyntax<P extends string = string>
  implements ScopeSyntax<P>
{
  constructor(
    readonly lexPermission: Readonly<LexPermission & { resource: P }>,
  ) {}

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
    if (Array.isArray(value)) return null
    return value
  }

  getMulti(key: string) {
    const value = this.get(key)
    if (value === undefined) return undefined
    if (!Array.isArray(value)) return null
    return value
  }

  toJSON() {
    return this.lexPermission
  }
}
