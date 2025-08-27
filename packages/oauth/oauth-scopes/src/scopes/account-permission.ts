import { Parser } from '../lib/parser.js'
import { ResourcePermission } from '../lib/resource-permission.js'
import { ScopeStringSyntax } from '../lib/syntax-string.js'
import { ScopeSyntax, isScopeStringFor } from '../lib/syntax.js'
import { knownValuesValidator } from '../lib/util.js'

export const ACCOUNT_ATTRIBUTES = Object.freeze([
  'email',
  'repo',
  'status',
] as const)
export type AccountAttribute = (typeof ACCOUNT_ATTRIBUTES)[number]

export const ACCOUNT_ACTIONS = Object.freeze(['read', 'manage'] as const)
export type AccountAction = (typeof ACCOUNT_ACTIONS)[number]

export type AccountPermissionMatch = {
  attr: AccountAttribute
  action: AccountAction
}

export class AccountPermission
  implements ResourcePermission<'account', AccountPermissionMatch>
{
  constructor(
    public readonly attr: AccountAttribute,
    public readonly action: AccountAction,
  ) {}

  matches(options: AccountPermissionMatch) {
    return (
      this.attr === options.attr &&
      (this.action === 'manage' || this.action === options.action)
    )
  }

  toString() {
    return AccountPermission.parser.format(this)
  }

  protected static readonly parser = new Parser(
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

  static fromString(scope: string) {
    if (!isScopeStringFor(scope, 'account')) return null
    const syntax = ScopeStringSyntax.fromString(scope)
    return AccountPermission.fromSyntax(syntax)
  }

  static fromSyntax(syntax: ScopeSyntax<'account'>) {
    const result = AccountPermission.parser.parse(syntax)
    if (!result) return null

    return new AccountPermission(result.attr, result.action)
  }

  static scopeNeededFor(options: AccountPermissionMatch) {
    return AccountPermission.parser.format(options)
  }
}
