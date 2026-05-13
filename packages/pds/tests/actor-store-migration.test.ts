import { sql } from 'kysely'
import { TestNetworkNoAppView } from '@atproto/dev-env'
import { Client } from '@atproto/lex'
import {
  ActorStoreMigrator,
  allActorStoresMigrated,
} from '../dist/account-manager/helpers/actor-store-migration'
import {
  clearExtraMigration,
  getLatestStoreSchemaVersion,
  setExtraMigration,
} from '../dist/actor-store/db/migrations/index'
import { com } from '../src/lexicons.js'
// import through the dist entry point so we share the same module instance
// as the runtime PDS code loaded by TestNetworkNoAppView

describe('actor store migration', () => {
  let network: TestNetworkNoAppView
  let ctx: any
  let client: Client
  let aliceDid: string
  let bobDid: string

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'actor_store_migration',
    })
    ctx = network.pds.ctx
    client = network.pds.getClient()

    // create accounts while latest is still '001'
    const alice = await client.call(com.atproto.server.createAccount, {
      handle: 'alice.test',
      email: 'alice@test.com',
      password: 'password',
    })
    aliceDid = alice.did

    const bob = await client.call(com.atproto.server.createAccount, {
      handle: 'bob.test',
      email: 'bob@test.com',
      password: 'password',
    })
    bobDid = bob.did
  })

  afterAll(async () => {
    clearExtraMigration('999')
    await network.close()
  })

  it('reports all migrated when no stores are behind', async () => {
    expect(await allActorStoresMigrated(ctx.accountManager.db)).toBe(true)
  })

  describe('with dummy migration 999', () => {
    beforeAll(() => {
      setExtraMigration(
        '999',
        'CREATE TABLE IF NOT EXISTS dummy_migration_999 (id INTEGER PRIMARY KEY)',
        'DROP TABLE IF EXISTS dummy_migration_999',
      )
    })

    afterAll(() => {
      clearExtraMigration('999')
    })

    it('getLatestStoreSchemaVersion reflects injected migration', () => {
      expect(getLatestStoreSchemaVersion()).toBe('999')
    })

    it('detects unmigrated stores', async () => {
      expect(await allActorStoresMigrated(ctx.accountManager.db)).toBe(false)
    })

    describe('concurrency limit', () => {
      let originalLimit: number

      beforeAll(async () => {
        originalLimit = ctx.actorStore.cfg.maxConcurrentMigrations
        ctx.actorStore.cfg.maxConcurrentMigrations = 1
      })

      afterAll(async () => {
        ctx.actorStore.cfg.maxConcurrentMigrations = originalLimit
        ctx.actorStore.migrationsInProgress = 0
      })

      it('rejects store open when in-process concurrency limit is reached', async () => {
        // simulate one migration in-flight in this process
        ctx.actorStore.migrationsInProgress = 1

        // bob's open should fail because the in-process counter is at the
        // limit and bob's SQLite store genuinely needs migration '999'
        await expect(ctx.actorStore.openDb(bobDid)).rejects.toThrow(
          'too many concurrent actor store migrations',
        )
      })
    })

    it('ensureMigrated applies migration on store open without touching account db', async () => {
      const actorDb = await ctx.actorStore.openDb(aliceDid)
      try {
        // verify the dummy table was created in the actor store sqlite
        const result = await sql`
          SELECT name FROM sqlite_master
          WHERE type='table' AND name='dummy_migration_999'
        `.execute(actorDb.db)
        expect(result.rows).toHaveLength(1)

        // on-demand migrations do not update the account db. The
        // background migrator is the sole writer of storeSchemaVersion.
        const actor = await ctx.accountManager.db.db
          .selectFrom('actor')
          .select(['storeSchemaVersion', 'storeIsMigrating'])
          .where('did', '=', aliceDid)
          .executeTakeFirstOrThrow()
        expect(actor.storeSchemaVersion).toBe('001')
        expect(actor.storeIsMigrating).toBe(0)
      } finally {
        actorDb.close()
      }
    })

    it('opening an already-migrated store is a no-op', async () => {
      const actorDb = await ctx.actorStore.openDb(aliceDid)
      actorDb.close()
    })

    it('ActorStoreMigrator migrates all stores', async () => {
      // downgrade both actors so they need migration
      await ctx.accountManager.db.db
        .updateTable('actor')
        .set({ storeSchemaVersion: '001' })
        .execute()

      expect(await allActorStoresMigrated(ctx.accountManager.db)).toBe(false)

      const migrator = new ActorStoreMigrator(
        ctx.accountManager.db,
        ctx.actorStore,
        true,
      )
      migrator.start()
      await migrator.running

      expect(await allActorStoresMigrated(ctx.accountManager.db)).toBe(true)

      const actors = await ctx.accountManager.db.db
        .selectFrom('actor')
        .select(['did', 'storeSchemaVersion', 'storeIsMigrating'])
        .execute()
      for (const actor of actors) {
        expect(actor.storeSchemaVersion).toBe('999')
        expect(actor.storeIsMigrating).toBe(0)
      }
    })

    it('ActorStoreMigrator.destroy() stops cleanly', async () => {
      const migrator = new ActorStoreMigrator(
        ctx.accountManager.db,
        ctx.actorStore,
        true,
      )
      migrator.start()
      await migrator.destroy()
    })
  })

  describe('event loop blocking', () => {
    let charlieDid: string

    beforeAll(async () => {
      // create a fresh account at the current schema baseline (no extra
      // migrations registered yet)
      const charlie = await client.call(com.atproto.server.createAccount, {
        handle: 'charlie.test',
        email: 'charlie@test.com',
        password: 'password',
      })
      charlieDid = charlie.did

      // register a slow migration. setExtraMigration forwards this SQL to
      // the worker via workerData, so the recursive CTE runs in the worker
      // and only blocks the worker thread.
      setExtraMigration(
        '998-slow',
        `WITH RECURSIVE c(x) AS (
          SELECT 1 UNION ALL SELECT x + 1 FROM c WHERE x < 10000000
        )
        SELECT max(x) FROM c`,
      )
    })

    afterAll(() => {
      clearExtraMigration('998-slow')
    })

    it('does not block the event loop for more than 100ms during a migration', async () => {
      let maxLagMs = 0
      const tickMs = 10
      let lastTick = performance.now()
      const interval = setInterval(() => {
        const now = performance.now()
        const lag = now - lastTick - tickMs
        if (lag > maxLagMs) maxLagMs = lag
        lastTick = now
      }, tickMs)
      interval.unref?.()

      let actorDb: any
      try {
        actorDb = await ctx.actorStore.openDb(charlieDid)
        // wait for the lag-detector loop to tick at least once more
        await new Promise((resolve) => setTimeout(resolve, 20))
      } finally {
        clearInterval(interval)
        actorDb?.close()
      }

      expect(maxLagMs).toBeLessThan(100)
    })
  })
})
