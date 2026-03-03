import { TestNetworkNoAppView } from '@atproto/dev-env'
import { Database } from '../src/account-manager/db'

describe('Schema Migration 015', () => {
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
        .values({
          did,
          email,
          passwordScrypt: 'fake-hash',
        })
        .execute()
    }
  }

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'schema_migration',
    })
    db = network.pds.ctx.accountManager.db
  })

  afterAll(async () => {
    await network.close()
  })

  it('stores real users in userJid', async () => {
    const did = `did:plc:real${Date.now()}`
    const userJid = `real${Date.now()}@legal.lab.tagroot.io`
    await createFixture(
      did,
      `real${Date.now()}.test`,
      `real${Date.now()}@test.com`,
    )

    await db.db
      .insertInto('neuro_identity_link')
      .values({
        did,
        userJid,
        testUserJid: null,
        isTestUser: 0,
        linkedAt: new Date().toISOString(),
        lastLoginAt: null,
      })
      .execute()

    const row = await db.db
      .selectFrom('neuro_identity_link')
      .selectAll()
      .where('did', '=', did)
      .executeTakeFirst()

    expect(row?.userJid).toBe(userJid)
    expect(row?.testUserJid).toBeNull()
    expect(row?.isTestUser).toBe(0)
  })

  it('stores test users in testUserJid', async () => {
    const did = `did:plc:test${Date.now()}`
    const testUserJid = `Test${Date.now()}@lab.tagroot.io`
    await createFixture(did, `test${Date.now()}.test`)

    await db.db
      .insertInto('neuro_identity_link')
      .values({
        did,
        userJid: null,
        testUserJid,
        isTestUser: 1,
        linkedAt: new Date().toISOString(),
        lastLoginAt: null,
      })
      .execute()

    const row = await db.db
      .selectFrom('neuro_identity_link')
      .selectAll()
      .where('did', '=', did)
      .executeTakeFirst()

    expect(row?.userJid).toBeNull()
    expect(row?.testUserJid).toBe(testUserJid)
    expect(row?.isTestUser).toBe(1)
  })

  it('enforces uniqueness for userJid among real users', async () => {
    const userJid = `unique${Date.now()}@legal.io`
    const did1 = `did:plc:u1${Date.now()}`
    const did2 = `did:plc:u2${Date.now()}`

    await createFixture(did1, `u1${Date.now()}.test`, `u1@test.com`)
    await createFixture(did2, `u2${Date.now()}.test`, `u2@test.com`)

    await db.db
      .insertInto('neuro_identity_link')
      .values({
        did: did1,
        userJid,
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
          userJid,
          testUserJid: null,
          isTestUser: 0,
          linkedAt: new Date().toISOString(),
          lastLoginAt: null,
        })
        .execute(),
    ).rejects.toThrow()
  })

  it('enforces uniqueness for testUserJid among test users', async () => {
    const testUserJid = `Unique${Date.now()}@lab.io`
    const did1 = `did:plc:t1${Date.now()}`
    const did2 = `did:plc:t2${Date.now()}`

    await createFixture(did1, `t1${Date.now()}.test`)
    await createFixture(did2, `t2${Date.now()}.test`)

    await db.db
      .insertInto('neuro_identity_link')
      .values({
        did: did1,
        userJid: null,
        testUserJid,
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
          testUserJid,
          isTestUser: 1,
          linkedAt: new Date().toISOString(),
          lastLoginAt: null,
        })
        .execute(),
    ).rejects.toThrow()
  })

  it('allows same value across userJid and testUserJid', async () => {
    const value = `same${Date.now()}@lab.io`
    const realDid = `did:plc:realv${Date.now()}`
    const testDid = `did:plc:testv${Date.now()}`

    await createFixture(realDid, `realv${Date.now()}.test`, `realv@test.com`)
    await createFixture(testDid, `testv${Date.now()}.test`)

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

    await db.db
      .insertInto('neuro_identity_link')
      .values({
        did: testDid,
        userJid: null,
        testUserJid: value,
        isTestUser: 1,
        linkedAt: new Date().toISOString(),
        lastLoginAt: null,
      })
      .execute()

    const real = await db.db
      .selectFrom('neuro_identity_link')
      .selectAll()
      .where('did', '=', realDid)
      .executeTakeFirst()
    const test = await db.db
      .selectFrom('neuro_identity_link')
      .selectAll()
      .where('did', '=', testDid)
      .executeTakeFirst()

    expect(real?.userJid).toBe(value)
    expect(test?.testUserJid).toBe(value)
  })
})
