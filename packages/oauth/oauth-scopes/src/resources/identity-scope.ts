import { Parser, knownValuesValidator } from '../parser.js'
import { ResourceSyntax, isScopeForResource } from '../syntax.js'

const IDENTITY_ATTRIBUTES = Object.freeze(['handle', '*'] as const)
export type IdentityAttribute = (typeof IDENTITY_ATTRIBUTES)[number]

export const identityParser = new Parser(
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

export type IdentityScopeMatch = {
  attr: IdentityAttribute
}

export class IdentityScope {
  constructor(public readonly attr: IdentityAttribute) {}

  matches(options: IdentityScopeMatch): boolean {
    return this.attr === '*' || this.attr === options.attr
  }

  toString() {
    return identityParser.format(this)
  }

  static fromString(scope: string) {
    if (!isScopeForResource(scope, 'identity')) return null
    const syntax = ResourceSyntax.fromString(scope)
    return this.fromSyntax(syntax)
  }

  static fromSyntax(syntax: ResourceSyntax) {
    const result = identityParser.parse(syntax)
    if (!result) return null
    return new IdentityScope(result.attr)
  }

  static scopeNeededFor(options: IdentityScopeMatch): string {
    return identityParser.format(options)
  }
}
