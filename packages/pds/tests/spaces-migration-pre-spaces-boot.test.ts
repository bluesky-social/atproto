import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import SqliteDB from 'better-sqlite3'
import getPort from 'get-port'
import * as ui8 from 'uint8arrays'
import { wait } from '@atproto/common'
import { Secp256k1Keypair } from '@atproto/crypto'
import { TestPds, TestPlc } from '@atproto/dev-env'
import type { DidString } from '@atproto/syntax'

// Tables added by the account DB's '009' and '010' migrations
const ACCOUNT_SPACES_TABLES = [
  'space_notification_retry',
  'space_notification_lease',
  'revoked_space_credential',
  'space_syncer_notification_retry',
  'spaces_migration',
  'spaces_migration_state',
]

// Tables added by the actor store's '002' migration
const STORE_SPACES_TABLES = [
  'space',
  'memberspace_member',
  'space_policy',
  'space_record',
  'space_record_blob',
  'space_repo',
  'space_record_oplog',
  'space_writer',
  'space_notify_registration',
]

const waitFor = async (check: () => Promise<boolean>, timeoutMs = 30_000) => {
  const deadline = Date.now() + timeoutMs
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error('timed out')
    await wait(50)
  }
}

const withFile = <T>(file: string, fn: (db: SqliteDB.Database) => T): T => {
  const db = new SqliteDB(file)
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

const migrations = (file: string) =>
  withFile(file, (db) =>
    db
      .prepare('select name from kysely_migration order by name')
      .all()
      .map((row) => (row as { name: string }).name),
  )

/**
 * Upgrading a host from the release before spaces: a stock PDS boots on that
 * release's data directory and, through its real wiring, migrates the
 * databases, sweeps every store, and publishes every account's KEM key.
 */
describe('booting on a pre-spaces data directory', () => {
  let plc: TestPlc
  let pds: TestPds | undefined
  let dirs: string[] = []

  beforeAll(async () => {
    plc = await TestPlc.create({})
  })

  afterAll(async () => {
    await pds?.close()
    await plc?.close()
    await Promise.all(
      dirs.map((dir) => rm(dir, { recursive: true, force: true })),
    )
  })

  it('migrates and publishes every existing account', async () => {
    dirs = await Promise.all(
      [0, 1].map(() => mkdtemp(path.join(tmpdir(), 'pds-pre-spaces-'))),
    )
    const [dataDirectory, blobstoreDiskLocation] = dirs
    const rotationKey = await Secp256k1Keypair.create({ exportable: true })
    const env = {
      // Kept across both boots: the DID docs name this host's URL
      port: await getPort(),
      didPlcUrl: plc.url,
      dataDirectory,
      blobstoreDiskLocation,
      plcRotationKeyK256PrivateKeyHex: ui8.toString(
        await rotationKey.export(),
        'hex',
      ),
    }

    // Build the fixture: accounts made by this release, then everything the
    // spaces release added is reverted, as the release before it left them
    const before = await TestPds.create({
      ...env,
      spacesMigrationDisabled: true,
    })
    const dids: DidString[] = []
    for (let n = 0; n < 2; n++) {
      const agent = before.getAgent()
      await agent.createAccount({
        handle: `prespaces${n}.test`,
        email: `prespaces${n}@test.com`,
        password: 'hunter2',
      })
      dids.push(agent.assertDid as DidString)
    }
    const accountDbLoc = before.ctx.cfg.db.accountDbLoc
    const stores = await Promise.all(
      dids.map((did) => before.ctx.actorStore.getLocation(did)),
    )
    // The release before spaces never published a KEM key
    for (const did of dids) {
      await before.ctx.plcClient.updateData(did, rotationKey, (op) => {
        const { atproto_kem: _, ...verificationMethods } =
          op.verificationMethods
        return { ...op, verificationMethods }
      })
    }
    await before.close()

    // Account DB: migrated through '008' only
    withFile(accountDbLoc, (db) => {
      for (const table of ACCOUNT_SPACES_TABLES) {
        db.exec(`drop table "${table}"`)
      }
      db.prepare(
        "delete from kysely_migration where name in ('009', '010')",
      ).run()
    })
    expect(migrations(accountDbLoc).at(-1)).toBe('008')
    // Actor stores: migrated through '001' only, and no KEM key
    for (const { dbLocation, kemKeyLocation } of stores) {
      withFile(dbLocation, (db) => {
        for (const table of STORE_SPACES_TABLES)
          db.exec(`drop table "${table}"`)
        db.prepare("delete from kysely_migration where name = '002'").run()
      })
      expect(migrations(dbLocation)).toEqual(['001'])
      await rm(kemKeyLocation)
    }

    // Boot a stock PDS on it. The jitter window is closed so the publisher
    // starts right away.
    pds = await TestPds.create({
      ...env,
      spacesMigrationSweepIntervalMs: 0,
      spacesMigrationJitterWindowMs: 0,
    })
    const { ctx } = pds
    expect(migrations(accountDbLoc)).toContain('010')

    for (const [i, did] of dids.entries()) {
      await waitFor(
        async () =>
          (await ctx.spacesMigration.progress.get(did))?.kemPublishedAt != null,
      )
      expect(migrations(stores[i].dbLocation)).toEqual(['001', '002'])
      const held = (await ctx.actorStore.kemKeypair(did))?.did()
      expect(held).toEqual(expect.stringMatching(/^did:key:/))
      const { verificationMethods } = await ctx.plcClient.getDocumentData(did)
      expect(verificationMethods.atproto_kem).toBe(held)
    }

    await ctx.spacesMigration.summaryCache.refresh()
    const res = await fetch(`${pds.url}/xrpc/_health`)
    expect(await res.json()).toMatchObject({
      spacesMigration: {
        total: 2,
        storesMigrated: 2,
        keysPublished: 2,
        unpublishable: 0,
        deactivated: 0,
        failing: 0,
        sweepFailing: 0,
      },
    })
  })
})
