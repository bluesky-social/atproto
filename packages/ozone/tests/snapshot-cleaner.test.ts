import {
  TestNetwork,
  TestOzone,
  SeedClient,
  basicSeed,
  ModeratorClient,
} from '@atproto/dev-env'
import AtpAgent from '@atproto/api'
import { Snapshot } from '../src/mod-service/snapshot'
import { SnapshotCleaner } from '../src/daemon/snapshot-cleaner'
import { DAY } from '@atproto/common'
import { RepoSubject } from '../dist/mod-service/subject'

describe('record snapshot cleaner', () => {
  let network: TestNetwork
  let ozone: TestOzone
  let agent: AtpAgent
  let sc: SeedClient
  let modClient: ModeratorClient
  const snapshotExpiration = DAY * 90

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_snapshot_cleaner',
      ozone: {
        snapshotExpiration,
        snapshotEnabled: true,
      },
    })
    ozone = network.ozone
    agent = network.ozone.getClient()
    sc = network.getSeedClient()
    modClient = network.ozone.getModClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  const insertSnapshot = async (
    did: string,
    createdAt?: string,
    uri?: string,
    cid?: string,
  ) => {
    const snapshotService = new Snapshot(ozone.ctx.db)
    await snapshotService.save(
      did,
      JSON.stringify({ did, data: { any: true } }),
      uri || null,
      cid || null,
      createdAt,
    )
  }

  it('snapshots a repo when first reported.', async () => {
    const bob = new RepoSubject(sc.dids.bob)
    const alice = new RepoSubject(sc.dids.alice)
    const expiredTimestamp =
      Date.now() - (ozone.ctx.cfg.snapshot?.expiration || DAY * 90)

    // Insert expired snapshot for bob and valid snapshot for alice
    await insertSnapshot(bob.did, new Date(expiredTimestamp).toISOString())
    await insertSnapshot(
      alice.did,
      new Date(expiredTimestamp + 5 * DAY).toISOString(),
    )

    const getSnapshots = async () => {
      const [bobSnapshot, aliceSnapshot] = await Promise.all([
        network.ozone.ctx
          .modService(network.ozone.ctx.db)
          .getSnapshot(bob.info()),
        network.ozone.ctx
          .modService(network.ozone.ctx.db)
          .getSnapshot(alice.info()),
      ])

      return { bobSnapshot, aliceSnapshot }
    }

    const before = await getSnapshots()

    const snapshotCleaner = new SnapshotCleaner(
      ozone.ctx.db,
      snapshotExpiration,
    )
    await snapshotCleaner.removeExpiredSnapshots()

    const after = await getSnapshots()

    expect(before.bobSnapshot).toBeDefined()
    expect(after.bobSnapshot).not.toBeDefined()
  })
})
