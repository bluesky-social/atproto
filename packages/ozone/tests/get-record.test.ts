import { AtpAgent } from '@atproto/api'
import {
  ModeratorClient,
  SeedClient,
  TestNetwork,
  TestOzone,
  basicSeed,
} from '@atproto/dev-env'
import { AtUri } from '@atproto/syntax'
import { ids } from '../src/lexicon/lexicons'
import {
  REASONOTHER,
  REASONSPAM,
} from '../src/lexicon/types/com/atproto/moderation/defs'
import { forSnapshot } from './_util'

describe('admin get record view', () => {
  let network: TestNetwork
  let ozone: TestOzone
  let agent: AtpAgent
  let sc: SeedClient
  let modClient: ModeratorClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_admin_get_record',
    })
    ozone = network.ozone
    agent = ozone.getClient()
    sc = network.getSeedClient()
    modClient = ozone.getModClient()
    await basicSeed(sc)
    await network.processAll()
  })

  beforeEach(async () => {
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  beforeAll(async () => {
    await sc.createReport({
      reportedBy: sc.dids.bob,
      reasonType: REASONSPAM,
      subject: {
        $type: 'com.atproto.repo.strongRef',
        uri: sc.posts[sc.dids.alice][0].ref.uriStr,
        cid: sc.posts[sc.dids.alice][0].ref.cidStr,
      },
    })
    await sc.createReport({
      reportedBy: sc.dids.carol,
      reasonType: REASONOTHER,
      reason: 'defamation',
      subject: {
        $type: 'com.atproto.repo.strongRef',
        uri: sc.posts[sc.dids.alice][0].ref.uriStr,
        cid: sc.posts[sc.dids.alice][0].ref.cidStr,
      },
    })
    await modClient.emitEvent({
      event: { $type: 'tools.ozone.moderation.defs#modEventTakedown' },
      subject: {
        $type: 'com.atproto.repo.strongRef',
        uri: sc.posts[sc.dids.alice][0].ref.uriStr,
        cid: sc.posts[sc.dids.alice][0].ref.cidStr,
      },
    })
    await network.bsky.ctx.dataplane.takedownRecord({
      recordUri: sc.posts[sc.dids.alice][0].ref.uriStr,
    })
  })

  it('gets a record by uri, even when taken down.', async () => {
    const result = await agent.tools.ozone.moderation.getRecord(
      { uri: sc.posts[sc.dids.alice][0].ref.uriStr },
      { headers: await ozone.modHeaders(ids.ToolsOzoneModerationGetRecord) },
    )
    expect(forSnapshot(result.data)).toMatchSnapshot()
  })

  it('gets a record by uri and cid.', async () => {
    const result = await agent.tools.ozone.moderation.getRecord(
      {
        uri: sc.posts[sc.dids.alice][0].ref.uriStr,
        cid: sc.posts[sc.dids.alice][0].ref.cidStr,
      },
      { headers: await ozone.modHeaders(ids.ToolsOzoneModerationGetRecord) },
    )
    expect(forSnapshot(result.data)).toMatchSnapshot()
  })

  it('fails when record does not exist.', async () => {
    const promise = agent.tools.ozone.moderation.getRecord(
      {
        uri: AtUri.make(
          sc.dids.alice,
          'app.bsky.feed.post',
          'badrkey',
        ).toString(),
      },
      { headers: await ozone.modHeaders(ids.ToolsOzoneModerationGetRecord) },
    )
    await expect(promise).rejects.toThrow('Could not locate record')
  })

  it('fails when record cid does not exist.', async () => {
    const promise = agent.tools.ozone.moderation.getRecord(
      {
        uri: sc.posts[sc.dids.alice][0].ref.uriStr,
        cid: sc.posts[sc.dids.alice][1].ref.cidStr, // Mismatching cid
      },
      { headers: await ozone.modHeaders(ids.ToolsOzoneModerationGetRecord) },
    )
    await expect(promise).rejects.toThrow('Could not locate record')
  })

  it('gets record from pds if appview does not have it.', async () => {
    const post = await sc.post(sc.dids.carol, 'this is test')
    const { data: postFromOzone } =
      await agent.tools.ozone.moderation.getRecord(
        { uri: post.ref.uriStr },
        { headers: await ozone.modHeaders(ids.ToolsOzoneModerationGetRecord) },
      )
    expect(forSnapshot(postFromOzone)).toMatchSnapshot()
  })
})
