import { Parser, knownValuesValidator } from '../parser.js'
import { ResourceSyntax } from '../syntax.js'

const IDENTITY_ATTRIBUTES = Object.freeze(['handle', '*'] as const)
export type IdentityAttribute = (typeof IDENTITY_ATTRIBUTES)[number]

const IDENTITY_ACTIONS = Object.freeze(['manage', 'submit'] as const)
export type IdentityAction = (typeof IDENTITY_ACTIONS)[number]

export const identityParser = new Parser(
  'identity',
  {
    attribute: {
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
  'attribute',
)

export type IdentityScopeMatch = {
  attribute: IdentityAttribute
  action: IdentityAction
}

export class IdentityScope {
  constructor(
    public readonly attribute: IdentityAttribute,
    public readonly action: IdentityAction,
  ) {}

  matches(options: IdentityScopeMatch): boolean {
    return (
      (this.attribute === '*' || this.attribute === options.attribute) &&
      this.action === options.action
    )
  }

  toString() {
    return identityParser.format(this)
  }

  static fromString(scope: string) {
    const syntax = ResourceSyntax.fromString(scope)
    return this.fromSyntax(syntax)
  }

  static fromSyntax(syntax: ResourceSyntax) {
    const result = identityParser.parse(syntax)
    if (!result) return null
    return new IdentityScope(result.attribute, result.action)
  }

  static scopeNeededFor(options: IdentityScopeMatch): string {
    return identityParser.format(options)
  }
}
