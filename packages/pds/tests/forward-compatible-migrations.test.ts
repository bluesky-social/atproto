import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import SqliteDB from 'better-sqlite3'
import * as ui8 from 'uint8arrays'
import { Secp256k1Keypair } from '@atproto/crypto'
import { TestPds, TestPlc } from '@atproto/dev-env'

/**
 * A release is rolled back by re-tagging an older image, which then boots on
 * a data directory that a newer release already migrated.
 */
describe('forward-compatible migrations', () => {
  let plc: TestPlc
  let dirs: string[]

  beforeAll(async () => {
    plc = await TestPlc.create({})
  })

  afterAll(async () => {
    await plc?.close()
    await Promise.all(
      (dirs ?? []).map((dir) => rm(dir, { recursive: true, force: true })),
    )
  })

  it('boots and serves an existing account after a newer version migrated its databases', async () => {
    dirs = await Promise.all(
      [0, 1].map(() => mkdtemp(path.join(tmpdir(), 'pds-fwd-compat-'))),
    )
    const [dataDirectory, blobstoreDiskLocation] = dirs
    const rotationKey = await Secp256k1Keypair.create({ exportable: true })
    const env = {
      didPlcUrl: plc.url,
      dataDirectory,
      blobstoreDiskLocation,
      plcRotationKeyK256PrivateKeyHex: ui8.toString(
        await rotationKey.export(),
        'hex',
      ),
    }

    const pds1 = await TestPds.create(env)
    const alice = pds1.getAgent()
    await alice.createAccount({
      handle: 'alice.test',
      email: 'alice@test.com',
      password: 'alice-pass',
    })
    const post = await alice.post({ text: 'before the rollback' })
    const aliceDid = alice.assertDid
    const dbFiles = [
      pds1.ctx.cfg.db.accountDbLoc,
      pds1.ctx.cfg.db.sequencerDbLoc,
      pds1.ctx.cfg.db.didCacheDbLoc,
      (await pds1.ctx.actorStore.getLocation(aliceDid)).dbLocation,
    ]
    await pds1.close()

    // A newer version adds a table and records its migration in every database
    for (const file of dbFiles) {
      const db = new SqliteDB(file)
      try {
        db.exec('create table future_table (x integer)')
        db.prepare(
          'insert into kysely_migration (name, timestamp) values (?, ?)',
        ).run('999-future', new Date().toISOString())
      } finally {
        db.close()
      }
    }

    const pds2 = await TestPds.create(env)
    try {
      const alice2 = pds2.getAgent()
      await alice2.login({ identifier: 'alice.test', password: 'alice-pass' })
      const { data: record } = await alice2.com.atproto.repo.getRecord({
        repo: aliceDid,
        collection: 'app.bsky.feed.post',
        rkey: post.uri.split('/').at(-1)!,
      })
      expect(record.value).toMatchObject({ text: 'before the rollback' })
      await alice2.post({ text: 'after the rollback' })

      const bob = pds2.getAgent()
      await bob.createAccount({
        handle: 'bob.test',
        email: 'bob@test.com',
        password: 'bob-pass',
      })
      expect(bob.did).toBeDefined()
    } finally {
      await pds2.close()
    }
  })
})
