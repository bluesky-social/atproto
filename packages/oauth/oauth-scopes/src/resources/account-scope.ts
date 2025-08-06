import { Parser, knownValuesValidator } from '../parser.js'
import { ResourceSyntax, isScopeForResource } from '../syntax.js'

const ACCOUNT_ATTRIBUTES = Object.freeze(['email', 'repo', 'status'] as const)
export type AccountAttribute = (typeof ACCOUNT_ATTRIBUTES)[number]

const ACCOUNT_ACTIONS = Object.freeze(['read', 'manage'] as const)
export type AccountAction = (typeof ACCOUNT_ACTIONS)[number]

export const accountParser = new Parser(
  'account',
  {
    attr: {
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
  'attr',
)

export type AccountScopeMatch = {
  attr: AccountAttribute
  action: AccountAction
}

export class AccountScope {
  constructor(
    public readonly attr: AccountAttribute,
    public readonly action: AccountAction,
  ) {}

  matches(options: AccountScopeMatch): boolean {
    return (
      this.attr === options.attr &&
      (this.action === 'manage' || this.action === options.action)
    )
  }

  toString() {
    return accountParser.format(this)
  }

  static fromString(scope: string) {
    if (!isScopeForResource(scope, 'account')) return null
    const syntax = ResourceSyntax.fromString(scope)
    return this.fromSyntax(syntax)
  }

  static fromSyntax(syntax: ResourceSyntax) {
    const result = accountParser.parse(syntax)
    if (!result) return null

    return new AccountScope(result.attr, result.action)
  }

  static scopeNeededFor(options: AccountScopeMatch): string {
    return accountParser.format(options)
  }
}
