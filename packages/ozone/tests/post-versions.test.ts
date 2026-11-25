import { ComAtprotoModerationDefs, ids } from '@atproto/api'
import type { AtpAgent } from '@atproto/api'
import {
  type SeedClient,
  TestNetwork,
  type TestOzone,
  basicSeed,
} from '@atproto/dev-env'
import { AtUri } from '@atproto/syntax'

describe('post versions', () => {
  let network: TestNetwork
  let ozone: TestOzone
  let agent: AtpAgent
  let sc: SeedClient

  let uri: string
  let v1Cid: string
  let v2Cid: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_post_versions',
    })
    ozone = network.ozone
    agent = ozone.getAgent()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()

    const createdAt = new Date().toISOString()
    // Same createdAt for both versions: edits may not change it.
    const post = await sc.post(
      sc.dids.alice,
      'version one',
      undefined,
      undefined,
      undefined,
      { createdAt },
    )
    uri = post.ref.uriStr
    v1Cid = post.ref.cidStr
    await network.processAll()

    await sc.createReport({
      reportedBy: sc.dids.bob,
      reasonType: ComAtprotoModerationDefs.REASONRUDE,
      subject: { $type: 'com.atproto.repo.strongRef', uri, cid: v1Cid },
    })

    const { data } = await sc.agent.com.atproto.repo.putRecord(
      {
        repo: sc.dids.alice,
        collection: ids.AppBskyFeedPost,
        rkey: new AtUri(uri).rkey,
        swapRecord: v1Cid,
        record: {
          $type: ids.AppBskyFeedPost,
          text: 'version two',
          createdAt,
        },
      },
      { headers: sc.getHeaders(sc.dids.alice), encoding: 'application/json' },
    )
    v2Cid = data.cid
    await network.processAll()
  })

  afterAll(async () => {
    await network?.close()
  })

  const getRecord = async (cid?: string) => {
    const { data } = await agent.tools.ozone.moderation.getRecord(
      { uri, cid },
      { headers: await ozone.modHeaders(ids.ToolsOzoneModerationGetRecord) },
    )
    return data
  }

  it('gets the reported version of an edited post by its cid', async () => {
    const record = await getRecord(v1Cid)
    expect(record.cid).toBe(v1Cid)
    expect(record.value.text).toBe('version one')
  })

  it('gets the current version without a cid', async () => {
    const record = await getRecord()
    expect(record.cid).toBe(v2Cid)
    expect(record.value.text).toBe('version two')
  })

  it('fails for a cid that is not a version of the post', async () => {
    const other = sc.posts[sc.dids.bob][0].ref.cidStr
    await expect(getRecord(other)).rejects.toMatchObject({
      error: 'RecordNotFound',
    })
  })

  it('proxies post versions to the appview', async () => {
    const { data } = await agent.app.bsky.feed.getPostVersions(
      { uri },
      { headers: await ozone.modHeaders(ids.AppBskyFeedGetPostVersions) },
    )
    expect(data.versions.map((v) => [v.cid, v.record.text])).toEqual([
      [v2Cid, 'version two'],
      [v1Cid, 'version one'],
    ])
  })
})
