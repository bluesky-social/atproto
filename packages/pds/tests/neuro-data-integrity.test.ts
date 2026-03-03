import { TestNetworkNoAppView } from '@atproto/dev-env'
import { Database } from '../src/account-manager/db'

describe('Neuro Data Integrity', () => {
  let network: TestNetworkNoAppView
  let db: Database

  const createFixture = async (did: string, handle: string, email?: string) => {
    const now = new Date().toISOString()
    await db.db
      .insertInto('actor')
      .values({
        did,
        handle,
        createdAt: now,
        takedownRef: null,
        deactivatedAt: null,
        deleteAfter: null,
      })
      .execute()

    if (email !== undefined) {
      await db.db
        .insertInto('account')
        .values({ did, email, passwordScrypt: 'fake-hash' })
        .execute()
    }
  }

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'neuro_data_integrity',
    })
    db = network.pds.ctx.accountManager.db
  })

  afterAll(async () => {
    await network.close()
  })

  it('stores exactly one JID column per inserted row', async () => {
    const realDid = `did:plc:integrity-real${Date.now()}`
    const testDid = `did:plc:integrity-test${Date.now()}`

    await createFixture(
      realDid,
      `integ-real${Date.now()}.test`,
      'integ-real@test.com',
    )
    await createFixture(testDid, `integ-test${Date.now()}.test`)

    await db.db
      .insertInto('neuro_identity_link')
      .values([
        {
          did: realDid,
          userJid: `real${Date.now()}@legal.io`,
          testUserJid: null,
          isTestUser: 0,
          linkedAt: new Date().toISOString(),
          lastLoginAt: null,
        },
        {
          did: testDid,
          userJid: null,
          testUserJid: `Test${Date.now()}@lab.io`,
          isTestUser: 1,
          linkedAt: new Date().toISOString(),
          lastLoginAt: null,
        },
      ])
      .execute()

    const rows = await db.db
      .selectFrom('neuro_identity_link')
      .selectAll()
      .where('did', 'in', [realDid, testDid])
      .execute()

    for (const row of rows) {
      const populated = [row.userJid, row.testUserJid].filter(
        (col) => col !== null,
      )
      expect(populated).toHaveLength(1)
    }
  })

  it('enforces unique did (one neuro link per account)', async () => {
    const did = `did:plc:unique-did${Date.now()}`
    await createFixture(
      did,
      `unique-did${Date.now()}.test`,
      'unique-did@test.com',
    )

    await db.db
      .insertInto('neuro_identity_link')
      .values({
        did,
        userJid: `first${Date.now()}@legal.io`,
        testUserJid: null,
        isTestUser: 0,
        linkedAt: new Date().toISOString(),
        lastLoginAt: null,
      })
      .execute()

    await expect(
      db.db
        .insertInto('neuro_identity_link')
        .values({
          did,
          userJid: `second${Date.now()}@legal.io`,
          testUserJid: null,
          isTestUser: 0,
          linkedAt: new Date().toISOString(),
          lastLoginAt: null,
        })
        .execute(),
    ).rejects.toThrow()
  })

  it('enforces userJid uniqueness for real users', async () => {
    const value = `dupe-real${Date.now()}@legal.io`
    const did1 = `did:plc:dupe-r1${Date.now()}`
    const did2 = `did:plc:dupe-r2${Date.now()}`

    await createFixture(did1, `dupe-r1${Date.now()}.test`, 'dupe-r1@test.com')
    await createFixture(did2, `dupe-r2${Date.now()}.test`, 'dupe-r2@test.com')

    await db.db
      .insertInto('neuro_identity_link')
      .values({
        did: did1,
        userJid: value,
        testUserJid: null,
        isTestUser: 0,
        linkedAt: new Date().toISOString(),
        lastLoginAt: null,
      })
      .execute()

    await expect(
      db.db
        .insertInto('neuro_identity_link')
        .values({
          did: did2,
          userJid: value,
          testUserJid: null,
          isTestUser: 0,
          linkedAt: new Date().toISOString(),
          lastLoginAt: null,
        })
        .execute(),
    ).rejects.toThrow()
  })

  it('enforces testUserJid uniqueness for test users', async () => {
    const value = `dupe-test${Date.now()}@lab.io`
    const did1 = `did:plc:dupe-t1${Date.now()}`
    const did2 = `did:plc:dupe-t2${Date.now()}`

    await createFixture(did1, `dupe-t1${Date.now()}.test`)
    await createFixture(did2, `dupe-t2${Date.now()}.test`)

    await db.db
      .insertInto('neuro_identity_link')
      .values({
        did: did1,
        userJid: null,
        testUserJid: value,
        isTestUser: 1,
        linkedAt: new Date().toISOString(),
        lastLoginAt: null,
      })
      .execute()

    await expect(
      db.db
        .insertInto('neuro_identity_link')
        .values({
          did: did2,
          userJid: null,
          testUserJid: value,
          isTestUser: 1,
          linkedAt: new Date().toISOString(),
          lastLoginAt: null,
        })
        .execute(),
    ).rejects.toThrow()
  })

  it('allows same value across real/test columns', async () => {
    const value = `same${Date.now()}@lab.io`
    const realDid = `did:plc:same-real${Date.now()}`
    const testDid = `did:plc:same-test${Date.now()}`

    await createFixture(
      realDid,
      `same-real${Date.now()}.test`,
      'same-real@test.com',
    )
    await createFixture(testDid, `same-test${Date.now()}.test`)

    await db.db
      .insertInto('neuro_identity_link')
      .values({
        did: realDid,
        userJid: value,
        testUserJid: null,
        isTestUser: 0,
        linkedAt: new Date().toISOString(),
        lastLoginAt: null,
      })
      .execute()

    await expect(
      db.db
        .insertInto('neuro_identity_link')
        .values({
          did: testDid,
          userJid: null,
          testUserJid: value,
          isTestUser: 1,
          linkedAt: new Date().toISOString(),
          lastLoginAt: null,
        })
        .execute(),
    ).resolves.toBeDefined()
  })

  it('supports fast indexed lookup by userJid/testUserJid', async () => {
    const realDid = `did:plc:index-real${Date.now()}`
    const testDid = `did:plc:index-test${Date.now()}`
    const userJid = `index-real${Date.now()}@legal.io`
    const testUserJid = `IndexTest${Date.now()}@lab.io`

    await createFixture(
      realDid,
      `index-real${Date.now()}.test`,
      'index-real@test.com',
    )
    await createFixture(testDid, `index-test${Date.now()}.test`)

    await db.db
      .insertInto('neuro_identity_link')
      .values([
        {
          did: realDid,
          userJid,
          testUserJid: null,
          isTestUser: 0,
          linkedAt: new Date().toISOString(),
          lastLoginAt: null,
        },
        {
          did: testDid,
          userJid: null,
          testUserJid,
          isTestUser: 1,
          linkedAt: new Date().toISOString(),
          lastLoginAt: null,
        },
      ])
      .execute()

    const byReal = await db.db
      .selectFrom('neuro_identity_link')
      .select('did')
      .where('userJid', '=', userJid)
      .executeTakeFirst()
    const byTest = await db.db
      .selectFrom('neuro_identity_link')
      .select('did')
      .where('testUserJid', '=', testUserJid)
      .executeTakeFirst()

    expect(byReal?.did).toBe(realDid)
    expect(byTest?.did).toBe(testDid)
  })
})
