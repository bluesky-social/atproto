import { knownValuesValidator } from '../lib/util.js'
import { Parser } from '../parser.js'
import { ResourceSyntax, isScopeForResource } from '../syntax.js'
import type { LexPermission } from '../types.js'

export const IDENTITY_ATTRIBUTES = Object.freeze(['handle', '*'] as const)
export type IdentityAttribute = (typeof IDENTITY_ATTRIBUTES)[number]

export type IdentityPermissionMatch = {
  attr: IdentityAttribute
}

export class IdentityPermission {
  constructor(public readonly attr: IdentityAttribute) {}

  matches(options: IdentityPermissionMatch): boolean {
    return this.attr === '*' || this.attr === options.attr
  }

  toString() {
    return IdentityPermission.parser.format(this)
  }

  static readonly parser = new Parser(
    'identity',
    {
      attr: {
        multiple: false,
        required: true,
        validate: knownValuesValidator(IDENTITY_ATTRIBUTES),
      },
    },
    'attr',
  )

  static fromString(scope: string) {
    if (!isScopeForResource(scope, 'identity')) return null
    const syntax = ResourceSyntax.fromString(scope)
    return IdentityPermission.fromSyntax(syntax)
  }

  static fromLex(lexPermission: LexPermission) {
    if (lexPermission.resource !== 'identity') return null
    const syntax = ResourceSyntax.fromLex(lexPermission)
    return IdentityPermission.fromSyntax(syntax)
  }

  static fromSyntax(syntax: ResourceSyntax) {
    const result = IdentityPermission.parser.parse(syntax)
    if (!result) return null
    return new IdentityPermission(result.attr)
  }

  static scopeNeededFor(options: IdentityPermissionMatch): string {
    return IdentityPermission.parser.format(options)
  }
}
