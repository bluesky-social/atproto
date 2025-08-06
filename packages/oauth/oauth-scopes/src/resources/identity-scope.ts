import { Parser, knownValuesValidator } from '../parser.js'
import { ResourceSyntax, isScopeForResource } from '../syntax.js'

const IDENTITY_ATTRIBUTES = Object.freeze(['handle', '*'] as const)
export type IdentityAttribute = (typeof IDENTITY_ATTRIBUTES)[number]

const IDENTITY_ACTIONS = Object.freeze(['manage', 'submit'] as const)
export type IdentityAction = (typeof IDENTITY_ACTIONS)[number]

export const identityParser = new Parser(
  'identity',
  {
    attr: {
      multiple: false,
      required: true,
      validate: knownValuesValidator(IDENTITY_ATTRIBUTES),
    },
    action: {
      multiple: false,
      required: false,
      validate: knownValuesValidator(IDENTITY_ACTIONS),
      default: 'manage' as const,
    },
  },
  'attr',
)

export type IdentityScopeMatch = {
  attr: IdentityAttribute
  action: IdentityAction
}

export class IdentityScope {
  constructor(
    public readonly attr: IdentityAttribute,
    public readonly action: IdentityAction,
  ) {}

  matches(options: IdentityScopeMatch): boolean {
    return (
      (this.attr === '*' || this.attr === options.attr) &&
      this.action === options.action
    )
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
    return new IdentityScope(result.attr, result.action)
  }

  static scopeNeededFor(options: IdentityScopeMatch): string {
    return identityParser.format(options)
  }
}
