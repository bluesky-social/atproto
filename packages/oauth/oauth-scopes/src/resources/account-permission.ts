import { knownValuesValidator } from '../lib/util.js'
import { Parser } from '../parser.js'
import { ResourceSyntax, isResourceSyntaxFor } from '../syntax.js'
import type { LexPermission } from '../types.js'

export type { LexPermission }

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

export class AccountPermission {
  constructor(
    public readonly attr: AccountAttribute,
    public readonly action: AccountAction,
  ) {}

  matches(options: AccountPermissionMatch): boolean {
    return (
      this.attr === options.attr &&
      (this.action === 'manage' || this.action === options.action)
    )
  }

  toString() {
    return AccountPermission.parser.format(this)
  }

  static readonly parser = new Parser(
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
    if (!isResourceSyntaxFor(scope, 'account')) return null
    const syntax = ResourceSyntax.fromString(scope)
    return AccountPermission.fromSyntax(syntax)
  }

  static fromLex(lexPermission: LexPermission) {
    if (lexPermission.resource !== 'account') return null
    const syntax = ResourceSyntax.fromLex(lexPermission)
    return AccountPermission.fromSyntax(syntax)
  }

  static fromSyntax(syntax: ResourceSyntax) {
    const result = AccountPermission.parser.parse(syntax)
    if (!result) return null

    return new AccountPermission(result.attr, result.action)
  }

  static scopeNeededFor(options: AccountPermissionMatch): string {
    return AccountPermission.parser.format(options)
  }
}
