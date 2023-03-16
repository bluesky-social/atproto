import { Database } from '../../src'
import { randomStr } from '@atproto/crypto'
import { Kysely } from 'kysely'

describe('user table did pkey migration', () => {
  let db: Database
  let rawDb: Kysely<any>

  beforeAll(async () => {
    if (process.env.DB_POSTGRES_URL) {
      db = Database.postgres({
        url: process.env.DB_POSTGRES_URL,
        schema: 'migration_user_table_did_pkey',
      })
    } else {
      db = Database.memory()
    }
    await db.migrateToOrThrow('_20230202T172831900Z')

    rawDb = db.db
  })

  afterAll(async () => {
    await db.close()
  })

  const randDateBefore = (beforeUnix: number): Date => {
    return new Date(beforeUnix - Math.floor(1000000 * Math.random()))
  }

  let userSnap
  let didHandleSnap

  it('creates a bunch of users', async () => {
    const didHandles: any[] = []
    const users: any[] = []
    for (let i = 0; i < 1000; i++) {
      const did = `did:plc:${randomStr(24, 'base32')}`
      const handle = `${randomStr(8, 'base32')}.bsky.social`
      const email = `${randomStr(8, 'base32')}@test.com`
      const password = randomStr(32, 'base32')
      const lastSeenNotifs = randDateBefore(Date.now())
      const createdAt = randDateBefore(lastSeenNotifs.getTime())
      const passwordResetToken =
        Math.random() > 0.9 ? randomStr(4, 'base32') : null
      const passwordResetGrantedAt =
        Math.random() > 0.5 ? randDateBefore(lastSeenNotifs.getTime()) : null
      didHandles.push({ did, handle })
      users.push({
        handle,
        email,
        password,
        lastSeenNotifs: lastSeenNotifs.toISOString(),
        createdAt: createdAt.toISOString(),
        passwordResetToken,
        passwordResetGrantedAt: passwordResetGrantedAt?.toISOString() || null,
      })
    }
    await rawDb.insertInto('did_handle').values(didHandles).execute()
    await rawDb.insertInto('user').values(users).execute()

    didHandleSnap = await rawDb
      .selectFrom('did_handle')
      .selectAll()
      .orderBy('did')
      .execute()
    userSnap = await rawDb
      .selectFrom('user')
      .selectAll()
      .orderBy('email')
      .execute()

    // console.log(
    //   await rawDb.selectFrom('user').select('lastSeenNotifs').execute(),
    // )
  })

  it('migrates up', async () => {
    const migration = await db.migrator.migrateTo('_20230208T222001557Z')
    expect(migration.error).toBeUndefined()
  })

  it('correctly migrated data', async () => {
    const updatedDidHandle = await rawDb
      .selectFrom('did_handle')
      .selectAll()
      .orderBy('did')
      .execute()
    const updatedUser = await rawDb
      .selectFrom('user_account')
      .selectAll()
      .orderBy('email')
      .execute()
    const updatedUserState = await rawDb
      .selectFrom('user_state')
      .selectAll()
      .orderBy('did')
      .execute()

    expect(updatedDidHandle).toEqual(didHandleSnap)

    expect(updatedUser.length).toBe(userSnap.length)
    for (let i = 0; i < updatedUser.length; i++) {
      const { handle, password, lastSeenNotifs, ...rest } = userSnap[i]
      const expectedDid = didHandleSnap.find((row) => row.handle === handle).did
      const expected = { did: expectedDid, passwordScrypt: password, ...rest }
      expect(updatedUser[i]).toEqual(expected)
      const lastSeen = updatedUserState.find(
        (row) => row.did === expectedDid,
      )?.lastSeenNotifs
      expect(lastSeen).toEqual(lastSeenNotifs)
    }
  })

  it('migrates down', async () => {
    const migration = await db.migrator.migrateTo('_20230202T172831900Z')
    expect(migration.error).toBeUndefined()

    const updatedDidHandle = await rawDb
      .selectFrom('did_handle')
      .selectAll()
      .orderBy('did')
      .execute()
    const updatedUser = await rawDb
      .selectFrom('user')
      .selectAll()
      .orderBy('email')
      .execute()

    expect(updatedDidHandle).toEqual(didHandleSnap)
    expect(updatedUser).toEqual(userSnap)
  })
})
