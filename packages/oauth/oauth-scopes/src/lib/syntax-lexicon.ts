import { LexiconPermission } from './lexicon.js'
import { ScopeSyntax } from './syntax.js'

const isArray: (value: unknown) => value is readonly unknown[] = Array.isArray

/**
 * Translates a {@link LexiconPermission} into a {@link ScopeSyntax}.
 */
export class LexPermissionSyntax<P extends string = string>
  implements ScopeSyntax<P>
{
  constructor(readonly lexPermission: LexiconPermission<P>) {}

  get prefix() {
    return this.lexPermission.resource
  }

  get positional() {
    return undefined
  }

  get(key: string) {
    // Ignore reserved keywords
    if (key === 'type') {
      // The "space" resource has a "type" scope-param, but lexicon permission
      // JSON uses `type: 'permission'` as a discriminator. Permission set
      // entries spell the space type as `spaceType` in JSON; we surface it
      // here under its scope-string name "type".
      if (this.lexPermission.resource === 'space') {
        if (!Object.hasOwn(this.lexPermission, 'spaceType')) return undefined
        return this.lexPermission['spaceType']
      }
      return undefined
    }
    if (key === 'resource') return undefined
    if (key === 'spaceType') return undefined

    // Ignore inherited properties (toString(), etc.)
    if (!Object.hasOwn(this.lexPermission, key)) return undefined

    return this.lexPermission[key]
  }

  *keys() {
    const isSpace = this.lexPermission.resource === 'space'
    for (const key of Object.keys(this.lexPermission)) {
      // Surface JSON `spaceType` as scope-string `type` for space resources.
      const surfaceKey = isSpace && key === 'spaceType' ? 'type' : key
      if (this.get(surfaceKey) !== undefined) yield surfaceKey
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
