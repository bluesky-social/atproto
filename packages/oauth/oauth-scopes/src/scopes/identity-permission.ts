import { Matchable } from '../lib/matchable.js'
import { knownValuesValidator } from '../lib/util.js'
import { Parser } from '../parser.js'
import { ScopeStringSyntax, ScopeSyntax, isScopeStringFor } from '../syntax.js'

export const IDENTITY_ATTRIBUTES = Object.freeze(['handle', '*'] as const)
export type IdentityAttribute = (typeof IDENTITY_ATTRIBUTES)[number]

export type IdentityPermissionMatch = {
  attr: IdentityAttribute
}

export class IdentityPermission implements Matchable<IdentityPermissionMatch> {
  constructor(public readonly attr: IdentityAttribute) {}

  matches(options: IdentityPermissionMatch): boolean {
    return this.attr === '*' || this.attr === options.attr
  }

  toString() {
    return IdentityPermission.parser.format(this)
  }

  protected static readonly parser = new Parser(
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
    if (!isScopeStringFor(scope, 'identity')) return null
    const syntax = ScopeStringSyntax.fromString(scope)
    return IdentityPermission.fromSyntax(syntax)
  }

  static fromSyntax(syntax: ScopeSyntax) {
    const result = IdentityPermission.parser.parse(syntax)
    if (!result) return null
    return new IdentityPermission(result.attr)
  }

  static scopeNeededFor(options: IdentityPermissionMatch): string {
    return IdentityPermission.parser.format(options)
  }
}
