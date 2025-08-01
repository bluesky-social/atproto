import { Parser, knownValuesValidator } from '../parser.js'
import { ResourceSyntax } from '../syntax.js'

const ACCOUNT_ATTRIBUTES = Object.freeze(['email', 'repo', 'status'] as const)
export type AccountAttribute = (typeof ACCOUNT_ATTRIBUTES)[number]

const ACCOUNT_ACTIONS = Object.freeze(['read', 'manage'] as const)
export type AccountAction = (typeof ACCOUNT_ACTIONS)[number]

export const accountParser = new Parser(
  'account',
  {
    attribute: {
      multiple: false,
      required: true,
      validate: knownValuesValidator(ACCOUNT_ATTRIBUTES),
    },
    action: {
      multiple: false,
      required: false,
      validate: knownValuesValidator(ACCOUNT_ACTIONS),
      default: 'read' as const,
    },
  },
  'attribute',
)

export type AccountScopeMatch = {
  attribute: AccountAttribute
  action: AccountAction
}

export class AccountScope {
  constructor(
    public readonly attribute: AccountAttribute,
    public readonly action: AccountAction,
  ) {}

  matches(options: AccountScopeMatch): boolean {
    return (
      this.attribute === options.attribute && this.action === options.action
    )
  }

  toString() {
    return accountParser.format(this)
  }

  static fromString(scope: string) {
    const syntax = ResourceSyntax.fromString(scope)
    return this.fromSyntax(syntax)
  }

  static fromSyntax(syntax: ResourceSyntax) {
    const result = accountParser.parse(syntax)
    if (!result) return null

    return new AccountScope(result.attribute, result.action)
  }

  static scopeNeededFor(options: AccountScopeMatch): string {
    return accountParser.format(options)
  }
}
