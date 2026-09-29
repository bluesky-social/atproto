import type { Selectable } from 'kysely'
import type { DatetimeString } from '@atproto/lex'

/**
 * Email-based two-factor authentication, kept out of `account` so that adding
 * further factors later does not mean altering that table again.
 *
 * A row exists only while the factor is enabled — there is no "disabled" row —
 * so `selectAccountQB` reaches it with a LEFT join and surfaces a null when the
 * factor is off.
 */
export interface AccountEmailAuthFactor {
  did: string
  emailAuthFactorEnabledAt: DatetimeString
}

export type AccountEmailAuthFactorEntry = Selectable<AccountEmailAuthFactor>

export const tableName = 'account_email_auth_factor'

export type PartialDB = { [tableName]: AccountEmailAuthFactor }
