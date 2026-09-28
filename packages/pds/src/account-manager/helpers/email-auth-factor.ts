import { type DatetimeString, currentDatetimeString } from '@atproto/lex'
import type { AccountDb } from '../db/index.js'

/**
 * Enables the email auth factor for `did`, provided `email` is still the
 * account's address and is still confirmed.
 *
 * @NOTE `INSERT … SELECT` rather than a read followed by a write: the factor
 * lives in its own table, so that guard would otherwise be a separate query
 * with a window in between. Selecting *from* `account` keeps it a single
 * statement, so it holds atomically against a concurrent email change.
 *
 * Enabling an already-enabled factor is idempotent and keeps the original
 * timestamp: the conflict clause re-assigns the column to itself, which touches
 * the row so `RETURNING` still yields it without moving the clock. `DO NOTHING`
 * would skip the row and return nothing, making "already enabled" and "guard
 * failed" indistinguishable.
 *
 * @returns the stored timestamp, so callers mirror what the database actually
 * holds rather than a value they minted themselves. `null` means the guard
 * failed — no row was written and the account is unchanged.
 */
export const enable = async (
  db: AccountDb,
  did: string,
  email: string,
): Promise<DatetimeString | null> => {
  const emailAuthFactorEnabledAt = currentDatetimeString()

  const [row] = await db.executeWithRetry(
    db.db
      .insertInto('account_email_auth_factor')
      .columns(['did', 'emailAuthFactorEnabledAt'])
      .expression((eb) =>
        eb
          .selectFrom('account')
          .select((eb2) => [
            'account.did',
            eb2.val(emailAuthFactorEnabledAt).as('emailAuthFactorEnabledAt'),
          ])
          .where('did', '=', did)
          .where('email', '=', email.toLowerCase())
          .where('emailConfirmedAt', 'is not', null),
      )
      .onConflict((oc) =>
        oc.column('did').doUpdateSet((eb) => ({
          // The bare column is the stored value; `excluded` would be the one
          // just offered. Self-assigning preserves the original timestamp.
          emailAuthFactorEnabledAt: eb.ref(
            'account_email_auth_factor.emailAuthFactorEnabledAt',
          ),
        })),
      )
      .returning('emailAuthFactorEnabledAt'),
  )

  return row?.emailAuthFactorEnabledAt ?? null
}

/**
 * Disables the email auth factor for `did`, provided `email` is still the
 * account's address. Disabling an already-disabled factor is a no-op.
 *
 * Unlike enabling there is no `emailConfirmedAt` guard — turning a factor off
 * never needs the address to be confirmed.
 *
 * @returns whether a row was removed.
 */
export const disable = async (
  db: AccountDb,
  did: string,
  email: string,
): Promise<boolean> => {
  const [res] = await db.executeWithRetry(
    db.db
      .deleteFrom('account_email_auth_factor')
      .where('did', '=', did)
      .where(({ exists, selectFrom }) =>
        exists(
          selectFrom('account')
            .selectAll()
            .where('account.did', '=', did)
            .where('account.email', '=', email.toLowerCase()),
        ),
      ),
  )

  return res.numDeletedRows > 0
}

/**
 * Drops the email auth factor for `did` unconditionally.
 *
 * For the paths where the account's own state makes the factor invalid rather
 * than the user asking to turn it off: an email change (2FA on an unconfirmed
 * address can lock the user out) and account deletion. Callers changing the
 * email must do so in the same transaction as the email write, since the two
 * are no longer one row.
 *
 * TODO: Store unconfirmed emails separately, see note in context.ts — at which
 * point changing an email no longer needs to disable 2FA at all.
 */
export const deleteForDid = async (
  db: AccountDb,
  did: string,
): Promise<void> => {
  await db.executeWithRetry(
    db.db.deleteFrom('account_email_auth_factor').where('did', '=', did),
  )
}
