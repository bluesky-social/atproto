import { sql } from 'kysely'
import { AtpAgent } from '@atproto/api'
import { TestNetworkNoAppView } from '@atproto/dev-env'
import {
  ActorStoreMigrator,
  allActorStoresMigrated,
  countInProgressMigrations,
} from '../dist/account-manager/helpers/actor-store-migration'
import migrations, {
  getLatestStoreSchemaVersion,
} from '../dist/actor-store/db/migrations/index'
// import through the dist entry point so we share the same module instance
// as the runtime PDS code loaded by TestNetworkNoAppView

describe('actor store migration', () => {
  let network: TestNetworkNoAppView
  let ctx: any
  let agent: AtpAgent
  let aliceDid: string
  let bobDid: string

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'actor_store_migration',
    })
    ctx = network.pds.ctx
    agent = network.pds.getClient()

    // create accounts while latest is still '001'
    const alice = await agent.api.com.atproto.server.createAccount({
      handle: 'alice.test',
      email: 'alice@test.com',
      password: 'password',
    })
    aliceDid = alice.data.did

    const bob = await agent.api.com.atproto.server.createAccount({
      handle: 'bob.test',
      email: 'bob@test.com',
      password: 'password',
    })
    bobDid = bob.data.did
  })

  afterAll(async () => {
    delete migrations['999']
    await network.close()
  })

  it('reports all migrated when no stores are behind', async () => {
    expect(await allActorStoresMigrated(ctx.accountManager.db)).toBe(true)
    expect(await countInProgressMigrations(ctx.accountManager.db)).toBe(0)
  })

  describe('with dummy migration 999', () => {
    beforeAll(() => {
      migrations['999'] = {
        async up(db) {
          await db.schema
            .createTable('dummy_migration_999')
            .ifNotExists()
            .addColumn('id', 'integer', (col) => col.primaryKey())
            .execute()
        },
        async down(db) {
          await db.schema.dropTable('dummy_migration_999').ifExists().execute()
        },
      }
    })

    afterAll(() => {
      delete migrations['999']
    })

    it('getLatestStoreSchemaVersion reflects injected migration', () => {
      expect(getLatestStoreSchemaVersion()).toBe('999')
    })

    it('detects unmigrated stores', async () => {
      expect(await allActorStoresMigrated(ctx.accountManager.db)).toBe(false)
    })

    it('ensureMigrated applies migration on store open', async () => {
      const actorDb = await ctx.actorStore.openDb(aliceDid)
      try {
        // verify the dummy table was created in the actor store sqlite
        const result = await sql`
          SELECT name FROM sqlite_master
          WHERE type='table' AND name='dummy_migration_999'
        `.execute(actorDb.db)
        expect(result.rows).toHaveLength(1)

        // verify account db was updated
        const actor = await ctx.accountManager.db.db
          .selectFrom('actor')
          .select(['storeSchemaVersion', 'storeIsMigrating'])
          .where('did', '=', aliceDid)
          .executeTakeFirstOrThrow()
        expect(actor.storeSchemaVersion).toBe('999')
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

  describe('concurrency limit', () => {
    let originalLimit: number

    beforeAll(async () => {
      // inject a no-op migration so getLatestStoreSchemaVersion() returns '999'
      migrations['999'] = {
        async up() {},
        async down() {},
      }

      // set a low concurrency limit
      originalLimit = ctx.actorStore.cfg.maxConcurrentMigrations
      ctx.actorStore.cfg.maxConcurrentMigrations = 1
    })

    afterAll(async () => {
      delete migrations['999']
      ctx.actorStore.cfg.maxConcurrentMigrations = originalLimit
      // clear any leftover storeIsMigrating flags
      await ctx.accountManager.db.db
        .updateTable('actor')
        .set({ storeIsMigrating: 0 })
        .execute()
    })

    it('rejects store open when concurrency limit is reached', async () => {
      // simulate alice having an in-progress migration
      await ctx.accountManager.db.db
        .updateTable('actor')
        .set({ storeIsMigrating: 1 })
        .where('did', '=', aliceDid)
        .execute()

      // downgrade bob so he needs a migration
      await ctx.accountManager.db.db
        .updateTable('actor')
        .set({ storeSchemaVersion: '001' })
        .where('did', '=', bobDid)
        .execute()

      // bob's open should fail because alice's migration is "in progress"
      await expect(ctx.actorStore.openDb(bobDid)).rejects.toThrow(
        'too many concurrent actor store migrations',
      )
    })
  })
})
