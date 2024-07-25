import {
  TestNetwork,
  TestOzone,
  RecordRef,
  SeedClient,
  basicSeed,
  ModeratorClient,
} from '@atproto/dev-env'
import AtpAgent from '@atproto/api'
import { forSnapshot } from './_util'
import { REASONSPAM } from '../src/lexicon/types/com/atproto/moderation/defs'
import { RecordSubject, RepoSubject } from '../src/mod-service/subject'

describe('record snapshot', () => {
  let network: TestNetwork
  let ozone: TestOzone
  let agent: AtpAgent
  let sc: SeedClient
  let modClient: ModeratorClient

  const repoSubject = (did: string) => ({
    $type: 'com.atproto.admin.defs#repoRef',
    did,
  })

  const recordSubject = (ref: RecordRef) => ({
    $type: 'com.atproto.repo.strongRef',
    uri: ref.uriStr,
    cid: ref.cidStr,
  })

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_moderation',
      ozone: {
        snapshotExpiration: 1000,
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

  it('snapshots a repo when first reported.', async () => {
    await sc.createReport({
      reasonType: REASONSPAM,
      subject: repoSubject(sc.dids.bob),
      reportedBy: sc.dids.alice,
    })
    const bob = new RepoSubject(sc.dids.bob)
    const snapshot = await network.ozone.ctx
      .modService(network.ozone.ctx.db)
      .getSnapshot(bob.info())

    expect(forSnapshot(snapshot)).toMatchSnapshot()
  })

  it('snapshots a record when first reported.', async () => {
    const subject = recordSubject(sc.posts[sc.dids.bob][0].ref)
    await sc.createReport({
      reasonType: REASONSPAM,
      reportedBy: sc.dids.alice,
      subject,
    })
    const post = new RecordSubject(subject.uri, subject.cid)
    const snapshot = await network.ozone.ctx
      .modService(network.ozone.ctx.db)
      .getSnapshot(post.info())

    expect(forSnapshot(snapshot)).toMatchSnapshot()
  })
})
