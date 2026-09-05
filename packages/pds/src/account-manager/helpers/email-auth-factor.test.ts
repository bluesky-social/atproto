import {
  type DidString,
  type HandleString,
  currentDatetimeString,
} from '@atproto/lex'
import { type AccountDb, getDb, getMigrator } from '../db/index.js'
import * as account from './account.js'
import * as emailAuthFactor from './email-auth-factor.js'

/**
 * Exercises the store-level guards directly. The account manager checks the
 * same conditions before calling in, so these paths cannot be reached through
 * the API — but they are the reason the write is shaped as an `INSERT … SELECT`
 * with a conflict clause, and losing either would surface only as a race.
 *
 * The account store is sqlite, so this needs no dev-env network: an in-memory
 * database plus the migrations is the whole fixture.
 */
describe('email auth factor helpers', () => {
  let db: AccountDb

  const confirmed = {
    did: 'did:plc:confirmedaccount00000000' as DidString,
    handle: 'confirmed.test' as HandleString,
    email: 'confirmed@test.com',
  }
  const unconfirmed = {
    did: 'did:plc:unconfirmedaccount000000' as DidString,
    handle: 'unconfirmed.test' as HandleString,
    email: 'unconfirmed@test.com',
  }

  beforeAll(async () => {
    db = getDb(':memory:')
    await getMigrator(db).migrateToLatestOrThrow()

    for (const { did, handle, email } of [confirmed, unconfirmed]) {
      await account.registerActor(db, { did, handle })
      await account.registerAccount(db, {
        did,
        email,
        passwordScrypt: 'scrypt',
      })
    }

    await account.setEmailConfirmedAt(
      db,
      confirmed.did,
      currentDatetimeString(),
    )
  })

  afterAll(() => {
    db?.close()
  })

  describe('enable', () => {
    it("refuses an email that is not the account's", async () => {
      const res = await emailAuthFactor.enable(
        db,
        confirmed.did,
        'someone-else@test.com',
      )

      expect(res).toBeNull()
    })

    it('refuses an unconfirmed email', async () => {
      const res = await emailAuthFactor.enable(
        db,
        unconfirmed.did,
        unconfirmed.email,
      )

      expect(res).toBeNull()
    })

    it('enables, and reports the timestamp it stored', async () => {
      const res = await emailAuthFactor.enable(
        db,
        confirmed.did,
        confirmed.email,
      )

      expect(res).toEqual(expect.any(String))

      const found = await account.getAccount(db, confirmed.did)
      expect(found?.emailAuthFactorAt).toBe(res)
    })

    it('is idempotent, without moving the timestamp', async () => {
      const first = await emailAuthFactor.enable(
        db,
        confirmed.did,
        confirmed.email,
      )
      const second = await emailAuthFactor.enable(
        db,
        confirmed.did,
        confirmed.email,
      )

      // The conflict clause re-assigns the column to itself, so the row is
      // still returned but the original enablement time is not overwritten.
      expect(second).toBe(first)
    })
  })

  describe('disable', () => {
    it("refuses an email that is not the account's", async () => {
      const res = await emailAuthFactor.disable(
        db,
        confirmed.did,
        'someone-else@test.com',
      )

      expect(res).toBe(false)

      const found = await account.getAccount(db, confirmed.did)
      expect(found?.emailAuthFactorAt).toEqual(expect.any(String))
    })

    it('disables, then is a no-op once already disabled', async () => {
      expect(
        await emailAuthFactor.disable(db, confirmed.did, confirmed.email),
      ).toBe(true)

      const found = await account.getAccount(db, confirmed.did)
      expect(found?.emailAuthFactorAt).toBeNull()

      expect(
        await emailAuthFactor.disable(db, confirmed.did, confirmed.email),
      ).toBe(false)
    })
  })
})
